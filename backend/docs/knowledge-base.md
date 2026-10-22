# FairRide backend knowledge base

## Product and delivery scope

FairRide is an original, modular-monolith ride-hailing platform intended first
for Pakistan. It aims for transparent fares, clear driver earnings, privacy,
and auditable ride/payment state. It must not reproduce competitor branding,
private implementations, or proprietary systems.

The attached implementation brief is organized into phases. Implement and
verify one phase at a time. The repository contains the Phase 1 foundation,
core identity flows, driver onboarding and review, fare estimation, nearby
matching, and the initial ride lifecycle. OTP verification is wired to a
development-only adapter; real SMS delivery, account recovery/deletion,
payments, realtime dispatch, and production operations remain incomplete.

## Current architecture

- **Runtime:** Node.js 22+, NestJS 11, strict TypeScript.
- **API:** REST under `/api/v1`; Swagger UI at `/api/docs`.
- **Project handbook:** public, responsive page at `/knowledge-base` with
  business/operations and technical views and an English/Roman Urdu toggle.
- **Persistence:** PostgreSQL 16 with PostGIS; TypeORM configured with schema
  synchronization disabled. Use versioned migrations for every schema change.
- **Rate limiting:** atomic, expiring authentication counters stored in
  PostgreSQL; Redis is not required.
- **Validation and security:** class-validator/class-transformer `ValidationPipe`
  (whitelist, reject unknown fields, transform); Helmet; explicit CORS origins.
- **Logging:** Pino HTTP request logging; authorization, cookie, password, OTP,
  code, trip PIN, and refresh-token fields are redacted.
- **Local infrastructure:** PostgreSQL/PostGIS can run locally or through the
  optional Docker Compose PostgreSQL service.
- **Current routes:** health, auth, driver onboarding/review, pricing, matching,
  and ride lifecycle endpoints documented in [the API overview](api.md).
- **Identity:** Argon2id password hashes; Pakistan mobile E.164 normalization;
  JWT access tokens checked against active server-side sessions; opaque random
  rotating refresh tokens stored as SHA-256 hashes. Public registration is
  restricted to passenger/driver roles. OTP challenges are hashed, expire, and
  track failed attempts. The development delivery adapter is opt-in and returns
  a code only in development; there is no production SMS adapter.
- **Rate limiting:** PostgreSQL atomic upserts limit login by client IP and
  normalized account identifier and registration by client IP. Counters use
  fixed expiry windows and expired rows are cleaned in bounded batches.
- **Schema:** identity/audit, driver/vehicle, ride/offer, and OTP challenge
  tables are introduced by versioned TypeORM migrations.
- **Driver operations:** profile and vehicle document metadata, super-admin
  review, location freshness, and availability gates are implemented.
- **Pricing/matching:** fares are calculated in integer paisa from configured
  rules and a routing provider boundary. Nearby-driver candidates use bounded
  PostGIS queries; active offers expire and driver assignment is transactional.
- **Vehicle matching:** vehicles and ride requests distinguish `CAR`, `BIKE`,
  and `RICKSHAW` from the existing `ECONOMY`, `COMFORT`, and `XL` fare class.
  Legacy clients default to `CAR`; bike and rickshaw rides use `ECONOMY`.
  Matching requires an approved vehicle of the requested type and category,
  with a default pickup radius of 4 km.
- **Ride lifecycle:** idempotent cash ride request, offer accept/reject,
  arrival, pickup-PIN start, completion, cancellation, and paginated history
  are implemented.
- **Realtime (single instance):** authenticated Socket.IO connections, active
  session checks, participant-only ride rooms, offer notices, ride status
  events, and driver location updates during an assigned active trip exist.
  Redis scale-out, event replay, and mobile reconnection/resync remain.
- **Integration direction:** Socket.IO for live updates, self-hosted
  OSRM-compatible routing, cash plus Safepay online payments, and a selectable
  SMS vendor behind the OTP provider boundary. These are product decisions;
  the production integrations are not yet implemented.

The readiness route reports whether PostgreSQL responds. Liveness is
intentionally independent of the database. The API opens the PostgreSQL
connection during startup, so PostgreSQL must be available to start the
complete Nest application.

## Code organization

Feature code belongs under `src/modules/<feature>`. Keep modules cohesive and
dependencies explicit. Shared cross-cutting behavior belongs in common/config
areas only when a real second use exists. Proposed domains include auth, users,
drivers, vehicles, location, maps, pricing, ride requests, matching, rides,
payments, ledger, ratings, safety, support, admin, analytics, realtime, and jobs.

Do not create empty modules or pretend an integration is operational. For an
external provider, define a provider boundary, supply a safe local adapter only
when meaningful, and document production setup and failure behavior.

## Design invariants for upcoming work

### Identity and access

- Normalize Pakistan phone numbers consistently before uniqueness checks.
- Store passwords only as Argon2id hashes; never log credentials or OTP values.
- Keep access tokens short-lived; rotate and revoke refresh sessions server-side.
- Do not allow public registration to select support/admin/super-admin roles.
- Re-check account status and session revocation when authenticating requests.
- Enforce role and resource-ownership checks on the server for every private
  resource. Do not expose other drivers' or passengers' private data.
- A development OTP adapter must be explicitly disabled in production.
- Require verified phone numbers before enabling ride requests; registration
  alone does not verify phone ownership.
- Store the minimum personal information necessary. Keep sensitive-document
  bytes in a protected storage service, not ordinary application tables.

