import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { StakingController } from './staking.controller';
import { StakingService } from './staking.service';

@Module({
  controllers: [
    AppController,
    AuthController,
    WalletController,
    ReferralsController,
    SubscriptionController,
    StakingController,
  ],
  providers: [
    AppService,
    PrismaService,
    AuthService,
    WalletService,
    ReferralsService,
    SubscriptionService,
    StakingService,
  ],
})
export class AppModule {}
