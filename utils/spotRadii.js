// Each spot's arrival radius (how close counts as being there) and nearby-alert
// radius (how far out "<spot> is nearby" comes). A moderator can set a spot's
// own in the admin panel, approved by an admin; a spot that never did has
// neither field and uses the defaults, which every spot used before
// 2026-10-20. The backend's utils/spotRadii.js falls back the same way and
// only takes values above 0, with the nearby radius wider than the arrival
// one (no upper or lower limit).
export const DEFAULT_ARRIVAL_RADIUS_M = 50;
export const DEFAULT_NEARBY_RADIUS_M  = 500;

const isSet = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

export const arrivalRadiusOf = (spot, fallback = DEFAULT_ARRIVAL_RADIUS_M) =>
  (isSet(spot?.arrivalRadiusMeters) ? spot.arrivalRadiusMeters : fallback);

export const nearbyRadiusOf = (spot, fallback = DEFAULT_NEARBY_RADIUS_M) =>
  (isSet(spot?.nearbyRadiusMeters) ? spot.nearbyRadiusMeters : fallback);
