import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class WalletService {
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

  async getWallet(userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
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

    return this.toWalletResponse(wallet);
  }

  async getLedger(userId: number) {
    const entries = await this.prisma.ledger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        amount: true,
        metaJson: true,
        createdAt: true,
      },
    });

    return entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      amount: entry.amount.toString(),
      metaJson: entry.metaJson,
      createdAt: entry.createdAt,
    }));
  }

  async faucet(userId: number, amountRaw: number | string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Faucet is available only in non-production environments');
    }

    const amountValue = typeof amountRaw === 'string' ? Number(amountRaw) : amountRaw;

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }

    const amount = new Prisma.Decimal(amountValue.toString());

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({
        where: { userId },
        data: {
          balanceToken: {
            increment: amount,
          },
        },
        select: {
          balanceToken: true,
          lockedToken: true,
          stakedToken: true,
        },
      });

      const ledgerEntry = await tx.ledger.create({
        data: {
          userId,
          type: 'FAUCET',
          amount,
          metaJson: {
            source: 'wallet.faucet',
          },
        },
        select: {
          id: true,
          type: true,
          amount: true,
          metaJson: true,
          createdAt: true,
        },
      });

      return { wallet, ledgerEntry };
    });

    return {
      wallet: this.toWalletResponse(result.wallet),
      ledgerEntry: {
        id: result.ledgerEntry.id,
        type: result.ledgerEntry.type,
        amount: result.ledgerEntry.amount.toString(),
        metaJson: result.ledgerEntry.metaJson,
        createdAt: result.ledgerEntry.createdAt,
      },
    };
  }
}
