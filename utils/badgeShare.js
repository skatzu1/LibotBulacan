import { BASE_URL } from "../api";
import { badgeShareUrl } from "./legalLinks";

/*
 * Sharing a spot badge, from the Achievements screen or the moment it's
 * unlocked (components/RewardCelebration.js).
 *
 * A badge is shared as a link, never as a picture (2026-10-20, the user:
 * "remove the share as image"). The link becomes a preview card showing the
 * badge — libotbulacan.com/badge/<id> writes per-badge preview tags into its
 * HTML, which chat apps' link crawlers read — and tapping it opens the badge on
 * the website, where the app can be downloaded. The link goes as `url`, not
 * inside the text: Android still sends "text link", but iOS then shares it as a
 * real link, which is what gets the preview card there.
 *
 * The link carries a code the server hands out for this traveler and badge, so
 * the badge page can say who shared it ("Shared by …"). If that request fails
 * (offline, a slow server) the plain link still goes, and the page just names
 * no one.
 */

// How long Share waits for the code before sending the link without it — the
// share sheet shouldn't hang on a slow connection.
export const SHARE_CODE_TIMEOUT_MS = 4000;

export async function shareCodeFor(badgeId, getToken) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHARE_CODE_TIMEOUT_MS);
  try {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/api/users/me/badges/${badgeId}/share`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.token === "string" ? data.token : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Opens the share sheet for an earned badge ({ _id | badgeId, name }).
 * Resolves false when sharing couldn't open (the caller says so), true otherwise
 * — a share the traveler cancels included.
 */
export async function shareBadge(badge, getToken) {
  const id = badge?._id ?? badge?.badgeId;
  if (!id) return false;
  try {
    const code = await shareCodeFor(id, getToken);
    // Loaded when sharing, not with every screen that can share: the reward
    // moment is on screen from the start.
    const RNShare = require("react-native-share").default;
    await RNShare.open({
      title: `${badge.name} Badge`,
      message: `I just earned the "${badge.name}" badge on Libot Bulacan! Discover Bulacan's history!`,
      url: badgeShareUrl(id, code),
      failOnCancel: false,
    });
    return true;
  } catch (e) {
    if (e?.message === "User did not share") return true;
    console.warn("[Share] Failed:", e);
    return false;
  }
}
