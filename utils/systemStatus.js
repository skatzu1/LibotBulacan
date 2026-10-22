/*
 * The latest update notice from the server (GET /api/system/status; mock
 * defense 2026-10-21). Read by hooks/useSystemStatus.js.
 *
 * The route also says whether the console is under maintenance, but that is
 * for staff only: travelers are never held back by it (user rule 2026-10-23),
 * so the app doesn't read it.
 */

const STATUS_TIMEOUT_MS = 8000;

/**
 * { notice } or null if it can't be read. `baseUrl` is api.js's BASE_URL
 * (passed in, so this file doesn't import api.js).
 */
export async function fetchSystemStatus(baseUrl, fetchImpl = fetch) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS) : null;
  try {
    const res = await fetchImpl(`${baseUrl}/api/system/status`, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return null;
    const data = await res.json();
    return { notice: data.notice || null };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
