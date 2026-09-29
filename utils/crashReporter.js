import * as Sentry from "@sentry/react-native";

/*
 * Crash reporting, behind one switch.
 *
 * Sentry only turns on when EXPO_PUBLIC_SENTRY_DSN is set (an EAS secret for
 * release builds). With no DSN this module is inert: `init()` does nothing and
 * `captureError()` falls back to console. That means:
 *   - local dev never ships noise to a dashboard,
 *   - a build with the secret missing still runs normally instead of throwing,
 *   - nothing here has to be conditionally imported at the call site.
 *
 * Set it up with:
 *   eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value <dsn>
 */

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
let enabled = false;

export function initCrashReporting() {
  if (!DSN) {
    if (__DEV__) console.log("[crashReporter] No EXPO_PUBLIC_SENTRY_DSN — reporting disabled.");
    return;
  }
  try {
    Sentry.init({
      dsn: DSN,
      // Don't report from the simulator/dev client — those crashes are ours,
      // not the users', and they drown out real signal.
      enabled: !__DEV__,
      // Breadcrumbs + a modest trace sample. Full tracing on a tourism app with
      // background location would be expensive and mostly noise.
      tracesSampleRate: 0.2,
      // The app handles location, photos and email addresses. Default PII off.
      sendDefaultPii: false,
      beforeSend(event) {
        // Belt and braces: strip anything that could carry a user's email or
        // precise position out of the payload before it leaves the device.
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
          delete event.user.geo;
        }
        return event;
      },
    });
    enabled = true;
  } catch (e) {
    console.warn("[crashReporter] init failed:", e?.message);
  }
}

/** Report a caught error. Safe to call whether or not Sentry is configured. */
export function captureError(error, context) {
  if (!enabled) {
    if (__DEV__) console.error("[crashReporter]", error, context ?? "");
    return;
  }
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Reporting must never be the thing that crashes the app.
  }
}

/** Tag the session with the signed-in user, without sending their email. */
export function identifyUser(clerkUserId) {
  if (!enabled) return;
  try {
    Sentry.setUser(clerkUserId ? { id: clerkUserId } : null);
  } catch { /* ignore */ }
}
