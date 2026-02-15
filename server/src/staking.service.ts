import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class StakingService {
  private readonly monthlyRate = new Prisma.Decimal('0.025');

  constructor(private readonly prisma: PrismaService) {}

  private toWalletResponse(wallet: {
    balanceToken: Prisma.Decimal;
    lockedToken: Prisma.Decimal;
    stakedToken: Prisma.Decimal;
  }) {
    return {
      balanceToken: wallet.balanceToken.toString(),
      lockedToken: wallet.lockedToken.toString(),
      stakedToken: wallet.stakedToken.toString(),
    };
  }

  private parseAmount(amountRaw: number | string) {
    const amountValue = typeof amountRaw === 'string' ? Number(amountRaw) : amountRaw;

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }

    return new Prisma.Decimal(amountValue.toString());
  }

  private addMonths(date: Date, months: number) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  async stake(userId: number, amountRaw: number | string) {
    const amount = this.parseAmount(amountRaw);

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: {
          balanceToken: true,
          lockedToken: true,
          stakedToken: true,
        },
      });

      if (!wallet) {
        throw new UnauthorizedException('Wallet not found');
      }

      if (wallet.balanceToken.lt(amount)) {
        throw new BadRequestException('Insufficient balanceToken');
      }

      const now = new Date();
      const endAt = this.addMonths(now, 12);

      const [updatedWallet, position, ledgerEntry] = await Promise.all([
        tx.wallet.update({
          where: { userId },
          data: {
            balanceToken: { decrement: amount },
            stakedToken: { increment: amount },
            lockedToken: { increment: amount },
          },
          select: {
            balanceToken: true,
            lockedToken: true,
            stakedToken: true,
          },
        }),
        tx.stakingPosition.create({
          data: {
            userId,
            amount,
            startAt: now,
            endAt,
          },
          select: {
            id: true,
            amount: true,
            startAt: true,
            endAt: true,
          },
        }),
        tx.ledger.create({
          data: {
            userId,
            type: 'STAKE',
            amount,
            metaJson: {
              lockMonths: 12,
            },
          },
        }),
      ]);

      return { updatedWallet, position, ledgerEntry };
    });

    return {
      wallet: this.toWalletResponse(result.updatedWallet),
      position: {
        id: result.position.id,
        amount: result.position.amount.toString(),
        startAt: result.position.startAt,
        endAt: result.position.endAt,
      },
      ledgerEntryId: result.ledgerEntry.id,
    };
  }

  async status(userId: number) {
    const [wallet, positions] = await Promise.all([
      this.prisma.wallet.findUnique({
        where: { userId },
        select: {
          balanceToken: true,
          lockedToken: true,
          stakedToken: true,
        },
      }),
      this.prisma.stakingPosition.findMany({
        where: { userId },
        orderBy: { startAt: 'desc' },
        select: {
          id: true,
          amount: true,
          startAt: true,
          endAt: true,
        },
      }),
    ]);

    if (!wallet) {
      throw new UnauthorizedException('Wallet not found');
    }

    const now = new Date();

    return {
      wallet: this.toWalletResponse(wallet),
      positions: positions.map((position) => ({
        id: position.id,
        amount: position.amount.toString(),
        startAt: position.startAt,
        endAt: position.endAt,
        isLocked: position.endAt > now,
      })),
    };
  }

  async runMonthlyStakingRewards() {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Endpoint is available only in non-production environments');
    }

    const rewards = await this.prisma.$transaction(async (tx) => {
      const wallets = await tx.wallet.findMany({
        where: {
          stakedToken: {
            gt: new Prisma.Decimal('0'),
          },
        },
        select: {
          userId: true,
          stakedToken: true,
        },
      });

      const results: Array<{
        userId: number;
        reward: string;
        wallet: {
          balanceToken: string;
          lockedToken: string;
          stakedToken: string;
        };
        ledgerEntryId: number;
      }> = [];

      for (const wallet of wallets) {
        const reward = wallet.stakedToken.mul(this.monthlyRate);

        const updatedWallet = await tx.wallet.update({
          where: { userId: wallet.userId },
          data: {
            balanceToken: {
              increment: reward,
            },
          },
          select: {
            balanceToken: true,
            stakedToken: true,
            lockedToken: true,
          },
        });

        const ledgerEntry = await tx.ledger.create({
          data: {
            userId: wallet.userId,
            type: 'STAKING_REWARD',
            amount: reward,
            metaJson: {
              rate: this.monthlyRate.toString(),
            },
          },
          select: {
            id: true,
          },
        });

        results.push({
          userId: wallet.userId,
          reward: reward.toString(),
          wallet: this.toWalletResponse(updatedWallet),
          ledgerEntryId: ledgerEntry.id,
        });
      }

      return results;
    });

    return {
      rewardedUsers: rewards.length,
      rewards,
    };
  }

}
