# Deployment checklist

This is a checklist for future deployment work, not evidence that FairRide is
production ready.

## Before deploying

- [ ] Implement and test required application phases and database migrations.
- [ ] Use supported Node.js LTS and a reviewed, locked dependency tree.
- [ ] Provide PostgreSQL through private networking with TLS and dedicated
  credentials.
- [ ] Configure secrets through a managed secret store; rotate credentials.
- [ ] Set exact `CORS_ORIGINS`, `NODE_ENV=production`, and an appropriate
  `LOG_LEVEL`; do not expose `.env`.
- [ ] Configure approved providers for SMS/OTP, maps/routes, payments,
  notifications, and protected document storage as required by enabled features.
- [ ] Configure Safepay sandbox and live credentials separately; verify
  webhook signatures, retries, idempotency, refunds and reconciliation before
  enabling online payment.
- [ ] Deploy and monitor a licensed/self-hosted OSRM-compatible routing
  service; do not rely on a public demo endpoint.
- [ ] Configure Socket.IO transport through the reverse proxy, deploy the
  shared Redis adapter before running multiple API instances, and verify
  authorization, reconnect/resync, origin allowlists and load limits.
- [ ] Establish request/operation rate limits, timeouts, bounded retries, and
  alerting.
- [ ] Apply the `CreateAuthRateLimits` migration. Authentication rate limits
  are stored atomically in PostgreSQL; Redis is not required.
- [ ] Run migrations as a controlled deployment step; keep TypeORM
  synchronization disabled.
- [ ] Apply migration `AddVehicleTypeAndFourKmMatching` before deploying
  clients that select car, bike, or rickshaw. Set
  `DRIVER_MATCH_RADIUS_METERS=4000` to explicitly configure the four-kilometre
  driver pickup radius.
- [ ] Set up encrypted backups, retention, and tested restoration procedures.
- [ ] Define data deletion/retention, privacy access controls, incident
  response, and staff audit procedures.
- [ ] Review payment, wallet, stored-value, and payout requirements with
  qualified local counsel and payment providers for Pakistan.
- [ ] Run build, lint, type-check, unit, integration, and dependency-security
  checks in CI.
- [ ] Verify graceful shutdown, readiness/liveness probes, and database
  connection-pool sizing for deployment capacity.

## Known limits

The app has core authentication, driver onboarding/review, fare estimation,
HTTP ride lifecycle operations, and single-instance authenticated Socket.IO
events, but it is not production-ready. There is no real SMS/OTP delivery
adapter, protected document storage or external identity verification,
continuous rematching worker, multi-instance socket scaling, online payment or
payout ledger, ratings, safety/support workflow, admin console, or operational
alerting. The development OTP and routing adapters are not production
integrations. Do not route real riders or payments to this service until these
gaps are addressed and tested.
