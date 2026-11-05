import { BASE_URL } from "../api";
import { badgeShareUrl } from "./legalLinks";

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
      message: `I just earned the "${badge.name}" badge on LibotBulacan! Discover Bulacan's history!`,
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
