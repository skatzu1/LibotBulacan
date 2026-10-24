import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { io } from "socket.io-client";
import { BASE_URL } from "../api";

/*
 * Live updates (2026-10-23: "superadmin, admin, moderator, mobile app should
 * be realtime").
 *
 * One Socket.IO connection to our own backend (its utils/live.js), not an
 * outside service. It carries no data: the server says which kind of thing
 * changed — "spots", "reviews", "missions", "progress" (points and the
 * leaderboard), "categories", "badges", "system" (the update notice) — and
 * each screen showing it loads it again through the usual API, keeping what's
 * on screen if that fails. Signed in, the connection also carries the
 * traveler's own "moderation": an admin's suspension or ban reaches the app at
 * once — and their own "achievements", when they arrive or finish a mission.
 *
 *   useLive(["reviews"], () => fetchReviews(spot._id));
 *
 * Every phone hears an update at the same moment, so each waits a moment
 * plus a random part of a second and a half before loading — a burst of
 * changes loads once, and the server isn't asked by everyone at once.
 *
 * In the background nothing loads; what changed meanwhile loads on return.
 * After a minute in the background the connection closes (battery), and on
 * return it opens again and every screen loads once, for what it missed.
 *
 * App.js opens it (connectLive) and opens it again when someone signs in or
 * out, so the server knows whose ban or suspension to send.
 */

const DELAY_MS = 400;
const SPREAD_MS = 1500;
const BACKGROUND_CLOSE_MS = 60_000;
// The server refused the token (it had run out): ask again with a fresh one.
const RETRY_MS = 10_000;

const listeners = new Set();
let socket = null;
let retryTimer = null;
let closeTimer = null;
let appStateSub = null;

const isActive = () => AppState.currentState === "active";

function poke(l) {
  if (!isActive()) { l.stale = true; return; }
  if (l.timer) return;
  l.timer = setTimeout(() => {
    l.timer = null;
    l.stale = false;
    l.run();
  }, DELAY_MS + Math.random() * SPREAD_MS);
}

// `topics` null: everything.
function deliver(topics) {
  listeners.forEach((l) => { if (!topics || topics.some((topic) => l.topics.includes(topic))) poke(l); });
}

function onAppState(next) {
  if (next === "active") {
    clearTimeout(closeTimer);
    closeTimer = null;
    if (socket && !socket.connected && !socket.active) socket.connect();
    listeners.forEach((l) => { if (l.stale) poke(l); });
  } else if (!closeTimer) {
    closeTimer = setTimeout(() => { closeTimer = null; socket?.disconnect(); }, BACKGROUND_CLOSE_MS);
  }
}

/** Calls `run` when any of `topics` changes. Returns the unsubscribe. */
export function subscribeLive(topics, run) {
  const l = { topics, run, timer: null, stale: false };
  listeners.add(l);
  return () => { listeners.delete(l); clearTimeout(l.timer); };
}

/** Opens the connection; `getToken` (Clerk's) when someone is signed in. */
export function connectLive({ getToken = null } = {}) {
  disconnectLive();
  let opened = false;
  socket = io(BASE_URL, {
    transports: ["websocket"],
    // Asked on every (re)connect, so it is always a fresh session token.
    auth: (send) => {
      if (!getToken) return send({});
      Promise.resolve()
        .then(() => getToken())
        .then((token) => send(token ? { token } : {}), () => send({}));
    },
    reconnectionDelayMax: 30_000,
  });
  socket.on("connect", () => {
    if (opened) deliver(null);
    opened = true;
  });
  socket.on("changed", (msg) => deliver(Array.isArray(msg?.topics) ? msg.topics : []));
  // Not active = refused (an expired token); a dropped line retries by itself.
  socket.on("connect_error", () => {
    if (!socket || socket.active) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => socket?.connect(), RETRY_MS);
  });
  appStateSub = AppState.addEventListener("change", onAppState);
}

export function disconnectLive() {
  clearTimeout(retryTimer);
  clearTimeout(closeTimer);
  closeTimer = null;
  appStateSub?.remove();
  appStateSub = null;
  socket?.disconnect();
  socket = null;
}

/** Runs `onChange` (this render's) when any of `topics` changes. */
export function useLive(topics, onChange) {
  const latest = useRef(onChange);
  useEffect(() => { latest.current = onChange; });
  const key = topics.join(" ");
  useEffect(() => subscribeLive(key.split(" "), () => latest.current()), [key]);
}
