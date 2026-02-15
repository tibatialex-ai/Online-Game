import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { PrismaService } from './prisma.service';

const DEFAULT_INSTANCE_CAPACITY = 100;

@Injectable()
export class WorldService {
  constructor(private readonly prisma: PrismaService) {}

  private getSubscriptionWeight(tier: SubscriptionTier | null) {
    if (tier === SubscriptionTier.TIER_30) {
      return 1;
    }

    if (tier === SubscriptionTier.TIER_60) {
      return 2;
    }

    if (tier === SubscriptionTier.TIER_100) {
      return 3;
    }

    return 0;
  }

  private async getRelatedUserIds(tx: Prisma.TransactionClient, userId: number) {
    const [upline, downline] = await Promise.all([
      tx.referral.findMany({
        where: {
          userId,
          level: 1,
        },
        select: {
          inviterId: true,
        },
      }),
      tx.referral.findMany({
        where: {
          inviterId: userId,
          level: 1,
        },
        select: {
          userId: true,
        },
      }),
    ]);

    return [
      ...upline.map((item) => item.inviterId),
      ...downline.map((item) => item.userId),
    ];
  }

  private async tryTakeInstanceSlot(
    tx: Prisma.TransactionClient,
    districtId: number,
    instanceId: number,
  ) {
    const updated = await tx.$executeRaw`
      UPDATE "Instance"
      SET "currentCount" = "currentCount" + 1
      WHERE "id" = ${instanceId}
        AND "districtId" = ${districtId}
        AND "currentCount" < "capacity"
    `;

    return updated > 0;
  }

  async enter(userId: number, districtId: number) {
    if (!Number.isInteger(districtId) || districtId <= 0) {
      throw new BadRequestException('districtId must be a positive integer');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          gameRating: true,
          mlmRating: true,
          subscriptions: {
            where: {
              status: SubscriptionStatus.ACTIVE,
              endAt: {
                gt: new Date(),
              },
            },
            orderBy: {
              endAt: 'desc',
            },
            take: 1,
            select: {
              tier: true,
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const district = await tx.district.findUnique({
        where: { id: districtId },
        select: {
          id: true,
          requiredGameRating: true,
        },
      });

      if (!district) {
        throw new BadRequestException('District not found');
      }

      if (user.gameRating < district.requiredGameRating) {
        throw new BadRequestException('Insufficient gameRating for district');
      }

      const existingPresence = await tx.presence.findUnique({
        where: {
          userId,
        },
        select: {
          districtId: true,
          instanceId: true,
        },
      });

      if (
        existingPresence &&
        existingPresence.districtId === districtId
      ) {
        await tx.presence.update({
          where: { userId },
          data: {
            updatedAt: new Date(),
          },
        });

        return {
          districtId: existingPresence.districtId,
          instanceId: existingPresence.instanceId,
        };
      }

      const relatedUserIds = await this.getRelatedUserIds(tx, userId);
      const subscriptionWeight = this.getSubscriptionWeight(user.subscriptions[0]?.tier ?? null);
      const selfPriority = user.gameRating + user.mlmRating + subscriptionWeight;

      const relatedPresences = relatedUserIds.length
        ? await tx.presence.findMany({
            where: {
              userId: {
                in: relatedUserIds,
              },
              districtId,
            },
            select: {
              instanceId: true,
              userId: true,
              user: {
                select: {
                  gameRating: true,
                  mlmRating: true,
                  subscriptions: {
                    where: {
                      status: SubscriptionStatus.ACTIVE,
                      endAt: {
                        gt: new Date(),
                      },
                    },
                    orderBy: {
                      endAt: 'desc',
                    },
                    take: 1,
                    select: {
                      tier: true,
                    },
                  },
                },
              },
            },
          })
        : [];

      const prioritiesByInstance = new Map<number, number>();
      for (const presence of relatedPresences) {
        const weight = this.getSubscriptionWeight(presence.user.subscriptions[0]?.tier ?? null);
        const score = presence.user.gameRating + presence.user.mlmRating + weight;
        const existingScore = prioritiesByInstance.get(presence.instanceId) ?? Number.NEGATIVE_INFINITY;
        prioritiesByInstance.set(presence.instanceId, Math.max(existingScore, score));
      }

      const allInstances = await tx.instance.findMany({
        where: {
          districtId,
        },
        select: {
          id: true,
          capacity: true,
          currentCount: true,
        },
        orderBy: [{ currentCount: 'asc' }, { id: 'asc' }],
      });

      const relatedInstanceIds = new Set(relatedPresences.map((item) => item.instanceId));
      const relatedInstances = allInstances
        .filter((instance) => relatedInstanceIds.has(instance.id))
        .sort((left, right) => {
          const leftScore = prioritiesByInstance.get(left.id) ?? selfPriority;
          const rightScore = prioritiesByInstance.get(right.id) ?? selfPriority;

          if (rightScore !== leftScore) {
            return rightScore - leftScore;
          }

          if (left.currentCount !== right.currentCount) {
            return left.currentCount - right.currentCount;
          }

          return left.id - right.id;
        });

      const fallbackInstances = allInstances.filter(
        (instance) => !relatedInstanceIds.has(instance.id),
      );

      const orderedCandidates = [...relatedInstances, ...fallbackInstances];

      let selectedInstanceId: number | null = null;

      for (const instance of orderedCandidates) {
        const allocated = await this.tryTakeInstanceSlot(tx, districtId, instance.id);
        if (allocated) {
          selectedInstanceId = instance.id;
          break;
        }
      }

      if (!selectedInstanceId) {
        const inferredCapacity = allInstances[0]?.capacity ?? DEFAULT_INSTANCE_CAPACITY;
        const createdInstance = await tx.instance.create({
          data: {
            districtId,
            capacity: inferredCapacity,
            currentCount: 1,
          },
          select: {
            id: true,
          },
        });
        selectedInstanceId = createdInstance.id;
      }

      await tx.presence.upsert({
        where: {
          userId,
        },
        update: {
          districtId,
          instanceId: selectedInstanceId,
          updatedAt: new Date(),
        },
        create: {
          userId,
          districtId,
          instanceId: selectedInstanceId,
        },
      });

      if (existingPresence?.instanceId) {
        await tx.instance.updateMany({
          where: {
            id: existingPresence.instanceId,
            currentCount: {
              gt: 0,
            },
          },
          data: {
            currentCount: {
              decrement: 1,
            },
          },
        });
      }

      return {
        districtId,
        instanceId: selectedInstanceId,
      };
    });
  }

  async whereAmI(userId: number) {
    const presence = await this.prisma.presence.findUnique({
      where: {
        userId,
      },
      select: {
        districtId: true,
        instanceId: true,
      },
    });

    return {
      districtId: presence?.districtId ?? null,
      instanceId: presence?.instanceId ?? null,
    };
  }
}
