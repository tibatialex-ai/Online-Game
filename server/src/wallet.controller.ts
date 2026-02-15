import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly authService: AuthService,
    private readonly walletService: WalletService,
  ) {}

  private getUserIdFromAuthHeader(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const token = authorization.slice('Bearer '.length);
    const payload = this.authService.parseToken(token);
    return payload.sub;
  }

  @Get()
  async getWallet(@Headers('authorization') authorization?: string) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.walletService.getWallet(userId);
  }

  @Get('ledger')
  async getLedger(@Headers('authorization') authorization?: string) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.walletService.getLedger(userId);
  }

  @Post('faucet')
  async faucet(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { amount: number | string },
  ) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.walletService.faucet(userId, body?.amount);
  }
}
