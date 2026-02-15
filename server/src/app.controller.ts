import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('db-check')
  async dbCheck() {
    const usersCount = await this.appService.countUsers();
    return { usersCount };
  }
}
