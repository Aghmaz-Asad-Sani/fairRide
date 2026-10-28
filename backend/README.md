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
- Readiness check: `GET /api/v1/health/ready` (PostgreSQL).
- PostgreSQL/PostGIS local container is optional if PostgreSQL is installed.
- Environment validation, request validation, Helmet, explicit CORS origins,
  and structured Pino HTTP logging with sensitive fields redacted.
- Passenger/driver signup, password login, access-token sessions, single-use
  refresh rotation, logout, logout-all, and current-account lookup.
- Argon2id password hashes, Pakistan mobile normalization, role/status data,
  hashed refresh-token storage, server-side session revocation, PostgreSQL-backed
  login/register rate limits, and security audit events.
- Phone OTP challenge and verification endpoints, using a development-only
  code-return adapter (no SMS provider is configured).
- Driver profile/vehicle onboarding, admin verification, location and
  availability controls.
- SUPER_ADMIN dashboard APIs for account status, driver/vehicle review, ride
  search, operational metrics, and editable fare settings.
- Server-side fare estimates, bounded PostGIS driver matching, expiring offer
  acceptance, and ride request/arrival/start/complete/cancel/history endpoints.
- Authenticated Socket.IO ride rooms, offer notifications, lifecycle events,
  and private active-trip driver location events (single-instance only).
- Versioned identity, driver/vehicle, ride/offer, OTP-challenge, audit,
  PostgreSQL rate-limit, and admin fare-setting schema migrations.

## Requirements

- Node.js 22 or newer (Node.js 24 LTS recommended).
- npm.
- PostgreSQL 16 with PostGIS, installed locally or run with optional Docker
  Compose.

## Run locally

From this directory, create the local environment file. Docker Compose is
optional if PostgreSQL is not already installed locally:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Optional if PostgreSQL is not already installed locally:
docker compose up -d postgres
# Add JWT_ACCESS_SECRET to .env with a fresh random value (see below).
npm ci
npm run migration:run
npm run start:dev
```

If using a local PostgreSQL installation, install the matching PostGIS
extension package (for Windows, use StackBuilder for that PostgreSQL version)
before running migrations.

### Local OSRM routing with WSL

The API includes an OSRM client. To run a local Pakistan routing server, use
Ubuntu under WSL. Install Docker Engine and Compose in Ubuntu (Docker Desktop
is not required). The Pakistan map extract and generated OSRM files are large
and are ignored by Git.

In Ubuntu, install Docker if it is not installed:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
```

From the repository's `backend` directory, run:

```bash
set -e
mkdir -p docker/osrm/data
curl -fL https://download.geofabrik.de/asia/pakistan-latest.osm.pbf \
  -o docker/osrm/data/pakistan-latest.osm.pbf
sudo docker run --rm -t \
  -v "$PWD/docker/osrm/data:/data" \
  osrm/osrm-backend:v5.25.0 \
  osrm-extract -p /opt/car.lua /data/pakistan-latest.osm.pbf
sudo docker run --rm -t \
  -v "$PWD/docker/osrm/data:/data" \
  osrm/osrm-backend:v5.25.0 \
  osrm-partition /data/pakistan-latest.osrm
sudo docker run --rm -t \
  -v "$PWD/docker/osrm/data:/data" \
  osrm/osrm-backend:v5.25.0 \
  osrm-customize /data/pakistan-latest.osrm
sudo docker compose --profile routing up -d osrm
```

Processing the full Pakistan map can take a while and needs sufficient Docker
memory and free disk space.

In the backend directory's `.env` file (repo path `backend/.env`), set these
values. Replace existing routing values rather than adding duplicate keys;
the file must contain environment assignments, not shell commands:

```dotenv
ROUTING_PROVIDER=osrm
ROUTING_BASE_URL=http://localhost:5000
```

Check the router from Ubuntu with
`curl "http://localhost:5000/route/v1/driving/67.001,24.86;67.03,24.88?overview=false"`.
Expect JSON with `"code":"Ok"` and a route distance in meters. Restart the
backend after changing `.env`. To stop the router, run
`sudo docker compose --profile routing stop osrm`. The default development provider
remains a marked straight-line estimate; OSRM is only used when explicitly
configured. After a Windows restart, open Ubuntu to start its systemd Docker
daemon and the `unless-stopped` OSRM container.

For Google traffic-aware routes instead, enable billing and the Routes API in
Google Cloud, create a restricted server key, then set
`ROUTING_PROVIDER=google_maps` and `GOOGLE_ROUTES_API_KEY` in `backend/.env`.
The server key must stay private and must not be copied into the mobile app.
Set Google Cloud quotas and budget alerts before testing; the mobile Google Maps
SDK keys are separate credentials.

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

`DATABASE_PASSWORD` in `.env.example` is a local-only example; use unique
credentials in shared or production environments. Do not commit `.env`.
The readiness endpoint requires PostgreSQL only; the included unit and HTTP
end-to-end tests use local doubles and can run without Docker.

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

Ride estimates and requests support routes up to 1,400 km by default. Set
`RIDE_MAX_DISTANCE_KM` in `.env` to change the server-side limit. The admin
Fare settings page manages separate Economy, Comfort, and XL car rates, plus
independent bike and rickshaw rates. Car distance fares use the
current manually entered petrol price and class fuel efficiency:
`fuel price per litre / km per litre + other cost per km`. Set a positive
current petrol price in Admin before requesting car fare estimates. Initial
fuel-efficiency values (12 km/L Economy, 10 Comfort, 8 XL) are examples and
should be adjusted to match the fleet. Bike and rickshaw start at the existing
shared rates until an administrator changes them.

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

Authentication rate limits are stored in PostgreSQL. Run the
`CreateAuthRateLimits` migration with the other database migrations; Redis is
not required.

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

There is no real SMS provider, secure document image storage/identity-verification
service, continuous rematching worker, multi-instance Socket.IO scale-out,
online payment or payout ledger, ratings, or safety/support workflow. The admin
dashboard reviews submitted metadata only; it does not receive private document
images. In
development, set `OTP_DEV_RETURN_CODE=true` to include the code in the OTP
response. This flag is rejected in production. The development routing provider
is a marked straight-line approximation; production startup requires either
`ROUTING_PROVIDER=osrm` with `ROUTING_BASE_URL`, or `ROUTING_PROVIDER=google_maps`
with `GOOGLE_ROUTES_API_KEY`. Starting the application and passing readiness
checks requires PostgreSQL.
