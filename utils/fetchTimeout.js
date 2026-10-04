/*
 * A time limit for every fetch() in the app.
 *
 * React Native's fetch has none: on a connection that has died, a request never
 * settles and the screen waiting on it spins forever instead of showing its
 * error and retry. About 25 calls use plain fetch (the axios instance in api.js
 * has its own timeout), so rather than threading a signal through each one,
 * App.js wraps fetch once at start-up.
 *
 * A call that passes its own `signal` keeps it and gets no extra limit — photo
 * uploads and model downloads set their own, longer ones. The default is 60 s,
 * like axios: longer than a sleeping server takes to wake up (30–60 s), so a
 * cold start is slow but not an error.
 *
 * `onRequest(url, init)` may return a function, called when the request ends —
 * App.js uses it to notice reads that are taking long (utils/serverActivity.js).
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 60_000;

/** `fetchImpl`, with an abort after `ms` for calls that bring no signal. */
export function withTimeout(fetchImpl, ms = DEFAULT_FETCH_TIMEOUT_MS, { onRequest } = {}) {
  const fetchWithTimeout = (input, init) => {
    const ended = onRequest?.(typeof input === "string" ? input : input?.url, init);
    const settle = (promise) => (ended ? promise.finally(ended) : promise);

    if (init?.signal || typeof AbortController === "undefined") return settle(fetchImpl(input, init));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return settle(fetchImpl(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer)));
  };
  fetchWithTimeout.withDefaultTimeout = true;
  return fetchWithTimeout;
}

/** Replaces the global fetch with the time-limited one. Safe to call twice. */
export function installFetchTimeout(ms, options) {
  if (typeof global.fetch === "function" && !global.fetch.withDefaultTimeout) {
    global.fetch = withTimeout(global.fetch, ms, options);
  }
}
