import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('live')
  @ApiOperation({ summary: 'Check whether the API process is running' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check PostgreSQL readiness' })
  async ready() {
    const [database] = await Promise.allSettled([
      this.dataSource.query('SELECT 1'),
    ]);

    if (database.status !== 'fulfilled') {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: { database: 'error' },
      });
    }

    return { status: 'ok', checks: { database: 'ok' } };
  }
}
