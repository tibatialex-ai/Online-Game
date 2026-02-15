import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { PrismaService } from './prisma.service';

const SUPPORTED_TIERS = [30, 60, 100] as const;
const MLM_LEVEL_SPLITS = [40, 30, 15, 10, 5] as const;

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  private mapTierToEnum(tier: number): SubscriptionTier {
    if (tier === 30) {
      return SubscriptionTier.TIER_30;
    }

    if (tier === 60) {
      return SubscriptionTier.TIER_60;
    }

    if (tier === 100) {
      return SubscriptionTier.TIER_100;
    }

    throw new BadRequestException('tier must be one of: 30, 60, 100');
  }

  async buyYearlySubscription(userId: number, tierRaw: number | string) {
    const tierValue = typeof tierRaw === 'string' ? Number(tierRaw) : tierRaw;

    if (!Number.isFinite(tierValue) || !SUPPORTED_TIERS.includes(tierValue as (typeof SUPPORTED_TIERS)[number])) {
      throw new BadRequestException('tier must be one of: 30, 60, 100');
    }

    const tier = new Prisma.Decimal(tierValue.toString());
    const subscriptionTier = this.mapTierToEnum(tierValue);

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: {
          balanceToken: true,
        },
      });

      if (!wallet) {
        throw new UnauthorizedException('Wallet not found');
      }

      if (wallet.balanceToken.lt(tier)) {
        throw new BadRequestException('Insufficient balanceToken');
      }

      await tx.wallet.update({
        where: { userId },
        data: {
          balanceToken: {
            decrement: tier,
          },
        },
      });

      const now = new Date();
      const endAt = new Date(now);
      endAt.setFullYear(endAt.getFullYear() + 1);

      const existingSubscription = await tx.subscription.findFirst({
        where: { userId },
        orderBy: {
          endAt: 'desc',
        },
        select: {
          id: true,
        },
      });

      const subscription = existingSubscription
        ? await tx.subscription.update({
            where: { id: existingSubscription.id },
            data: {
              tier: subscriptionTier,
              startAt: now,
              endAt,
              status: SubscriptionStatus.ACTIVE,
            },
            select: {
              tier: true,
              startAt: true,
              endAt: true,
              status: true,
            },
          })
        : await tx.subscription.create({
            data: {
              userId,
              tier: subscriptionTier,
              startAt: now,
              endAt,
              status: SubscriptionStatus.ACTIVE,
            },
            select: {
              tier: true,
              startAt: true,
              endAt: true,
              status: true,
            },
          });

      const directTreasuryPart = tier.mul(30).div(100);
      const mlmPool = tier.mul(70).div(100);

      let treasuryTotal = directTreasuryPart;

      const upline = await tx.referral.findMany({
        where: { userId },
        orderBy: { level: 'asc' },
        take: 5,
        select: {
          level: true,
          inviterId: true,
        },
      });

      const uplineByLevel = new Map<number, number>(upline.map((item) => [item.level, item.inviterId]));

      const distribution: Array<{ level: number; recipientUserId: number | null; amount: Prisma.Decimal }> = [];

      for (let index = 0; index < MLM_LEVEL_SPLITS.length; index += 1) {
        const level = index + 1;
        const levelPercent = MLM_LEVEL_SPLITS[index];
        const levelAmount = mlmPool.mul(levelPercent).div(100);
        const recipientUserId = uplineByLevel.get(level) ?? null;

        if (recipientUserId) {
          await tx.wallet.update({
            where: { userId: recipientUserId },
            data: {
              balanceToken: {
                increment: levelAmount,
              },
            },
          });

          await tx.ledger.create({
            data: {
              userId: recipientUserId,
              type: 'SUBSCRIPTION_MLM_REWARD',
              amount: levelAmount,
              metaJson: {
                sourceUserId: userId,
                level,
                tier: tierValue,
              },
            },
          });
        } else {
          treasuryTotal = treasuryTotal.add(levelAmount);
        }

        distribution.push({ level, recipientUserId, amount: levelAmount });
      }

      await tx.treasury.update({
        where: { id: 1 },
        data: {
          balanceToken: {
            increment: treasuryTotal,
          },
        },
      });

      await tx.ledger.createMany({
        data: [
          {
            userId,
            type: 'SUBSCRIPTION_PURCHASE',
            amount: tier.neg(),
            metaJson: {
              tier: tierValue,
            },
          },
          {
            userId,
            type: 'SUBSCRIPTION_TREASURY_DISTRIBUTION',
            amount: treasuryTotal,
            metaJson: {
              tier: tierValue,
              directTreasuryPart: directTreasuryPart.toString(),
              missingUplinePart: treasuryTotal.sub(directTreasuryPart).toString(),
            },
          },
          {
            userId,
            type: 'SUBSCRIPTION_MLM_DISTRIBUTION',
            amount: mlmPool,
            metaJson: {
              tier: tierValue,
              levels: distribution.map((item) => ({
                level: item.level,
                recipientUserId: item.recipientUserId,
                amount: item.amount.toString(),
              })),
            },
          },
        ],
      });

      const updatedWallet = await tx.wallet.findUnique({
        where: { userId },
        select: {
          balanceToken: true,
        },
      });

      return {
        subscription,
        wallet: updatedWallet,
        treasuryAdded: treasuryTotal,
      };
    });

    return {
      subscription: result.subscription,
      balanceToken: result.wallet?.balanceToken.toString() ?? null,
      treasuryAdded: result.treasuryAdded.toString(),
    };
  }

  async getStatus(userId: number) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: {
        endAt: 'desc',
      },
      select: {
        tier: true,
        startAt: true,
        endAt: true,
        status: true,
      },
    });

    if (!subscription) {
      return {
        subscription: null,
        isActive: false,
      };
    }

    const now = new Date();
    const isActive = subscription.status === SubscriptionStatus.ACTIVE && subscription.endAt > now;

    return {
      subscription,
      isActive,
    };
  }
}
