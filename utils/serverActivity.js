/*
 * Reads from the Libot backend that are still waiting for an answer, and since
 * when — so the app can say "waking up the server" instead of showing a
 * spinner with no reason given. The free server sleeps when idle and the first
 * request after that takes 30–60 s.
 *
 * Fed by the fetch wrapper (utils/fetchTimeout.js, installed in App.js) and
 * the axios instance (api.js). Only GETs: an upload is slow because it is big,
 * not because the server is asleep.
 */

const pending = new Map(); // id -> start time
const listeners = new Set();
let nextId = 0;

const emit = () => listeners.forEach((fn) => fn());

/** Call when a read starts; call what it returns when it ends (either way). */
export function readStarted() {
  const id = ++nextId;
  pending.set(id, Date.now());
  emit();
  return () => { if (pending.delete(id)) emit(); };
}

/** When the longest-waiting read started, or null when none is waiting. */
export function oldestReadSince() {
  let oldest = null;
  for (const t of pending.values()) if (oldest === null || t < oldest) oldest = t;
  return oldest;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** For fetch-style calls: a tracker when this is a GET to `baseUrl`, else null. */
export const trackBackendRead = (baseUrl) => (url, init) => {
  const method = (init?.method || "GET").toUpperCase();
  return method === "GET" && typeof url === "string" && url.startsWith(baseUrl) ? readStarted() : null;
};
