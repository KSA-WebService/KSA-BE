import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  checkHealth() {
    return {
      status: 'ok',
      service: 'ksa-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
