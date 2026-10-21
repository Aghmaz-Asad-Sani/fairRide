import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { RedisService } from './redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Check whether the API process is running' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check database and Redis readiness' })
  async ready() {
    const checks = await Promise.allSettled([
      this.dataSource.query('SELECT 1'),
      this.redis.ping(),
    ]);
    const [database, redis] = checks;
    const isReady =
      database.status === 'fulfilled' &&
      redis.status === 'fulfilled' &&
      redis.value === 'PONG';

    if (!isReady) {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: {
          database: database.status === 'fulfilled' ? 'ok' : 'error',
          redis:
            redis.status === 'fulfilled' && redis.value === 'PONG'
              ? 'ok'
              : 'error',
        },
      });
    }

    return {
      status: 'ok',
      checks: { database: 'ok', redis: 'ok' },
    };
  }
}
