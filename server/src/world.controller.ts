import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { WorldService } from './world.service';

@Controller('world')
export class WorldController {
  constructor(
    private readonly authService: AuthService,
    private readonly worldService: WorldService,
  ) {}

  private getUserIdFromAuthHeader(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const token = authorization.slice('Bearer '.length);
    const payload = this.authService.parseToken(token);
    return payload.sub;
  }

  @Post('enter')
  async enter(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { districtId: number | string },
  ) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    const districtId = typeof body?.districtId === 'string' ? Number(body.districtId) : body?.districtId;
    return this.worldService.enter(userId, districtId);
  }

  @Get('whereami')
  async whereAmI(@Headers('authorization') authorization: string | undefined) {
    const userId = this.getUserIdFromAuthHeader(authorization);
    return this.worldService.whereAmI(userId);
  }
}
