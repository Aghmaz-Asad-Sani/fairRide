# Database notes

## Local PostgreSQL

FairRide requires PostgreSQL with the PostGIS extension available. The driver
and ride schema migration enables `postgis`; the extension package must first
be installed for your PostgreSQL version. Docker Compose uses PostgreSQL 16
with PostGIS 3.4 and persists data in the `postgres_data` volume. The
container port is bound to `127.0.0.1` only. Connection settings are in `.env`.

## Schema management

TypeORM is configured with `synchronize: false`. Do not enable automatic
schema synchronization in development or production. Add reviewed,
versioned TypeORM migrations as domain entities are introduced. Schema changes
must be safely deployable and consider existing data.

The identity migration creates:

- `users`: normalized unique Pakistan phone, optional case-insensitive unique
  email, Argon2id hash, role/status, nullable phone-verification timestamp, and
  minimal profile fields.
- `auth_sessions`: refresh-token hash, expiry, last use, and revocation
  timestamp; deleting a user cascades its sessions.
- `audit_logs`: security event type, actor/target identifiers, and structured
  metadata. Application code must not put secrets or OTPs in audit metadata.

The current domain migrations also create:

- `auth_rate_limits`: hashed authentication identifiers, atomic request counts,
  and fixed-window expiries for login/registration abuse prevention.
- `phone_otp_challenges`: one-time phone verification challenge hashes,
  expiration, consumption, and failed-attempt tracking.
- `driver_profiles`: license metadata, approval state, online/available flags,
  and the driver's latest private location.
- `vehicles`: driver-owned vehicle metadata, category, approval, and document
  expiry.
- `rides`: passenger/driver assignment, coordinate and label snapshots,
  lifecycle timestamps, fare in PKR paisa, and encrypted pickup PIN.
- `ride_offers`: bounded, expiring driver offers with status and pickup
  distance.

Migrations add database constraints and indexes for active-ride uniqueness,
offer expiry, and PostGIS proximity queries. The database stores document
metadata only, not document files. Ride/payment history retention and
precise-location retention still need operational policy.

Run `npm run migration:show` to inspect pending migrations and
`npm run migration:run` to apply them. Use `npm run migration:revert` only when
the schema/data rollback is understood and intended.

## Spatial and retention guidance

Use PostGIS `geography` points with a GiST index for radius and distance
queries. Verify query plans on representative data and keep radius and result
count bounded. Avoid indefinite retention of precise driver location history;
document purpose, access controls, and deletion/retention rules before storing
it.

Store timestamps in UTC. Use integer minor-unit columns (for PKR, paisa) for
money. Add foreign keys, uniqueness, checks, and query-oriented indexes with
the relevant migrations.

## Local database commands

```powershell
docker compose up -d postgres
docker compose logs postgres
docker compose down
```

`docker compose down` preserves named volumes. Removing volumes destroys local
database/cache state; do not use volume-removal flags unless that data is
intentionally disposable.
