import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../health/redis.service';
import { AuthRateLimitService } from './auth-rate-limit.service';

describe('AuthRateLimitService', () => {
  let service: AuthRateLimitService;
  let consumeRateLimit: jest.Mock;

  beforeEach(() => {
    consumeRateLimit = jest.fn().mockResolvedValue(1);
    const redis = { consumeRateLimit } as unknown as RedisService;
    const config = {
      get: jest.fn((key: string, fallback: number) =>
        key === 'AUTH_LOGIN_LIMIT' ? 2 : fallback,
      ),
    } as unknown as ConfigService;
    service = new AuthRateLimitService(redis, config);
  });

  it('hashes account identifiers before using them as Redis keys', async () => {
    await service.assertLoginAllowed('login:identifier', '+923001234567');

    expect(consumeRateLimit).toHaveBeenCalledWith(
      expect.stringMatching(/^rate:login:identifier:[a-f0-9]{64}$/),
      60,
    );
  });

  it('rejects requests above the configured threshold', async () => {
    consumeRateLimit.mockResolvedValue(3);

    await expect(
      service.assertLoginAllowed('login:ip', '127.0.0.1'),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
