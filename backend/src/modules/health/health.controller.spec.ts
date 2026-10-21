import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';
import { RedisService } from './redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let query: jest.Mock;
  let ping: jest.Mock;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    ping = jest.fn().mockResolvedValue('PONG');
    controller = new HealthController(
      { query } as unknown as DataSource,
      { ping } as unknown as RedisService,
    );
  });

  it('reports liveness without querying dependencies', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
    expect(ping).not.toHaveBeenCalled();
  });

  it('reports ready when PostgreSQL and Redis respond', async () => {
    await expect(controller.ready()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'ok', redis: 'ok' },
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('returns service unavailable when a dependency fails', async () => {
    query.mockRejectedValue(new Error('database unavailable'));

    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
