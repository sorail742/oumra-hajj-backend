import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HealthShape } from '../../types';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): HealthShape {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
