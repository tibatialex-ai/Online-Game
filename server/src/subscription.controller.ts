import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly authService: AuthService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  private getUserIdFromAuthHeader(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const token = authorization.slice('Bearer '.length);
    const payload = this.authService.parseToken(token);
    return payload.sub;
  }

  @Post('buy')
  async buy(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { tier: number | string },
  ) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.subscriptionService.buyYearlySubscription(userId, body?.tier);
  }

  @Get('status')
  async status(@Headers('authorization') authorization: string | undefined) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.subscriptionService.getStatus(userId);
  }
}
