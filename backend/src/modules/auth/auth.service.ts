import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { DataSource, IsNull, QueryFailedError } from 'typeorm';
import { AuditLog } from '../../database/audit-log.entity';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AuthSession } from './auth-session.entity';
import { AuthTokens, AuthenticatedUser, SafeUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { normalizePakistanPhone } from './phone-number';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { PhoneOtpChallenge } from './otp-challenge.entity';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';
import { OtpDeliveryProvider } from './otp-delivery.provider';

@Injectable()
export class AuthService {
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlDays: number;
  private readonly otpCodeTtlSeconds: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly otpDelivery: OtpDeliveryProvider,
    config: ConfigService,
  ) {
    this.accessTokenTtlSeconds = config.get<number>(
      'JWT_ACCESS_TTL_SECONDS',
      900,
    );
    this.refreshTokenTtlDays = config.get<number>('JWT_REFRESH_TTL_DAYS', 30);
    this.otpCodeTtlSeconds = config.get<number>('OTP_CODE_TTL_SECONDS', 300);
  }

  async requestPhoneOtp(userId: string): Promise<{
    challengeId: string;
    expiresAt: Date;
    developmentCode?: string;
  }> {
    await this.rateLimit.assertLoginAllowed('otp:user', userId);
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId, status: UserStatus.ACTIVE },
    });
    if (!user) {
      throw new UnauthorizedException('Account is unavailable');
    }
    if (user.phoneVerifiedAt) {
      throw new ConflictException('Phone number is already verified');
    }
    const normalizedCode = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await argon2.hash(normalizedCode, {
      type: argon2.argon2id,
    });
    const now = new Date();
    const challenge = this.dataSource.getRepository(PhoneOtpChallenge).create({
      id: randomUUID(),
      userId,
      codeHash,
      expiresAt: new Date(now.getTime() + this.otpCodeTtlSeconds * 1000),
      attempts: 0,
      consumedAt: null,
    });
    const delivery = await this.otpDelivery.deliver(user.phone, normalizedCode);
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(PhoneOtpChallenge)
        .update({ userId, consumedAt: IsNull() }, { consumedAt: now });
      await manager.getRepository(PhoneOtpChallenge).insert(challenge);
      await manager.getRepository(AuditLog).insert({
        actorId: userId,
        eventType: 'auth.phone_otp_requested',
        targetId: userId,
        metadata: { challengeId: challenge.id },
      });
    });
    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      ...delivery,
    };
  }

  async verifyPhoneOtp(
    userId: string,
    input: VerifyPhoneOtpDto,
  ): Promise<{ phoneVerified: true }> {
    await this.rateLimit.assertLoginAllowed('otp:verify', userId);
    const verified = await this.dataSource.transaction(async (manager) => {
      const challenge = await manager
        .getRepository(PhoneOtpChallenge)
        .createQueryBuilder('challenge')
        .addSelect('challenge.codeHash')
        .setLock('pessimistic_write')
        .where('challenge.id = :challengeId', {
          challengeId: input.challengeId,
        })
        .andWhere('challenge.userId = :userId', { userId })
        .andWhere('challenge.consumedAt IS NULL')
        .getOne();
      if (
        !challenge ||
        challenge.expiresAt <= new Date() ||
        challenge.attempts >= 5
      ) {
        throw new UnauthorizedException('OTP challenge is invalid or expired');
      }

      const valid = await argon2.verify(challenge.codeHash, input.code);
      if (!valid) {
        challenge.attempts += 1;
        if (challenge.attempts >= 5) {
          challenge.consumedAt = new Date();
        }
        await manager.getRepository(PhoneOtpChallenge).save(challenge);
        return false;
      }

      const now = new Date();
      const update = await manager
        .getRepository(User)
        .update(
          { id: userId, status: UserStatus.ACTIVE, phoneVerifiedAt: IsNull() },
          { phoneVerifiedAt: now },
        );
      if (update.affected !== 1) {
        throw new ConflictException('Phone number is already verified');
      }
      challenge.consumedAt = now;
      await manager.getRepository(PhoneOtpChallenge).save(challenge);
      await manager
        .getRepository(PhoneOtpChallenge)
        .update({ userId, consumedAt: IsNull() }, { consumedAt: now });
      await manager.getRepository(AuditLog).insert({
        actorId: userId,
        eventType: 'auth.phone_verified',
        targetId: userId,
        metadata: { challengeId: challenge.id },
      });
      return true;
    });
    if (!verified) {
      throw new UnauthorizedException('OTP challenge is invalid or expired');
    }
    return { phoneVerified: true };
  }

  async register(input: RegisterDto, clientIp: string): Promise<AuthTokens> {
    await this.rateLimit.assertRegistrationAllowed(clientIp);
    const phone = normalizePakistanPhone(input.phone);
    const email = input.email?.trim().toLowerCase() ?? null;
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const userId = randomUUID();
    const sessionId = randomUUID();
    const refreshToken = this.createRefreshToken(sessionId);
    const now = new Date();
    const user = this.dataSource.getRepository(User).create({
      id: userId,
      name: input.name.trim(),
      phone,
      phoneVerifiedAt: null,
      email,
      passwordHash,
      role: input.role ?? UserRole.PASSENGER,
      status: UserStatus.ACTIVE,
    });
    const session = this.createSession(sessionId, userId, refreshToken, now);
    const accessToken = await this.createAccessToken(user, sessionId);

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(User).insert(user);
        await manager.getRepository(AuthSession).insert(session);
        await manager.getRepository(AuditLog).insert({
          actorId: userId,
          eventType: 'auth.registered',
          targetId: userId,
          metadata: { role: user.role },
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this phone number or email already exists',
        );
      }
      throw error;
    }

    return this.tokensResponse(accessToken, refreshToken, user);
  }

  async login(input: LoginDto, clientIp: string): Promise<AuthTokens> {
    await this.rateLimit.assertLoginAllowed('login:ip', clientIp);
    const identifier = input.identifier.trim();
    const isEmail = identifier.includes('@');
    const normalizedIdentifier = isEmail
      ? identifier.toLowerCase()
      : normalizePakistanPhone(identifier);
    await this.rateLimit.assertLoginAllowed(
      'login:identifier',
      normalizedIdentifier,
    );
    const user = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where(
        isEmail
          ? 'lower(user.email) = :identifier'
          : 'user.phone = :identifier',
        { identifier: normalizedIdentifier },
      )
      .getOne();

    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    this.assertActive(user);

    const now = new Date();
    const sessionId = randomUUID();
    const refreshToken = this.createRefreshToken(sessionId);
    const session = this.createSession(sessionId, user.id, refreshToken, now);
    const accessToken = await this.createAccessToken(user, sessionId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(AuthSession).insert(session);
      await manager.getRepository(AuditLog).insert({
        actorId: user.id,
        eventType: 'auth.logged_in',
        targetId: user.id,
        metadata: { sessionId },
      });
    });

    return this.tokensResponse(accessToken, refreshToken, user);
  }

  async refresh(input: RefreshTokenDto, clientIp: string): Promise<AuthTokens> {
    await this.rateLimit.assertLoginAllowed('refresh:ip', clientIp);
    const [sessionId, secret, ...extra] = input.refreshToken.split('.');
    if (
      !sessionId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        sessionId,
      ) ||
      !secret ||
      !/^[A-Za-z0-9_-]{43}$/.test(secret) ||
      extra.length > 0
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.rateLimit.assertLoginAllowed('refresh:session', sessionId);

    const session = await this.dataSource
      .getRepository(AuthSession)
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .innerJoinAndSelect('session.user', 'user')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > :now', { now: new Date() })
      .getOne();

    if (
      !session ||
      !session.user ||
      !this.matchesHash(secret, session.refreshTokenHash)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    this.assertActive(session.user);

    const now = new Date();
    const nextRefreshToken = this.createRefreshToken(session.id);
    const nextHash = this.hashToken(nextRefreshToken.split('.')[1]);
    const nextExpiry = this.refreshExpiry(now);

    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(AuthSession)
        .createQueryBuilder()
        .update(AuthSession)
        .set({
          refreshTokenHash: nextHash,
          lastUsedAt: now,
          expiresAt: nextExpiry,
        })
        .where('id = :id', { id: session.id })
        .andWhere('refresh_token_hash = :refreshTokenHash', {
          refreshTokenHash: session.refreshTokenHash,
        })
        .andWhere('revoked_at IS NULL')
        .andWhere('expires_at > :now', { now })
        .execute();

      if (result.affected !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await manager.getRepository(AuditLog).insert({
        actorId: session.userId,
        eventType: 'auth.session_refreshed',
        targetId: session.userId,
        metadata: { sessionId: session.id },
      });
    });

    const accessToken = await this.createAccessToken(session.user, session.id);
    return this.tokensResponse(accessToken, nextRefreshToken, session.user);
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(AuthSession)
        .update(
          { id: user.sessionId, userId: user.id, revokedAt: IsNull() },
          { revokedAt: now },
        );
      await manager.getRepository(AuditLog).insert({
        actorId: user.id,
        eventType: 'auth.logged_out',
        targetId: user.id,
        metadata: { sessionId: user.sessionId },
      });
    });
  }

  async logoutAll(user: AuthenticatedUser): Promise<void> {
    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(AuthSession)
        .update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: now });
      await manager.getRepository(AuditLog).insert({
        actorId: user.id,
        eventType: 'auth.all_sessions_revoked',
        targetId: user.id,
        metadata: {},
      });
    });
  }

  async currentUser(userId: string): Promise<SafeUser> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('Account is unavailable');
    }
    this.assertActive(user);
    return this.toSafeUser(user);
  }

  private createSession(
    id: string,
    userId: string,
    refreshToken: string,
    now: Date,
  ): AuthSession {
    return this.dataSource.getRepository(AuthSession).create({
      id,
      userId,
      refreshTokenHash: this.hashToken(refreshToken.split('.')[1]),
      expiresAt: this.refreshExpiry(now),
      lastUsedAt: now,
      revokedAt: null,
    });
  }

  private async createAccessToken(
    user: User,
    sessionId: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: user.id, sessionId },
      { expiresIn: this.accessTokenTtlSeconds },
    );
  }

  private createRefreshToken(sessionId: string): string {
    return `${sessionId}.${randomBytes(32).toString('base64url')}`;
  }

  private hashToken(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private matchesHash(secret: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hashToken(secret), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private refreshExpiry(from: Date): Date {
    return new Date(
      from.getTime() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );
  }

  private assertActive(user: User): void {
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not active');
    }
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      phoneVerified: user.phoneVerifiedAt !== null,
      email: user.email,
      role: user.role,
      status: user.status,
      preferredLanguage: user.preferredLanguage,
      profileImageUrl: user.profileImageUrl,
      createdAt: user.createdAt,
    };
  }

  private tokensResponse(
    accessToken: string,
    refreshToken: string,
    user: User,
  ): AuthTokens {
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenTtlSeconds,
      user: this.toSafeUser(user),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError: unknown = error.driverError;
    return (
      typeof driverError === 'object' &&
      driverError !== null &&
      'code' in driverError &&
      driverError.code === '23505'
    );
  }
}
