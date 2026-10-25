# Building LibotBulacan for iPhone

No Mac is needed. Expo's EAS Build compiles the iPhone app on Expo's Macs in
the cloud; everything below runs from Windows.

The Android APK is still built locally (see RELEASE.md). Only the iPhone build
goes through EAS.

## What you need

| | |
|---|---|
| Apple Developer Program | **Individual** enrollment, US$99 a year, at developer.apple.com or in the Apple Developer app (fastest). The Apple ID needs two-factor authentication. Activation can take up to 48 hours; nothing below works until it's active. |
| An iPhone | **iPhone XS or newer, iOS 15.1 or later** (React Native 0.81's minimum). AR uses ARKit, which every iPhone XS and newer has. |
| Expo account | The project's owner, `komiigurii` (`app.json` → `owner`). |
| On the PC | Node.js and `npm install -g eas-cli`. |

## One-time setup

1. `eas login` with the komiigurii account (`eas whoami` shows who's
   signed in).
2. Register every iPhone the app should install on: `eas device:create`.
   It first asks you to sign in with the Apple Developer account, which
   links your Apple team to Expo. Choose the website option, open the link
   **in Safari on the iPhone** and install the profile (Settings → Profile
   Downloaded → Install). A build only installs on iPhones registered
   **before** it was made; register a new iPhone, then build again.

## Build and install

Build from a clean copy of `main`, so no one's uncommitted work goes in.
`--detach` is needed because `main` is already checked out in the main
folder, and git won't check out one branch in two places:

```
git worktree add --detach ..\LibotBulacan-ios main
cd ..\LibotBulacan-ios
npm ci
eas build -p ios --profile preview
```

For later builds, reuse the folder: `git checkout --detach main`, then
`npm ci` and `eas build` again.

The copy has no `.env` (it's gitignored), and none is needed: with no
`EXPO_PUBLIC_*` variables the app uses the production server and the
production Clerk key, and crash reporting stays off.

- When asked, sign in with the Apple Developer account and let EAS create and
  manage the certificate and provisioning profile.
- The free Expo plan queues iPhone builds; expect 15–60 minutes.
- When it finishes, open the build page's link or QR code **on the iPhone**
  and install.
- iOS 16 and later: Settings → Privacy & Security → **Developer Mode** → on,
  then restart the iPhone (only the first time).

## First run on the iPhone

- Location: **Allow While Using App**. When Libot explains background access
  and iOS asks again, choose **Change to Always Allow** — the nearby and
  arrival alerts need it to work with the app in the background.
- Notifications: **Allow**.

## TestFlight (optional)

For testers without registering each iPhone: `eas build -p ios --profile
production`, then `eas submit -p ios`. Internal testers (up to 100) can install
through the TestFlight app after Apple finishes processing, with no App Review.

## Things that differ on iPhone

- **Background alerts.** They come while Libot is in the background. If the
  user swipes Libot away, iOS stops its location updates until it is opened
  again.
- **AR** runs on ARKit instead of ARCore; same screens, same models.
- **App Store.** Publishing on the App Store (not needed for TestFlight or the
  direct install above) requires "Sign in with Apple" next to Google sign-in.
- **Google sign-in** uses the same `libot://` redirect as Android; if it fails
  on iPhone, check Clerk's allowlist for mobile SSO redirects.

## If the build fails

Open the failed build on expo.dev; the log names the step and the error (most
often a native library's CocoaPods step). The configuration was checked with
`npx expo config --type introspect` on 2026-10-12: background location,
location, camera, photo and microphone purpose strings, URL scheme and bundle
id resolve correctly; `npx expo-doctor` passes 17 of 18 checks (the other is
library-metadata only).
