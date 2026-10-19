// AR anchors are pinned to real-world places around a site, so the AR
// experience is meaningless unless the user is physically there. This helper
// checks the user's current location against the spot and, when they're not on
// site, shows a themed warning. It resolves to `true` when the caller should
// proceed to launch AR, `false` when it should not.
import * as Location from "expo-location";
import { Linking } from "react-native";
import { showAlert } from "../components/AppAlert";

// A little slack for GPS drift and large sites. The server uses the same
// radius (ON_SITE_RADIUS_M in the backend's utils/onSite.js) when it checks
// AR and photo missions, so the two agree on what "at the spot" means.
const AR_RANGE_METERS = 120;

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getSpotCoords(spot) {
  if (!spot) return null;
  if (spot.coordinates?.lat != null && spot.coordinates?.lng != null)
    return { lat: spot.coordinates.lat, lng: spot.coordinates.lng };
  if (spot.latitude != null && spot.longitude != null)
    return { lat: spot.latitude, lng: spot.longitude };
  // Fall back to the centroid of the AR anchor points.
  const anchors = (spot.modelsCoordinates ?? []).filter(
    (a) => a?.lat != null && a?.lng != null
  );
  if (anchors.length) {
    return {
      lat: anchors.reduce((s, a) => s + a.lat, 0) / anchors.length,
      lng: anchors.reduce((s, a) => s + a.lng, 0) / anchors.length,
    };
  }
  return null;
}

// AR is for buildings: the models are pinned to a church or shrine that stands
// at the spot. A festival is an event and a river has nothing to anchor to, so
// spots filed under these categories get no AR View button and are left out of
// the AR spot picker. Matched case-insensitively, like the backend's
// aiModelKeyForSpot.
const NO_AR_CATEGORIES = ["nature", "festivals"];

export function spotHasAR(spot) {
  const raw = spot?.category;
  const categories = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((c) => String(c).toLowerCase());
  return !categories.some((c) => NO_AR_CATEGORIES.includes(c));
}

/**
 * AR opens only when the phone shows it is at the spot (QA 2026-10-16: "Cancel
 * kapag wala sa location"). Location off, or no GPS fix, used to offer "Start
 * anyway", which let AR open from anywhere; now, like a photo mission, it
 * explains what's needed and doesn't open.
 *
 * @param {object} spot  the spot the user wants to view in AR
 * @param {object} [opts]
 * @param {Function} [opts.onDirections]  offered as "Get directions" when the
 *   user is too far away
 * @returns {Promise<boolean>}  true -> caller should launch AR, false -> don't
 */
export async function ensureAtSpotForAR(spot, { onDirections } = {}) {
  const name = spot?.name || "this spot";
  const dest = getSpotCoords(spot);

  // No pin and no AR anchors: there is nothing to place, wherever the user is.
  if (!dest) {
    showAlert(
      "AR isn't ready here yet",
      `${name} has no AR models pinned to it yet.`,
      undefined,
      { tone: "info", icon: "map-pin" }
    );
    return false;
  }

  // Same wait as a photo mission: a fix from the last 30 s answers at once.
  const coords = await currentCoords({ ask: true, maxAgeMs: 30000, timeoutMs: 12000 });
  if (!coords) {
    const { status } = await Location.getForegroundPermissionsAsync().catch(() => ({}));
    if (status === "granted") {
      showAlert(
        "Couldn't find your location",
        `AR for ${name} only opens at the spot itself, and your phone couldn't get a GPS fix just now. Step outside or near a window and try again.`,
        undefined,
        { tone: "warning", icon: "map-pin" }
      );
    } else {
      showAlert(
        "Location needed",
        `AR for ${name} only opens at the spot itself, so the app needs your location to check you're there.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
        { tone: "warning", icon: "map-pin" }
      );
    }
    return false;
  }

  const dist = distanceMeters(
    coords.latitude,
    coords.longitude,
    dest.lat,
    dest.lng
  );

  // Known to be away from the spot: AR doesn't open. There used to be a
  // "Start anyway" here, which only led to a camera with nothing in it
  // (QA 2026-10-16: just Cancel when you aren't there).
  if (dist > AR_RANGE_METERS) {
    showAlert(
      `You're not at ${name}`,
      `You're about ${formatAway(dist)} away. AR only works at the spot itself, because the models are pinned to real places there. Come back to AR View once you've arrived.`,
      [
        { text: "Cancel", style: "cancel" },
        ...(onDirections ? [{ text: "Get directions", onPress: onDirections }] : []),
      ],
      { tone: "warning", icon: "map-pin" }
    );
    return false;
  }

  return true;
}

const formatAway = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/**
 * The phone's current position ({ latitude, longitude, accuracy }), or null
 * if location is off or unavailable. `ask` requests permission if needed.
 * `maxAgeMs` accepts a fix the phone already has if it's that recent (the
 * arrival watch keeps one while the app is open), which answers instantly;
 * `timeoutMs` stops waiting for a fresh fix, which indoors can take a while.
 */
export async function currentCoords({ ask = false, maxAgeMs = 0, timeoutMs = 0 } = {}) {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted" && ask) {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== "granted") return null;
    if (maxAgeMs) {
      const last = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs, requiredAccuracy: 100 });
      if (last) return last.coords;
    }
    const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    if (!timeoutMs) return (await fresh)?.coords ?? null;
    // The timer is cleared once the race is decided; it used to run on for
    // the full 12 s after a fix had already arrived.
    let timer;
    const pos = await Promise.race([
      fresh,
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]).finally(() => clearTimeout(timer));
    return pos?.coords ?? null;
  } catch (_) {
    return null;
  }
}

/**
 * Photo missions only count at the spot: the server checks the position sent
 * with the photo and awards nothing from anywhere else. So, as with AR, there's
 * no "start anyway" — better to say so before the photo than after.
 * Resolves to the phone's coords when it's on site, otherwise explains why
 * not and resolves to null.
 */
export async function ensureAtSpotForPhoto(spot) {
  const name = spot?.name || "this spot";
  // A fix from the last 30 s answers at once. Waiting for a fresh one used to
  // leave the button doing nothing for several seconds before "You're not
  // at…" appeared, which read as the app ignoring the tap.
  const coords = await currentCoords({ ask: true, maxAgeMs: 30000, timeoutMs: 12000 });
  if (!coords) {
    const { status } = await Location.getForegroundPermissionsAsync().catch(() => ({}));
    showAlert(
      status === "granted" ? "Couldn't find your location" : "Location needed",
      status === "granted"
        ? `Photo missions only count when the photo is taken at ${name}, and your phone couldn't get a GPS fix just now. Step outside or near a window and try again.`
        : `Photo missions only count when the photo is taken at ${name}, so the app needs your location to check you're there. Turn on location access and try again.`,
      undefined,
      { tone: "warning", icon: "map-pin" }
    );
    return null;
  }

  const dest = getSpotCoords(spot);
  if (!dest) return coords; // nothing to compare against here; the server decides

  const dist = distanceMeters(coords.latitude, coords.longitude, dest.lat, dest.lng);
  if (dist > AR_RANGE_METERS) {
    showAlert(
      `You're not at ${name}`,
      `You're about ${formatAway(dist)} away. Photo missions only count when the photo is taken at the spot itself — head over and try again once you've arrived.`,
      undefined,
      { tone: "warning", icon: "map-pin" }
    );
    return null;
  }
  return coords;
}
