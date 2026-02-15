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

@Module({
  controllers: [AppController, AuthController, WalletController, ReferralsController],
  providers: [AppService, PrismaService, AuthService, WalletService, ReferralsService],
})
export class AppModule {}
