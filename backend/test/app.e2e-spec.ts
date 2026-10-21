import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { HealthController } from '../src/modules/health/health.controller';
import { RedisService } from '../src/modules/health/redis.service';

describe('Health endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) },
        },
        {
          provide: RedisService,
          useValue: { ping: jest.fn().mockResolvedValue('PONG') },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports that the API process is live', async () => {
    await request(app.getHttpServer() as App)
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('reports database and Redis readiness', async () => {
    await request(app.getHttpServer() as App)
      .get('/api/v1/health/ready')
      .expect(200)
      .expect({
        status: 'ok',
        checks: { database: 'ok', redis: 'ok' },
      });
  });
});
