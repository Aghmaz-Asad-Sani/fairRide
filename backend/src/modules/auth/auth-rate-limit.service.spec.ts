import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuthRateLimitService } from './auth-rate-limit.service';

describe('AuthRateLimitService', () => {
  let service: AuthRateLimitService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([{ request_count: 1 }]);
    const dataSource = { query } as unknown as DataSource;
    const config = {
      get: jest.fn((key: string, fallback: number) =>
        key === 'AUTH_LOGIN_LIMIT' ? 2 : fallback,
      ),
    } as unknown as ConfigService;
    service = new AuthRateLimitService(dataSource, config);
  });

  it('hashes account identifiers before storing them in PostgreSQL', async () => {
    await service.assertLoginAllowed('login:identifier', '+923001234567');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO auth_rate_limits'),
      ['login:identifier', expect.stringMatching(/^[a-f0-9]{64}$/), 60],
    );
  });

  it('rejects requests above the configured threshold', async () => {
    query.mockResolvedValue([{ request_count: 3 }]);

    await expect(
      service.assertLoginAllowed('login:ip', '127.0.0.1'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('reuses the fixed window until its expiry', async () => {
    await service.assertRegistrationAllowed('127.0.0.1');

    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('auth_rate_limits.expires_at <= now()');
    expect(sql).toContain('ELSE auth_rate_limits.expires_at');
    expect(parameters[0]).toBe('register:ip');
    expect(parameters[2]).toBe(60);
  });
});