### Geographic data and location privacy

- Validate latitude in `[-90, 90]`, longitude in `[-180, 180]`, timestamps,
  accuracy, and freshness at the boundary.
- Use PostGIS spatial indexes and bounded geography queries for nearby-driver
  lookup; never scan every driver in application memory.
- Keep fast-changing location ephemeral when possible. Define retention and
  restrict access before persisting location history.
- Return only coarse/minimum driver details to passengers. Do not broadcast
  precise driver coordinates to arbitrary clients.

### Money and pricing

- Represent PKR using integer paisa minor units; never use JavaScript floating
  point arithmetic for fares, commissions, wallet balances, or ledger values.
- Calculate fares from trusted server-side routing data, not client-supplied
  distance or totals. Return an itemized estimate and distinguish it from the
  final fare.
- Version and audit fare/commission rules; expose deductions and driver net
  earnings clearly.
- Make financial ledger entries immutable and financial operations
  transactional/idempotent. Derive or update balances consistently.
- Payment providers are integrations, not simulated success callbacks. Never
  store card data or trust client-reported payment success.

### Ride state and concurrency

- Keep ride state transitions explicit and validated on the server.
- Store authoritative ride state in PostgreSQL. Treat sockets and cache as
  delivery/acceleration mechanisms only.
- Assignment must be atomic (transaction plus lock or conditional update) so
  exactly one eligible driver can accept a ride.
- Use idempotency keys for request creation and critical financial/lifecycle
  operations. Record actor and timestamps for meaningful transitions.
- Bound matching radius, retries, offer expiry, and query results.
- Apply the `AddVehicleTypeAndFourKmMatching` database migration before
  deploying the vehicle-type API. Set `DRIVER_MATCH_RADIUS_METERS=4000` in the
  runtime environment if the four-kilometre default must be explicit.
- Define measurable fairness metrics before claiming the matching process is
  fair; evaluate opportunity distribution and cancellation/reliability effects
  against real pilot data.

### External services and safety

- Public OSM endpoints are not unlimited production geocoding/routing/tile
  services. Choose and configure a licensed or self-hosted provider.
- OTP, push, email, payment, maps, and object storage need explicit production
  credentials, timeouts, bounded retries, and failure handling.
- Do not claim an SOS endpoint contacts emergency responders without a real,
  authorized operational integration.
- Restrict sensitive support/safety/admin data and audit staff access.

## Configuration

Copy `.env.example` to `.env` for local use. Application startup validates the
environment. Required values include a database password. Keep
secrets out of source, logs, issue reports, and client responses. Production
configuration must use a managed secret store and unique credentials.

`CORS_ORIGINS` is a comma-separated allowlist. An empty value disables
cross-origin access; do not replace it with a wildcard for credentialed API
calls.

## Local development and checks

From `backend/`:

```powershell
Copy-Item .env.example .env
# Optional if PostgreSQL is not already installed locally:
docker compose up -d postgres
npm ci
npm run start:dev
```

Check the implementation with:

```powershell
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test -- --runInBand
npm run test:e2e
```

The health-controller unit tests do not require Docker. The health endpoint
and auth endpoint e2e tests use dependency doubles; they test HTTP wiring but
do not replace database integration tests. Auth routes require migrated
PostgreSQL and a generated `JWT_ACCESS_SECRET` to run end-to-end locally.

## Planned phased build

1. **Foundation (implemented):** configuration, PostgreSQL/PostGIS,
   request/HTTP security defaults, logging, Swagger, health routes.
2. **Identity/security (partial):** users, identity migration, Argon2id
   password auth, role/status scaffolding, rotating/revocable sessions,
   PostgreSQL-backed login/registration rate limits, and security audit events.
   Remaining: OTP provider and verification, account recovery/deletion,
   user-management/role administration, richer audit access controls, and
   database-backed auth integration/concurrency tests.
3. **Drivers (partial):** profile and vehicle metadata, availability, location,
   and super-admin verification routes. Protected document storage and
   identity-provider checks remain.
4. **Maps/pricing (partial):** configurable integer-paisa estimates and an
   OSRM-compatible routing boundary. Development uses only a marked
   straight-line estimate; no routing service is configured by default.
5. **Ride requests/matching (partial):** idempotent ride creation, bounded
   PostGIS candidates, expiring offers, atomic assignment, cancellation, and
   lifecycle operations. A worker for continuous retry/rematching is absent.
6. **Trip/realtime (partial):** pickup PIN and authenticated Socket.IO rooms,
   status/offer/location events exist for a single instance. Redis scale-out,
   event replay, client reconnect/resync, and production load tests remain.
7. **Payments/community/safety (planned):** cash-only trips exist; Safepay
   checkout/webhooks, payment ledger, refunds, payout, ratings, incidents, and
   support workflows are not implemented.
8. **Operations (planned):** bootstrap-only super-admin setup exists; scoped
   admin console, analytics, and recovery runbooks remain.

Update this document at the end of each phase. Only mark a feature implemented
when source code and relevant tests are present.

## Production readiness gaps

Before production, implement and validate the applicable feature phases,
review dependencies, configure real provider adapters, establish secret
rotation, backups and restore drills, retention/deletion policies, operational
alerts, rate limits, and incident response. Review local regulatory and
provider requirements in Pakistan for payment collection, wallet balances,
cash-out and driver payouts. Do not imply certification or penetration testing
without evidence.
