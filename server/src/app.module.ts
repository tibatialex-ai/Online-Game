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
import { WorldController } from './world.controller';
import { WorldService } from './world.service';
import { SocialTournamentController } from './social-tournament.controller';
import { SocialTournamentService } from './social-tournament.service';
import { GameSocialController } from './game-social.controller';
import { MatchWsGateway } from './match-ws.gateway';

@Module({
  controllers: [
    AppController,
    AuthController,
    WalletController,
    ReferralsController,
    SubscriptionController,
    StakingController,
    WorldController,
    SocialTournamentController,
    GameSocialController,
  ],
  providers: [
    AppService,
    PrismaService,
    AuthService,
    WalletService,
    ReferralsService,
    SubscriptionService,
    StakingService,
    WorldService,
    SocialTournamentService,
    MatchWsGateway,
  ],
})
export class AppModule {}
