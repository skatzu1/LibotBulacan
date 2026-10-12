// "A spot is nearby" alerts — the geofence the system specification asks for:
// "notify the user when they are within the geofencing perimeter of a nearby
// attraction", so they know it is there and can go.
//
// This is a different alert from the arrival one (50 m, utils/arrivalEngine.js),
// which says you HAVE arrived and logs the visit. This one comes earlier, from
// NEARBY_RADIUS_METERS out, only for spots the traveler hasn't visited yet,
// and its tap opens directions. It is worked out on the phone from the spot
// list it already has; nothing about it is sent to the server.
import { joinNames } from "./arrivalNotice";

export const NEARBY_RADIUS_METERS  = 500;
// At most one alert per spot a day, so living or working near one doesn't
// mean an alert on every trip past it.
export const NEARBY_COOLDOWN_MS    = 24 * 60 * 60 * 1000;
// A fix vaguer than this can't tell 300 m from 700 m; it's skipped.
export const NEARBY_MAX_ACCURACY_M = 150;
// The Android notification channel, so "Nearby spots" can be muted in the
// phone's settings without muting arrivals.
export const NEARBY_CHANNEL_ID     = "nearby-spots";

const RAD = Math.PI / 180;
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * RAD;
  const dLng = (lng2 - lng1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const coordsOf = (spot) => {
  if (spot?.coordinates?.lat != null && spot?.coordinates?.lng != null) return { lat: spot.coordinates.lat, lng: spot.coordinates.lng };
  if (spot?.latitude != null && spot?.longitude != null) return { lat: spot.latitude, lng: spot.longitude };
  return null;
};

/**
 * Which spots to announce for one location fix.
 *
 * @param spots        the spot list ({ _id, name, coordinates })
 * @param fix          { latitude, longitude, accuracy? }
 * @param notifiedAt   { [spotId]: ms } — when each spot was last announced
 * @param skip         spotIds never to announce now: visited, being arrived
 *                     at, or the one the traveler is already navigating to
 * @param innerMeters  closer than this is an arrival, not "nearby"
 * @returns { due, notifiedAt } — `due` nearest first, each
 *          { spotId, spotName, lat, lng, distance }; `notifiedAt` with the due
 *          spots stamped and entries older than a day dropped
 */
export function nearbyToAnnounce({
  spots = [], fix, notifiedAt = {}, skip = new Set(), now = Date.now(),
  innerMeters = 50, radius = NEARBY_RADIUS_METERS,
}) {
  const kept = {};
  for (const [id, at] of Object.entries(notifiedAt || {})) {
    if (now - at < NEARBY_COOLDOWN_MS) kept[id] = at;
  }
  if (!fix || !Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude)) return { due: [], notifiedAt: kept };
  if (Number.isFinite(fix.accuracy) && fix.accuracy > NEARBY_MAX_ACCURACY_M) return { due: [], notifiedAt: kept };

  const due = [];
  for (const spot of spots) {
    const spotId = String(spot?._id ?? "").trim();
    const c = coordsOf(spot);
    if (!spotId || !c || skip.has(spotId) || kept[spotId]) continue;
    const distance = distanceMeters(fix.latitude, fix.longitude, c.lat, c.lng);
    if (distance > innerMeters && distance <= radius) {
      due.push({ spotId, spotName: spot.name || "A tourist spot", lat: c.lat, lng: c.lng, distance });
    }
  }
  due.sort((a, b) => a.distance - b.distance);
  for (const s of due) kept[s.spotId] = now;
  return { due, notifiedAt: kept };
}

const roughly = (m) => (m < 100 ? "less than 100 m" : `about ${Math.round(m / 50) * 50} m`);

/** What the notification says. `due` is nearest first; a tap opens directions to the first. */
export function nearbyNoticeContent(due) {
  const first = due[0];
  const data = {
    type: "nearby",
    spotId: first.spotId,
    spotName: first.spotName,
    lat: first.lat,
    lng: first.lng,
    spotIds: due.map((s) => s.spotId),
  };
  if (due.length === 1) {
    return {
      title: `${first.spotName} is nearby`,
      body: `It's ${roughly(first.distance)} away. Tap for directions.`,
      data,
    };
  }
  return {
    title: `${due.length} spots are near you`,
    body: `${joinNames(due.map((s) => s.spotName))}. The nearest is ${roughly(first.distance)} away — tap for directions.`,
    data,
  };
}
