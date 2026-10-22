/*
 * The system's state from the server (GET /api/system/status): whether it is
 * under maintenance, and the latest update notice (mock defense 2026-10-21).
 * Read by hooks/useSystemStatus.js.
 *
 * A 503 from any request only *hints* that maintenance may have started: the
 * hook then asks the status route. It never switches to the maintenance
 * screen on a 503 alone, because Render answers 503 by itself for a moment
 * during every deploy.
 */

const STATUS_TIMEOUT_MS = 8000;

/**
 * { maintenance: { on, message, expectedEndAt }, notice } or null if it can't
 * be read. `baseUrl` is api.js's BASE_URL (passed in, so api.js can import
 * this file without the two importing each other).
 */
export async function fetchSystemStatus(baseUrl, fetchImpl = fetch) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS) : null;
  try {
    const res = await fetchImpl(`${baseUrl}/api/system/status`, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return null;
    const data = await res.json();
    return { maintenance: data.maintenance || { on: false }, notice: data.notice || null };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const listeners = new Set();

/** Called on a 503 from our server; the hook re-checks right away. */
export function hintMaintenance() {
  listeners.forEach((fn) => fn());
}

export function onMaintenanceHint(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** For utils/fetchTimeout.js's onResponse: a 503 from our own server. */
export const maintenanceHintFrom = (baseUrl) => (res) => {
  if (res?.status === 503 && typeof res.url === "string" && res.url.startsWith(baseUrl)) hintMaintenance();
};
