import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@Controller('health')
export class HealthController {
  @Get('live')
  live() { return { status: 'ok', service: 'twipay-api' }; }
}
