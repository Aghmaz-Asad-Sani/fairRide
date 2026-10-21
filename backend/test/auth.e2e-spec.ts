import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Auth endpoints (e2e)', () => {
  let app: INestApplication;
  const auth = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    currentUser: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: () => {
          throw new UnauthorizedException();
        },
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('validates registration payloads before calling the service', async () => {
    await request(app.getHttpServer() as App)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Rider',
        phone: '+923001234567',
        password: 'StrongPassword123!',
        role: 'SUPER_ADMIN',
      })
      .expect(400);

    expect(auth.register).not.toHaveBeenCalled();
  });

  it('routes login requests with the client IP to the auth service', async () => {
    auth.login.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 'user-id' },
    });

    await request(app.getHttpServer() as App)
      .post('/api/v1/auth/login')
      .send({
        identifier: '+923001234567',
        password: 'StrongPassword123!',
      })
      .expect(200)
      .then((response) => {
        const body: unknown = response.body;
        expect(body).toMatchObject({
          accessToken: 'access',
          refreshToken: 'refresh',
        });
      });

    expect(auth.login).toHaveBeenCalledWith(
      { identifier: '+923001234567', password: 'StrongPassword123!' },
      expect.any(String),
    );
  });

  it('protects private auth endpoints from unauthenticated callers', async () => {
    await request(app.getHttpServer() as App)
      .get('/api/v1/auth/me')
      .expect(401);
  });
});
