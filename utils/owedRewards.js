import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { BASE_URL } from "../api";
import { celebrate } from "./rewards";
import { subscribeLive } from "./live";
import { navigationRef } from "../navigation/navigationRef";

/*
 * Rewards owed, wherever the traveler is (2026-10-24: "why does the reward
 * panel only shows when I open achievements?").
 *
 * A step on the phone — an arrival, a mission — gets its reward in its own
 * reply, and that screen plays the moment. Progress that didn't come from this
 * phone's step (the backend's scripts/finishAllMissions.js, a mission that
 * stopped counting, another phone) is only awarded when the app asks
 * GET /api/achievements/me, which awards what is owed and says what it
 * awarded. Until now only the Achievements screen asked. Now the app asks on
 * opening, on coming back to the foreground, when the server says this
 * traveler's achievements changed (utils/live.js), and plays the moments over
 * whatever screen is open.
 *
 * 2026-10-25 (asked again): the script runs in its own process, so the server
 * can't tell the phone, and an admin giving a finished spot or municipality
 * its badge only announces "badges". So the app also asks when badges change
 * and whenever the traveler moves to another screen (at most every
 * NAV_CHECK_MS) — the moment plays on the next screen, whichever it is.
 */

let inflight = null;

const NAV_CHECK_MS = 15000;

/**
 * GET /api/achievements/me, playing a moment for anything it awarded. One
 * request at a time: a second caller shares the first's, so a reward is never
 * split between two answers (or played twice).
 */
export function fetchAchievements(getToken) {
  if (inflight) return inflight;
  inflight = (async () => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/achievements/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`achievements ${res.status}`);
    const body = await res.json();
    celebrate(body.unlocked);
    return body;
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Mounted inside RewardCelebrationProvider while someone is signed in (App.js). */
export function OwedRewards() {
  const { getToken } = useAuth();
  useEffect(() => {
    let lastCheck = 0;
    const check = () => {
      lastCheck = Date.now();
      return fetchAchievements(getToken).catch(() => {});
    };
    check();
    const appStateSub = AppState.addEventListener("change", (next) => { if (next === "active") check(); });
    const stopLive = subscribeLive(["achievements", "badges"], check);
    const stopNav = navigationRef.addListener("state", () => {
      if (Date.now() - lastCheck >= NAV_CHECK_MS) check();
    });
    return () => { appStateSub.remove(); stopLive(); stopNav(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
