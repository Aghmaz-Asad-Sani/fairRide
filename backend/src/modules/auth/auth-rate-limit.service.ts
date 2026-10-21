import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { RedisService } from '../health/redis.service';

@Injectable()
export class AuthRateLimitService {
  private readonly loginLimit: number;
  private readonly loginWindowSeconds: number;
  private readonly registerLimit: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.loginLimit = config.get<number>('AUTH_LOGIN_LIMIT', 5);
    this.loginWindowSeconds = config.get<number>(
      'AUTH_LOGIN_WINDOW_SECONDS',
      60,
    );
    this.registerLimit = config.get<number>('AUTH_REGISTER_LIMIT', 5);
  }

  async assertLoginAllowed(bucket: string, value: string): Promise<void> {
    await this.assertAllowed(
      bucket,
      value,
      this.loginLimit,
      this.loginWindowSeconds,
    );
  }

  async assertRegistrationAllowed(clientIp: string): Promise<void> {
    await this.assertAllowed('register:ip', clientIp, this.registerLimit, 60);
  }

  private async assertAllowed(
    bucket: string,
    value: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const digest = createHash('sha256').update(value).digest('hex');
    const count = await this.redis.consumeRateLimit(
      `rate:${bucket}:${digest}`,
      windowSeconds,
    );
    if (count > limit) {
      throw new HttpException(
        'Too many requests; try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
