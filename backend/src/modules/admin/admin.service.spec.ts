import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DriverService } from '../drivers/driver.service';
import { RideRealtimeGateway } from '../rides/ride-realtime.gateway';
import { UserRole, UserStatus } from '../users/user.entity';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const actor: AuthenticatedUser = {
    id: 'actor-id',
    role: UserRole.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    sessionId: 'session-id',
  };

  it('prevents an admin from suspending their own account', async () => {
    const transaction = jest.fn();
    const dataSource = {
      transaction,
    } as unknown as DataSource;
    const service = new AdminService(
      dataSource,
      {} as unknown as DriverService,
      {} as unknown as ConfigService,
      { emitRideStatus: jest.fn() } as unknown as RideRealtimeGateway,
    );

    await expect(
      service.setUserStatus(actor, actor.id, UserStatus.SUSPENDED),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('protects other super-admin accounts from status changes', async () => {
    const repository = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 'other-admin', role: UserRole.SUPER_ADMIN }),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(repository),
    };
    const dataSource = {
      transaction: jest.fn(
        (callback: (transaction: typeof manager) => Promise<unknown>) =>
          callback(manager),
      ),
    } as unknown as DataSource;
    const service = new AdminService(
      dataSource,
      {} as unknown as DriverService,
      {} as unknown as ConfigService,
      { emitRideStatus: jest.fn() } as unknown as RideRealtimeGateway,
    );

    await expect(
      service.setUserStatus(actor, 'other-admin', UserStatus.SUSPENDED),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
