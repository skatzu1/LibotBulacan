// AR anchors are pinned to real-world places around a site, so the AR
// experience is meaningless unless the user is physically there. This helper
// checks the user's current location against the spot and, when they're not on
// site, shows a themed warning. It resolves to `true` when the caller should
// proceed to launch AR, `false` when it should not.
import * as Location from "expo-location";
import { showAlert } from "../components/AppAlert";

// A little slack for GPS drift and large sites.
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

function confirm(title, message, confirmText = "Start anyway") {
  return new Promise((resolve) => {
    showAlert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ],
      { tone: "warning", icon: "map-pin", cancelable: true }
    );
  });
}

/**
 * @param {object} spot  the spot the user wants to view in AR
 * @returns {Promise<boolean>}  true → caller should launch AR, false → don't
 */
export async function ensureAtSpotForAR(spot) {
  const name = spot?.name || "this spot";
  const dest = getSpotCoords(spot);

  // No coordinates to compare against — warn generically.
  if (!dest) {
    return confirm(
      "Are you at the spot?",
      `The AR experience for ${name} only works while you're standing at the location itself. Make sure you're there before you begin.`
    );
  }

  let coords = null;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === "granted") {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      coords = pos.coords;
    }
  } catch (_) {}

  // Couldn't read the user's location — can't confirm they're on site.
  if (!coords) {
    return confirm(
      "Can't confirm your location",
      `AR for ${name} only works at the spot itself — the 3D models are pinned to real places there. If you're not on site yet, they won't appear.`
    );
  }

  const dist = distanceMeters(
    coords.latitude,
    coords.longitude,
    dest.lat,
    dest.lng
  );

  if (dist > AR_RANGE_METERS) {
    const away =
      dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
    return confirm(
      `You're not at ${name}`,
      `You're about ${away} away. The AR experience only works when you're physically at the spot — the models are anchored to real locations there. Head over and try again once you've arrived.`
    );
  }

  return true;
}
