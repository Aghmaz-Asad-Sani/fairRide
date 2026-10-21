# FairRide backend

FairRide is an original ride-hailing backend for Pakistan. This repository is
being built in phases; the current code includes core passenger and driver
flows but is not a complete or production-ready ride-hailing service.

## Implemented so far

- NestJS and strict TypeScript application scaffold.
- Versioned API prefix: `/api/v1`.
- Public project handbook: `/knowledge-base` (stakeholder, operations, and
  technical views with English/Roman Urdu language toggle).
- Swagger UI: `/api/docs`.
- Liveness check: `GET /api/v1/health/live`.
- Readiness check: `GET /api/v1/health/ready` (PostgreSQL and Redis).
- PostgreSQL/PostGIS and password-protected Redis local containers.
- Environment validation, request validation, Helmet, explicit CORS origins,
  and structured Pino HTTP logging with sensitive fields redacted.
- Passenger/driver signup, password login, access-token sessions, single-use
  refresh rotation, logout, logout-all, and current-account lookup.
- Argon2id password hashes, Pakistan mobile normalization, role/status data,
  hashed refresh-token storage, server-side session revocation, Redis-backed
  login/register rate limits, and security audit events.
- Phone OTP challenge and verification endpoints, using a development-only
  code-return adapter (no SMS provider is configured).
- Driver profile/vehicle onboarding, admin verification, location and
  availability controls.
- Server-side fare estimates, bounded PostGIS driver matching, expiring offer
  acceptance, and ride request/arrival/start/complete/cancel/history endpoints.
- Authenticated Socket.IO ride rooms, offer notifications, lifecycle events,
  and private active-trip driver location events (single-instance only).
- Versioned identity, driver/vehicle, ride/offer, OTP-challenge, and audit
  schema migrations.

## Requirements

- Node.js 22 or newer (Node.js 24 LTS recommended).
- npm.
- Docker Desktop with Docker Compose for local PostgreSQL and Redis.

## Run locally

From this directory, create the local environment file and start dependencies:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Add JWT_ACCESS_SECRET to .env with a fresh random value (see below).
docker compose up -d
npm ci
npm run migration:run
npm run start:dev
```

Generate a local signing secret in PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Set the resulting value as `JWT_ACCESS_SECRET` in `.env`. If `.env` already
exists, preserve it and merge the new settings from `.env.example` rather than
overwriting local configuration. Production must use unique secrets from a
managed secret store.

The application listens on port `3000` by default. Check:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health/live
Invoke-RestMethod http://localhost:3000/api/v1/health/ready
```

Open Swagger at <http://localhost:3000/api/docs>.
Open the FairRide project handbook at <http://localhost:3000/knowledge-base>.

`DATABASE_PASSWORD` and `REDIS_PASSWORD` in `.env` are local-only examples;
replace them with unique values and never reuse them in shared or production
environments. Do not commit `.env`.
The app's readiness endpoint requires those Docker services, but the included
unit and HTTP end-to-end tests use local doubles and can run without Docker.

## Development commands

```powershell
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test -- --runInBand
npm run test:e2e
```

## Database and migrations

TypeORM schema synchronization is disabled. Run all versioned migrations after
PostgreSQL starts:

```powershell
npm run migration:show
npm run migration:run
```

PostGIS is installed and enabled by the PostgreSQL initialization script.
Create the first privileged account only through the explicit one-time CLI:

```powershell
$env:SUPER_ADMIN_NAME = "FairRide Admin"
$env:SUPER_ADMIN_PHONE = "+923001234567"
$env:SUPER_ADMIN_PASSWORD = "<unique-strong-password>"
npm run admin:bootstrap
```

Do not use those example values in a real environment. The command refuses to
elevate or overwrite an existing account.

## Documentation

- [Knowledge base](docs/knowledge-base.md): architecture decisions, current
  capabilities, domain invariants, phased implementation guidance, and
  operational/security constraints.
- [Interactive project handbook](http://localhost:3000/knowledge-base):
  non-technical and technical overview, journeys, current feature status,
  operations, architecture, integrations and roadmap.
- [API overview](docs/api.md): currently available endpoints and API conventions.
- [Database notes](docs/database.md): local database setup, PostGIS, and future
  migration/data-retention rules.
- [Deployment checklist](docs/deployment.md): production prerequisites and
  unresolved integrations.

## Important limitations

There is no real SMS provider, document storage/identity-verification service,
continuous rematching worker, Redis Socket.IO scale-out, online payment or
payout ledger, ratings, safety/support workflow, or admin console. In
development, set `OTP_DEV_RETURN_CODE=true` to include the code in the OTP
response. This flag is rejected in production. The development routing provider
is a marked straight-line approximation; production startup requires
`ROUTING_PROVIDER=osrm` and `ROUTING_BASE_URL`. Integrate and validate real
providers before enabling the service for riders. Starting the application and
passing readiness checks requires PostgreSQL and Redis.
