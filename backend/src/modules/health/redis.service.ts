import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly connectionUrl: string;
  private client: Redis;
  private connection: Promise<void> | undefined;

  constructor(config: ConfigService) {
    this.connectionUrl = config.getOrThrow<string>('REDIS_URL');
    this.client = this.createClient();
  }

  private createClient(): Redis {
    return new Redis(this.connectionUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1000,
      retryStrategy: (attempt) => (attempt <= 2 ? attempt * 250 : null),
    });
  }

  async ping(): Promise<string> {
    await this.ensureConnected();
    return this.client.ping();
  }

  async consumeRateLimit(key: string, windowSeconds: number): Promise<number> {
    await this.ensureConnected();
    const result = await this.client.eval(
      "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return count",
      1,
      key,
      windowSeconds,
    );
    return Number(result);
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.status === 'end') {
      this.client = this.createClient();
    }
    if (this.client.status === 'wait') {
      this.connection ??= this.client.connect();
    }
    if (this.connection) {
      const connection = this.connection;
      try {
        await connection;
      } finally {
        if (this.connection === connection) {
          this.connection = undefined;
        }
      }
    }
    if (this.client.status !== 'ready') {
      throw new Error('Redis connection is not ready');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.connection) {
      await this.connection;
    }
    if (this.client.status === 'ready') {
      await this.client.quit();
    } else {
      this.client.disconnect();
    }
  }
}
