/*
 * One quiet second try for a screen's load, and an error that says what went
 * wrong (2026-10-30: "why does sometimes the leaderboards and achievements
 * network error?").
 *
 * The first request after the app comes back from the background is the one
 * that fails: Android brings the network back a moment after the app, and
 * Clerk renews the session token over that same network. One failed request
 * used to put up the screen's error, and every failure read "check your
 * connection" — a server error, an expired token and too many requests alike.
 */

export const RETRY_DELAY_MS = 1500;

/** A server answer that wasn't what the screen needed; `status` is the HTTP one. */
export class LoadError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "LoadError";
    this.status = status;
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Too many requests won't be fixed by one more; nor will a 403 or 404.
// Everything else is worth it: no answer at all, the server's own trouble, or
// a token that ran out on the way (the second try asks Clerk for a fresh one).
const worthRetrying = (e) => !e?.status || e.status >= 500 || e.status === 401;

/** `load(attempt)`, then once more after a short wait if it failed in a way that might pass. */
export async function withRetry(load, { delayMs = RETRY_DELAY_MS } = {}) {
  try {
    return await load(1);
  } catch (e) {
    if (!worthRetrying(e)) throw e;
    await wait(delayMs);
    return load(2);
  }
}

/** What to tell the traveler when `what` ("the leaderboard") didn't load. */
export function loadErrorText(e, what) {
  const status = e?.status;
  if (status === 401) return `Your sign-in ran out while loading ${what}. Try again, or sign out and back in.`;
  if (status === 429) return `Too many requests just now. Wait a minute, then try again.`;
  if (status >= 500) return `The server had trouble loading ${what}. Try again in a moment.`;
  if (status) return `Couldn't load ${what}. Try again.`;
  // utils/fetchTimeout.js aborts a request after 60 s.
  if (e?.name === "AbortError") return `The server took too long to answer. Try again.`;
  // React Native's fetch, when there's no connection.
  if (/network request failed/i.test(e?.message || "")) return `No internet connection. Check your connection and try again.`;
  return `Couldn't load ${what}. Try again.`;
}
