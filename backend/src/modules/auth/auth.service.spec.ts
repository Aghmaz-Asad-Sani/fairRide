import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuditLog } from '../../database/audit-log.entity';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthSession } from './auth-session.entity';
import { AuthService } from './auth.service';
import { OtpDeliveryProvider } from './otp-delivery.provider';

describe('AuthService', () => {
  const registerInput = {
    name: 'Test Passenger',
    phone: '0300 1234567',
    email: ' Rider@Example.com ',
    password: 'StrongPassword123!',
    role: UserRole.PASSENGER,
  } as const;

  it('stores a normalized account, Argon2id hash and hashed refresh token', async () => {
    const inserts = new Map<unknown, jest.Mock>([
      [User, jest.fn().mockResolvedValue(undefined)],
      [AuthSession, jest.fn().mockResolvedValue(undefined)],
      [AuditLog, jest.fn().mockResolvedValue(undefined)],
    ]);
    const entities = new Map<unknown, jest.Mock>([
      [User, jest.fn((value: unknown) => value)],
      [AuthSession, jest.fn((value: unknown) => value)],
      [AuditLog, jest.fn((value: unknown) => value)],
    ]);
    const repo = (target: unknown) => ({
      create: entities.get(target),
      insert: inserts.get(target),
    });
    const transaction = jest.fn(
      async (run: (manager: unknown) => Promise<void>) =>
        run({ getRepository: repo }),
    );
    const dataSource = {
      getRepository: repo,
      transaction,
    } as unknown as DataSource;
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-access-token'),
    } as unknown as JwtService;
    const rateLimit = {
      assertRegistrationAllowed: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuthRateLimitService;
    const config = {
      get: jest.fn((_key: string, fallback: number) => fallback),
    } as unknown as ConfigService;
    const otp = {} as OtpDeliveryProvider;
    const service = new AuthService(dataSource, jwt, rateLimit, otp, config);

    const result = await service.register(registerInput, '127.0.0.1');
    const user = entities.get(User)?.mock.results[0]?.value as User;
    const session = entities.get(AuthSession)?.mock.results[0]
      ?.value as AuthSession;

    expect(user.phone).toBe('+923001234567');
    expect(user.email).toBe('rider@example.com');
    expect(user.phoneVerifiedAt).toBeNull();
    expect(await argon2.verify(user.passwordHash, registerInput.password)).toBe(
      true,
    );
    expect(user.passwordHash).not.toBe(registerInput.password);
    expect(session.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.accessToken).toBe('signed-access-token');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.phoneVerified).toBe(false);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a refresh token if another request already rotated it', async () => {
    const sessionId = '123e4567-e89b-42d3-a456-426614174000';
    const secret = 'a'.repeat(43);
    const session = {
      id: sessionId,
      userId: 'user-id',
      refreshTokenHash: createHash('sha256').update(secret).digest('hex'),
      user: { id: 'user-id', status: UserStatus.ACTIVE },
    };
    const query = {
      addSelect: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(session),
    };
    const update = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const auditInsert = jest.fn();
    const manager = {
      getRepository: jest.fn((target: unknown) =>
        target === AuthSession
          ? { createQueryBuilder: () => update }
          : { insert: auditInsert },
      ),
    };
    const dataSource = {
      getRepository: () => ({ createQueryBuilder: () => query }),
      transaction: (run: (value: unknown) => Promise<unknown>) => run(manager),
    } as unknown as DataSource;
    const signAsync = jest.fn();
    const jwt = { signAsync } as unknown as JwtService;
    const rateLimit = {
      assertLoginAllowed: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuthRateLimitService;
    const config = {
      get: jest.fn((_key: string, fallback: number) => fallback),
    } as unknown as ConfigService;
    const otp = {} as OtpDeliveryProvider;
    const service = new AuthService(dataSource, jwt, rateLimit, otp, config);

    await expect(
      service.refresh({ refreshToken: `${sessionId}.${secret}` }, '127.0.0.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(update.execute.mock.calls).toHaveLength(1);
    expect(auditInsert.mock.calls).toHaveLength(0);
    expect(signAsync.mock.calls).toHaveLength(0);
  });
});
