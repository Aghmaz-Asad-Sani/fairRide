import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    controller = new HealthController({ query } as unknown as DataSource);
  });

  it('reports liveness without querying PostgreSQL', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
  });

  it('reports ready when PostgreSQL responds', async () => {
    await expect(controller.ready()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'ok' },
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns service unavailable when a dependency fails', async () => {
    query.mockRejectedValue(new Error('database unavailable'));

    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
