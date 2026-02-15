import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { StakingService } from './staking.service';

@Controller()
export class StakingController {
  constructor(
    private readonly authService: AuthService,
    private readonly stakingService: StakingService,
  ) {}

  private getUserIdFromAuthHeader(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const token = authorization.slice('Bearer '.length);
    const payload = this.authService.parseToken(token);
    return payload.sub;
  }

  @Post('staking/stake')
  async stake(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { amount: number | string },
  ) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.stakingService.stake(userId, body?.amount);
  }

  @Get('staking/status')
  async status(@Headers('authorization') authorization?: string) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.stakingService.status(userId);
  }

  @Post('admin/run-staking-month')
  async runStakingMonth() {
    return this.stakingService.runMonthlyStakingRewards();
  }
}
