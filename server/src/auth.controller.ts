import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/register')
  async register(
    @Body() body: { nickname: string; password: string; refCodeOptional?: string },
  ) {
    return this.authService.register(body.nickname, body.password, body.refCodeOptional);
  }

  @Post('auth/login')
  async login(@Body() body: { nickname: string; password: string }) {
    return this.authService.login(body.nickname, body.password);
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const token = authorization.slice('Bearer '.length);
    const payload = this.authService.parseToken(token);
    return this.authService.me(payload.sub);
  }
}
