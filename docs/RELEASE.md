# Releasing the Libot app

How to build, ship, update and roll back the mobile app. The backend has its
own runbook in the LibotBackend repo (`docs/RUNBOOK.md`).

## One-time steps after the `chore/production-readiness` merge

1. **Uninstall the old app from test phones.** The Android package changed from
   `com.skatzu15.libot.beta` to `com.skatzu15.libot`, so Android treats the new
   build as a different app. The old one will not update in place.
2. **Regenerate the local Android project** before running it from your
   computer, because `android/` still has the old package:
   `npx expo prebuild --clean`, then `npx expo run:android`.
3. **ARCore key restriction.** If the ARCore API key in Google Cloud is
   restricted to Android apps (Google Cloud Console → APIs & Services →
   Credentials → the key → Application restrictions), add
   `com.skatzu15.libot` with the SHA-1 fingerprint of:
   - the EAS signing key: `npx eas-cli credentials -p android` shows it;
   - the Play App Signing key, after the first upload: Play Console → Test and
     release → Setup → App signing.
   Remove the `.beta` entry once nothing uses it.
4. **Clerk native app settings.** If Clerk Dashboard → *Native applications*
   lists an Android app, change its package name to `com.skatzu15.libot`.
   (Google sign-in itself goes through the browser and does not depend on the
   package name.)

## Build

| Purpose | Command | Output |
|---|---|---|
| Testers, sideloaded | `npx eas-cli build -p android --profile preview` | APK, channel `preview` |
| Google Play | `npx eas-cli build -p android --profile production` | AAB, channel `production`, build number auto-incremented |
| Dev client | `npx eas-cli build -p android --profile development` | For `npx expo start --dev-client` |

Checks that must be green first: GitHub Actions *CI* (lint, unit tests, the
Android bundle compiles), and the manual pass in `docs/QA_CHECKLIST.md`.

## Submit to Google Play

The **first** upload must be done by hand in Play Console (Test and release →
Testing → Closed testing → Create release → upload the `.aab` from the EAS build
page). After that, `npx eas-cli submit -p android --profile production` can
upload for you once a Google service-account key is added to EAS
(<https://docs.expo.dev/submit/android/>). Store paperwork: `docs/STORE_LAUNCH.md`.

## Over-the-air (OTA) updates

JavaScript-only fixes can ship without a store release:

```bash
npx eas-cli update --channel production --message "Fix review list crash"
```

An update reaches only builds with the **same runtime version**, which is the
app's `version` in app.json (`runtimeVersion.policy: appVersion`). So:

- **JS-only change** (screens, styles, logic): publish an update.
- **Native change** (a new native package, a permission, an app.json plugin
  setting, an Expo SDK upgrade): **bump `version` in app.json**, then make a new
  build. Otherwise the update would reach older builds without the native code
  and crash them.

Roll back a bad update: `npx eas-cli update:list --branch production`, pick the
last good group, then `npx eas-cli update:republish --group <group-id>`.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `ARCORE_API_KEY` | EAS secret (already set) | ARCore Geospatial. |
| `EXPO_PUBLIC_SENTRY_DSN` | EAS environment variable for `preview` and `production` | Turns on crash reporting. Unset = off. |
| `EXPO_PUBLIC_API_URL` | `eas.json` build profile `env` | Backend URL. Unset = production. Point `preview` at a staging backend once one exists. |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | optional | Overrides the built-in Clerk key (see App.js). |
| `SENTRY_DISABLE_AUTO_UPLOAD` | `eas.json` (set to `true`) | Skips uploading source maps to Sentry, which fails the build until Sentry is configured. |

### Turning on crash reporting

1. sentry.io → create a **React Native** project → copy the DSN.
2. `npx eas-cli env:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn> --environment production --environment preview --visibility plaintext`
3. Optional, for readable stack traces: create a Sentry auth token, add
   `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` as EAS secrets, and
   delete `SENTRY_DISABLE_AUTO_UPLOAD` from all three profiles in `eas.json`.
4. Build again. Crashes appear in Sentry → Issues.

### A staging backend

Preview builds currently talk to production. To give testers their own data:
create a second Render service from the LibotBackend repo with its own Atlas
database (and ideally the Clerk **development** instance), then add to the
`preview` profile in `eas.json`:

```json
"env": { "EXPO_PUBLIC_API_URL": "https://<staging-service>.onrender.com", "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_…" }
```

## Known launch risks

- **Directions use the public OSRM demo server** (`router.project-osrm.org`,
  `Screens/Track.js`). Its policy is "no heavy use, no production apps"; it can
  rate-limit or go away. Before real traffic, switch to a hosted routing API
  (e.g. OpenRouteService, free tier) called through the backend so the API key
  stays off the phone.
- **Map library from unpkg.com.** Leaflet loads from the CDN at runtime, with
  integrity hashes so a tampered file is refused. If unpkg is down, the Track
  map cannot load.
- **Background arrivals are off.** Arrival alerts only work while Libot is open.
  To bring them back, follow the steps above `BACKGROUND_ARRIVALS_ENABLED` in
  `context/ArrivalContext.js`, then submit Play's background-location
  declaration.
