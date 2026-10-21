import 'dotenv/config';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { User, UserRole, UserStatus } from '../modules/users/user.entity';
import { normalizePakistanPhone } from '../modules/auth/phone-number';
import dataSource from './data-source';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

async function bootstrapSuperAdmin(source: DataSource): Promise<void> {
  const phone = normalizePakistanPhone(required('SUPER_ADMIN_PHONE'));
  const password = required('SUPER_ADMIN_PASSWORD');
  const name = required('SUPER_ADMIN_NAME');
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? null;
  if (password.length < 16 || password.length > 128) {
    throw new Error('SUPER_ADMIN_PASSWORD must be 16-128 characters');
  }
  if (name.length > 100 || name.length === 0) {
    throw new Error('SUPER_ADMIN_NAME must be 1-100 characters');
  }

  await source.initialize();
  try {
    const existing = await source.getRepository(User).findOne({
      where: [{ phone }, ...(email ? [{ email }] : [])],
    });
    if (existing) {
      throw new Error(
        'An account with this phone or email already exists; bootstrap never elevates or overwrites existing accounts',
      );
    }
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    const user = source.getRepository(User).create({
      id: randomUUID(),
      name,
      phone,
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      phoneVerifiedAt: new Date(),
    });
    await source.transaction(async (manager) => {
      await manager.getRepository(User).insert(user);
      await manager.getRepository(AuditLog).insert({
        actorId: user.id,
        eventType: 'admin.super_admin_bootstrapped',
        targetId: user.id,
        metadata: { source: 'explicit_cli_bootstrap' },
      });
    });
    console.log(`Created initial super-admin account ${user.id}.`);
  } finally {
    await source.destroy();
  }
}

void bootstrapSuperAdmin(dataSource).catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Unknown bootstrap failure';
  console.error(`Super-admin bootstrap failed: ${message}`);
  process.exitCode = 1;
});
