import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class AuthRateLimitService {
  private readonly loginLimit: number;
  private readonly loginWindowSeconds: number;
  private readonly registerLimit: number;
  private operationsSinceCleanup = 0;

  constructor(
    private readonly dataSource: DataSource,
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
    const identifierHash = createHash('sha256').update(value).digest('hex');
    this.operationsSinceCleanup += 1;
    if (this.operationsSinceCleanup >= 100) {
      this.operationsSinceCleanup = 0;
      await this.dataSource.query(
        `WITH expired AS (
           SELECT ctid
           FROM auth_rate_limits
           WHERE expires_at <= now()
           ORDER BY expires_at
           LIMIT 100
         )
         DELETE FROM auth_rate_limits
         WHERE ctid IN (SELECT ctid FROM expired)`,
      );
    }
    const rows: unknown = await this.dataSource.query(
      `INSERT INTO auth_rate_limits (
         bucket, identifier_hash, request_count, expires_at
       )
       VALUES ($1, $2, 1, now() + ($3 * interval '1 second'))
       ON CONFLICT (bucket, identifier_hash) DO UPDATE
       SET request_count = CASE
             WHEN auth_rate_limits.expires_at <= now() THEN 1
             ELSE auth_rate_limits.request_count + 1
           END,
           expires_at = CASE
             WHEN auth_rate_limits.expires_at <= now()
               THEN now() + ($3 * interval '1 second')
             ELSE auth_rate_limits.expires_at
           END
       RETURNING request_count`,
      [bucket, identifierHash, windowSeconds],
    );
    if (
      !Array.isArray(rows) ||
      rows.length !== 1 ||
      !isRecord(rows[0]) ||
      !('request_count' in rows[0])
    ) {
      throw new InternalServerErrorException(
        'Unable to update authentication rate limit',
      );
    }
    const rawCount = rows[0].request_count;
    const count =
      typeof rawCount === 'number'
        ? rawCount
        : typeof rawCount === 'string'
          ? Number(rawCount)
          : Number.NaN;
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new InternalServerErrorException(
        'Database returned an invalid authentication rate limit',
      );
    }
    if (count > limit) {
      throw new HttpException(
        'Too many requests; try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
