import * as Location from "expo-location";
import { Linking } from "react-native";
import { showAlert } from "../components/AppAlert";

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

export async function ensureAtSpotForPhoto(spot) {
  const name = spot?.name || "this spot";
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
