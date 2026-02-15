import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SocialTournamentService } from './social-tournament.service';

@Controller('social-tournament')
export class SocialTournamentController {
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

  @Post('matches')
  async createMatch(
    @Body() body: { playerIds: number[]; durationMinutes?: number },
  ) {
    return this.socialTournamentService.createMatch(body.playerIds, body.durationMinutes);
  }

  @Get('matches/:matchId')
  async getMatch(@Param('matchId') matchId: string) {
    return this.socialTournamentService.getMatch(matchId);
  }

  @Post('matches/:matchId/answer')
  async submitAnswer(
    @Param('matchId') matchId: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { answer: string | number },
  ) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.socialTournamentService.submitRoundAnswer(matchId, userId, body.answer);
  }
}
