# API overview

All application endpoints use the `/api/v1` prefix. Swagger UI is served at
`/api/docs`. The stakeholder and technical project handbook is served at
`/knowledge-base` (outside the API prefix).

## Health

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health/live` | Process liveness; no dependency checks. |
| GET | `/api/v1/health/ready` | PostgreSQL and Redis readiness; returns 503 if either is unavailable. |

## Authentication

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Create a passenger or driver account and issue a session. |
| POST | `/api/v1/auth/login` | Authenticate with a Pakistan mobile number or email and password. |
| POST | `/api/v1/auth/refresh` | Rotate a one-time refresh token and issue new tokens. |
| POST | `/api/v1/auth/phone/otp/request` | Request phone verification code (Bearer token required). |
| POST | `/api/v1/auth/phone/otp/verify` | Verify phone ownership (Bearer token required). |
| GET | `/api/v1/auth/me` | Get the current account profile (Bearer token required). |
| POST | `/api/v1/auth/logout` | Revoke the current session (Bearer token required). |
| POST | `/api/v1/auth/logout-all` | Revoke all account sessions (Bearer token required). |

Registration accepts only `PASSENGER` or `DRIVER`; privileged roles cannot be
self-assigned. Passwords require 12-128 characters. Mobile numbers are
normalized to Pakistan E.164 format. Refresh tokens rotate on use and are
stored only as hashes on the server. New accounts report `phoneVerified: false`.
OTP challenge and verification logic is implemented, but real SMS delivery is
not. In local development, set `OTP_DEV_RETURN_CODE=true` to include the
one-time code in the response. This setting is rejected in production.

Login is rate limited in Redis by client IP and normalized account identifier;
registration is rate limited by IP. Configure trusted proxy hops correctly
behind a reverse proxy.

## Drivers

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/drivers/profile` | Submit or update driver license details. |
| GET | `/api/v1/drivers/profile` | Get your driver verification profile and vehicles. |
| POST | `/api/v1/drivers/vehicles` | Register a vehicle for verification. |
| GET | `/api/v1/drivers/vehicles` | List your vehicles. |
| PATCH | `/api/v1/drivers/vehicles/:vehicleId/active` | Activate/deactivate your vehicle. |
| POST | `/api/v1/drivers/location` | Update your driver location. |
| PATCH | `/api/v1/drivers/availability` | Set online and offer availability. |
| PATCH | `/api/v1/drivers/admin/:driverId/verification` | Review a driver (SUPER_ADMIN). |
| PATCH | `/api/v1/drivers/admin/vehicles/:vehicleId/verification` | Review a vehicle (SUPER_ADMIN). |

Driver profile and vehicle submissions require super-admin approval before a
driver can go online. The app stores document metadata only; it does not upload
or verify document images. Location is private to the driver and used by
server-side matching.

## Pricing and rides

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/pricing/estimate` | Return a server-priced estimate in PKR paisa. |
| POST | `/api/v1/rides` | Create an idempotent cash ride request; requires `Idempotency-Key`. |
| GET | `/api/v1/rides` | List your paginated ride history. |
| GET | `/api/v1/rides/:rideId` | Get a ride visible to its passenger or assigned driver. |
| GET | `/api/v1/drivers/offers` | List your active driver offers. |
| POST | `/api/v1/drivers/offers/:rideId/accept` | Atomically accept an eligible offer. |
| POST | `/api/v1/drivers/offers/:rideId/reject` | Reject a pending offer. |
| POST | `/api/v1/rides/:rideId/arrived` | Mark arrival at pickup. |
| POST | `/api/v1/rides/:rideId/start` | Verify passenger pickup PIN and start the trip. |
| POST | `/api/v1/rides/:rideId/complete` | Complete trip and finalize the estimated fare. |
| POST | `/api/v1/rides/:rideId/cancel` | Cancel before the trip begins. |

Ride requests require a verified passenger phone. Matching creates bounded,
expiring offers for nearby eligible drivers. Assignment is conditional and
transactional. The pickup PIN is returned only when creating a ride; stored
hash/encrypted values are not intended for API responses.

## Realtime Socket.IO

Socket.IO is available at the `/realtime` namespace on the API origin. Connect
with `auth: { accessToken: "<JWT access token>" }` or an
`Authorization: Bearer <JWT access token>` handshake header. The server checks
the active account and session at connect and again before protected events.
The configured `CORS_ORIGINS` allowlist also applies to browser clients.

| Direction | Event | Payload / authorization |
| --- | --- | --- |
| Server → client | `connection:ready` | Authenticated `userId`. |
| Client → server | `ride:join` | `{ rideId }`; only the passenger or assigned driver may join. |
| Client → server | `ride:leave` | `{ rideId }`; leaves the room. |
| Server → room | `ride:status` | `{ rideId, status, emittedAt }`; lifecycle updates. |
| Server → driver | `driver:offer-created` | `{ rideId }`; sent to the eligible driver's private room. |
| Driver → server | `driver:location` | `{ latitude, longitude, accuracyMeters? }`; driver role and coordinate bounds required. |
| Server → trip room | `ride:driver-location` | Driver location only for an assigned active trip room. |
| Server → sender | `ride:joined`, `ride:left`, `driver:location:accepted` | Socket.IO acknowledgements for accepted commands. |

The socket connection is single-instance at present. Redis Socket.IO
scale-out, mobile client reconnect/resync behavior, event replay, monitoring
and load/concurrency tests remain required before production use. REST/database
state is authoritative; clients should fetch ride state after reconnect.

Rides currently use cash-only payment and the fare estimate as the final fare.
The development routing provider returns an explicitly marked straight-line
approximation. Production requires a configured OSRM-compatible routing
service; no SMS provider, rematching worker, online payment, ratings,
safety/support workflows, or operational admin console is included.
This API is not production-ready; see the [deployment checklist](deployment.md).
