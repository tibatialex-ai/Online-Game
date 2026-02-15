import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReferralLink(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { refCode: true },
    });

    return {
      refCode: user?.refCode ?? null,
      link: user?.refCode ? `?ref=${user.refCode}` : null,
    };
  }

  async getUpline(userId: number) {
    const refs = await this.prisma.referral.findMany({
      where: { userId },
      orderBy: { level: 'asc' },
      take: 5,
      select: {
        level: true,
        inviter: {
          select: {
            id: true,
            nickname: true,
            refCode: true,
          },
        },
      },
    });

    return refs.map((ref) => ({
      level: ref.level,
      inviter: ref.inviter,
    }));
  }

  async getDownline(userId: number, page = 1, pageSize = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 20;
    const skip = (safePage - 1) * safePageSize;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.referral.count({
        where: {
          inviterId: userId,
          level: 1,
        },
      }),
      this.prisma.referral.findMany({
        where: {
          inviterId: userId,
          level: 1,
        },
        orderBy: {
          id: 'desc',
        },
        skip,
        take: safePageSize,
        select: {
          user: {
            select: {
              id: true,
              nickname: true,
              refCode: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      page: safePage,
      pageSize: safePageSize,
      total,
      items: items.map((item) => item.user),
    };
  }
}
