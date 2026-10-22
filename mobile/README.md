# FairRide mobile app

Expo + React Native + TypeScript app, kept separate from the backend under
`mobile/`.

## Start in VS Code

1. Run PostgreSQL, Redis, migrations, and the backend from `backend/`:

   ```powershell
   cd ..\backend
   npm run start:dev
   ```

   The backend listens on port `3000` and binds to `0.0.0.0`.

2. Open a second VS Code terminal in `mobile/` and start Expo:

   ```powershell
   npm install
   npm start
   ```

3. For a physical Android phone, update/install **Expo Go** from Google Play.
   Connect the phone and computer to the same Wi-Fi. From the `mobile/`
   terminal, start Expo explicitly in Go mode (no Expo account or tunnel
   needed). This project is pinned to Expo SDK 57 to match Expo Go 57:

   ```powershell
   npx expo start --go --clear
   ```

   Scan the terminal QR code from Expo Go. Android Studio and `adb` are not
   needed for this physical-phone workflow. If the phone cannot connect over
   the same Wi-Fi, tunnel mode is an optional alternative: sign in with
   `npx expo login` and then run `npx expo start --go --tunnel`. Expo Go must
   support the SDK version used by this project. If Expo Go still shows the old
   error, fully close Expo Go, restart this command, and scan the newly printed
   QR code.

For an Android emulator or a custom native development build instead, install
Android Studio and its Android SDK, Build-Tools, Platform-Tools (`adb`), and
Emulator. Set `ANDROID_HOME` to the SDK location and add
`%ANDROID_HOME%\platform-tools` to `Path`, then reopen VS Code. Start an
emulator from Android Studio's Device Manager and build/install FairRide:

```powershell
npx expo run:android
```

After changing native dependencies or app configuration, rebuild with
`npx expo run:android` again.

## Android device and backend URL

- Emulator default: `http://10.0.2.2:3000` (the Android emulator's Windows-host
  alias).
- Physical phone: connect the phone and computer to the same Wi-Fi, find the
  computer's private IPv4 with `ipconfig`, and enter, for example,
  `http://192.168.1.20:3000` under **API connection settings** in the app.
- Allow Node.js through Windows Firewall on **Private networks** if prompted.
  Check `http://<computer-ip>:3000/api/v1/health/live` from the phone browser.
- Alternatively, copy `.env.example` to `.env.local`, set
  `EXPO_PUBLIC_API_ORIGIN`, and restart Expo with `npx expo start --clear`.

The server URL is stored in device secure storage. Local HTTP is enabled in
non-production native configuration only; production must set `APP_ENV=production`
and use HTTPS. Never put credentials in `EXPO_PUBLIC_*` variables.

## Current connected screens

- First screen asks whether the person is a passenger or driver, then opens a
  role-specific signup/login path with a FairRide navy, teal and gold visual
  theme.
- Passenger/driver registration and sign-in, persisted access/refresh tokens
  in Expo SecureStore, automatic refresh after an expired access token.
- Phone OTP request and verification (the backend still needs a real SMS
  provider for live messages).
- Passenger server-priced estimates and idempotent cash ride requests. The
  initial screen asks for coordinates; map selection/geocoding is not wired.
- Guided driver setup for licence details, vehicle details, administrator
  review, then availability and ride offers after approval. The app collects
  document details, but document image upload and automatic GPS are not wired.
- API origin editor for emulator or physical Android device.

Driver coordinates currently need to be entered manually; background GPS,
push, a native live map, online payment, and full in-trip socket navigation
remain future work.

## Checks

```powershell
npm run typecheck
npm run lint
npx expo-doctor
```

The backend API details are in `../backend/docs/api.md`. The backend must be
running and its PostgreSQL/Redis readiness check must pass to exercise auth and
ride flows.
