import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { io } from "socket.io-client";
import { BASE_URL } from "../api";

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
