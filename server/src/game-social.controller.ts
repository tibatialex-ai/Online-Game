import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SocialTournamentService } from './social-tournament.service';

@Controller('game/social')
export class GameSocialController {
  constructor(
    private readonly authService: AuthService,
    private readonly socialTournamentService: SocialTournamentService,
  ) {}

  private getUserIdFromAuthHeader(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const token = authorization.slice('Bearer '.length);
    const payload = this.authService.parseToken(token);
    return payload.sub;
  }

  @Post('join')
  async joinMatchmaking(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { mode: 'free' | 'paid'; stakeAmount?: number | string },
  ) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.socialTournamentService.joinMatchmaking(userId, body.mode, body.stakeAmount);
  }
}
