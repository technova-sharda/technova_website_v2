# Technova app (Android + iOS)

Native app built with Expo (React Native): real native screens, tabs, camera and
keychain storage, not a website wrapper. It talks to the website's API
(`/api/mobile/v1/*`), so the website must be deployed first.

## What's in it

- **Home**: your next ticket, live and upcoming events, XP and rank.
- **Events**: upcoming / past, search, event pages, one-tap registration for free events
  (paid events and events with a form open the website).
- **Tickets**: wallet-style passes; tap one for a full-screen QR (brightness goes up).
- **Ranks**: leaderboard (all time / month / week).
- **Me**: profile, certificates, sign out.
- **Scan** (admins and volunteers only): native camera check-in with haptics,
  progress bar and a searchable list for manual check-in.

Sign-in uses the website's Google login in a secure browser sheet and keeps a
session token in the phone's keychain / keystore.

## Run it on your phone (no store account needed)

1. Install **Expo Go** from the Play Store / App Store.
2. `cd mobile && npm install && npx expo start`
3. Scan the QR code shown in the terminal (Android: in Expo Go; iPhone: with the Camera app).

The app uses `https://www.technovashardauniversity.in` by default. To point it at
another server, create `mobile/.env` with `EXPO_PUBLIC_API_URL=https://...`.

## Installable builds (EAS)

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android   # .apk to share directly
npx eas-cli@latest build --profile production --platform all     # Play Store / App Store
```

Play Store needs a Google Play developer account (one-time $25). App Store and
TestFlight need an Apple Developer account ($99/year).

## Checks

```bash
npx tsc --noEmit && npx expo lint && npx expo-doctor
```
