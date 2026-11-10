/*
 * Repeat reads from the backend cost only their headers (2026-11-10: "the app
 * uses too much internet").
 *
 * Screens load again on focus, on a live hint (utils/live.js), when the app
 * comes back to the front and on a pull, and almost every time the answer is
 * the same as last time. Express already tags every answer with an ETag and
 * answers "304 Not Modified" with no body when the request carries the tag it
 * would send. The app never sent it, so the spot list (48 KB, 14 KB zipped),
 * the Ranking, achievements and the rest came down in full every time.
 * Measured on the live server: a repeat /api/spots is a 304 with a 0-byte body.
 *
 * So for GETs to the backend the last answer per URL is kept in memory, its
 * tag goes out as If-None-Match, and a 304 is handed back to the caller as
 * that answer — callers never see the 304. An ETag is the server's hash of
 * the body it was about to send, so a 304 means the kept copy IS the answer
 * (even across users: someone else's different body has a different tag).
 *
 * Memory only, never written to the phone; gone when the app closes.
 */

const MAX_ENTRIES = 80;
// A body this big isn't worth holding in memory (nothing the app reads is).
const MAX_BODY_CHARS = 1_000_000;

const entries = new Map(); // url -> { etag, body, type }

/** The kept answer for `url`, or null. */
export function recall(url) {
  const hit = entries.get(url);
  if (!hit) return null;
  // Most recently used last, so the oldest goes first when full.
  entries.delete(url);
  entries.set(url, hit);
  return hit;
}

export function remember(url, etag, body, type) {
  if (!etag || typeof body !== "string" || body.length > MAX_BODY_CHARS) return;
  entries.delete(url);
  entries.set(url, { etag, body, type: type || "application/json" });
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
}

export function forgetAll() {
  entries.clear();
}

const hasHeader = (headers, name) => {
  if (!headers) return false;
  if (typeof headers.has === "function") return headers.has(name);
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
};

const withHeader = (headers, name, value) => {
  if (headers && typeof headers.set === "function" && typeof Headers !== "undefined") {
    const copy = new Headers(headers);
    copy.set(name, value);
    return copy;
  }
  return { ...(headers || {}), [name]: value };
};

/** `fetchImpl`, sending If-None-Match on backend GETs and replaying a 304. */
export function withConditionalGets(fetchImpl, baseUrl) {
  const conditional = async (input, init) => {
    const method = (init?.method || "GET").toUpperCase();
    // A string URL only: a Request object carries its own headers.
    if (method !== "GET" || typeof input !== "string" || !input.startsWith(baseUrl)) {
      return fetchImpl(input, init);
    }
    // A caller that sets its own condition keeps it.
    const saved = hasHeader(init?.headers, "If-None-Match") ? null : recall(input);
    const res = await fetchImpl(
      input,
      saved ? { ...init, headers: withHeader(init?.headers, "If-None-Match", saved.etag) } : init,
    );

    if (res.status === 304 && saved && typeof Response !== "undefined") {
      return new Response(saved.body, {
        status: 200,
        statusText: "OK",
        headers: { "content-type": saved.type, etag: saved.etag },
      });
    }
    const etag = res.status === 200 ? res.headers?.get?.("etag") : null;
    if (etag && typeof res.clone === "function") {
      // A copy is read, so the caller's own body is untouched.
      res.clone().text()
        .then((body) => remember(input, etag, body, res.headers.get("content-type")))
        .catch(() => {});
    }
    return res;
  };
  conditional.conditionalGets = true;
  return conditional;
}

/** Wraps the global fetch once (App.js). Safe to call twice. */
export function installConditionalGets(baseUrl) {
  if (typeof global.fetch === "function" && !global.fetch.conditionalGets) {
    global.fetch = withConditionalGets(global.fetch, baseUrl);
  }
}

/*
 * The same for the axios instance (api.js), which doesn't go through fetch.
 * Kept as JSON, so a replay is a fresh object the caller may change freely.
 */
export function addConditionalGets(instance) {
  instance.interceptors.request.use((config) => {
    if ((config.method || "get").toLowerCase() !== "get") return config;
    let url;
    try { url = instance.getUri(config); } catch { return config; }
    config.etagUrl = url;
    const saved = recall(url);
    if (saved) {
      config.etagSaved = saved;
      config.headers = config.headers || {};
      if (typeof config.headers.set === "function") config.headers.set("If-None-Match", saved.etag);
      else config.headers["If-None-Match"] = saved.etag;
      const accept = config.validateStatus;
      config.validateStatus = (s) => s === 304 || (accept ? accept(s) : s >= 200 && s < 300);
    }
    return config;
  });
  instance.interceptors.response.use((res) => {
    const { etagUrl, etagSaved } = res.config || {};
    if (!etagUrl) return res;
    if (res.status === 304 && etagSaved) {
      try {
        return { ...res, status: 200, statusText: "OK", data: JSON.parse(etagSaved.body) };
      } catch {
        return res;
      }
    }
    const etag = res.headers?.etag ?? res.headers?.get?.("etag");
    if (res.status === 200 && etag && res.data !== undefined) {
      try { remember(etagUrl, etag, JSON.stringify(res.data), "application/json"); } catch {}
    }
    return res;
  });
}
