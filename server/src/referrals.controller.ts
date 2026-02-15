import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(
    private readonly authService: AuthService,
    private readonly referralsService: ReferralsService,
  ) {}

  private getUserIdFromAuthHeader(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const token = authorization.slice('Bearer '.length);
    const payload = this.authService.parseToken(token);
    return payload.sub;
  }

  @Get('link')
  async getLink(@Headers('authorization') authorization?: string) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.referralsService.getReferralLink(userId);
  }

  @Get('upline')
  async getUpline(@Headers('authorization') authorization?: string) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.referralsService.getUpline(userId);
  }

  @Get('downline')
  async getDownline(
    @Headers('authorization') authorization?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.referralsService.getDownline(userId, Number(page), Number(pageSize));
  }
}
