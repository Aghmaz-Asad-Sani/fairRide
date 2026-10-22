# FairRide

FairRide is an original ride-hailing project for Pakistan. The repository
keeps its backend and Android-first Expo mobile app in separate folders:

- `backend/` — NestJS API, PostgreSQL/PostGIS, migrations and API docs.
- `mobile/` — Expo React Native app that consumes the backend REST API.
- `admin/` — Next.js super-admin dashboard for reviews, accounts, rides and fares.

## Start developing

Start PostgreSQL with PostGIS installed, then start the API in one VS Code
terminal. Docker and Redis are not required:

```powershell
cd backend
npm install
npm run migration:run
npm run start:dev
```

For a Windows PostgreSQL installation, install the matching PostGIS extension
through StackBuilder before running migrations. Create the first admin account
once with `npm run admin:bootstrap` from `backend/`.

Start the Android app in another terminal:

```powershell
cd mobile
npm install
npx expo start --go --clear
```

Keep the phone and computer on the same Wi-Fi, then scan the QR code with the
up-to-date Expo Go 57 app; this project is pinned to SDK 57 for compatibility.
Android Studio is not required. Tunnel mode is optional and requires Expo
login. Set the backend URL to your computer's Wi-Fi IPv4 address in **API
connection settings** inside the app. Android emulator and custom development
build instructions are in [mobile development instructions](mobile/README.md).

The current mobile milestone connects account signup/sign-in, OTP, passenger
fare/ride requests, and driver onboarding/offers. It is a development MVP, not
a complete Yango-equivalent or production ride-hailing service.

The dashboard uses an existing `SUPER_ADMIN` login; it has no public admin
registration. Add `http://localhost:3001` to backend `CORS_ORIGINS` if running
the dashboard on port 3001:

```powershell
cd admin
Copy-Item .env.example .env.local
npm install
npm run dev -- --port 3001
```

Set `NEXT_PUBLIC_API_ORIGIN` in `admin/.env.local` to the backend origin
(default `http://localhost:3000`).

- [Backend API reference](backend/docs/api.md)
- [Project knowledge base](http://localhost:3000/knowledge-base)
- [Backend deployment gaps](backend/docs/deployment.md)
