/*
 * Which heading the AR radar trusts: ARCore Geospatial's when it's good,
 * otherwise the compass.
 *
 * ARCore's heading comes from matching the camera image against Google's
 * Visual Positioning Service; where the spot is covered it's typically within
 * a few degrees and immune to the magnetic interference that throws compasses
 * off near steel, concrete and cars. It only exists while Earth tracking is
 * converged, so the radar falls back to the compass whenever it's missing,
 * stale or not accurate enough.
 */

/** Use ARCore's heading only if its 95 % accuracy is at least this good. */
export const GEO_HEADING_MAX_ACCURACY_DEG = 15;
/** A reading older than this is stale (tracking lost, or polling stopped). */
export const GEO_HEADING_STALE_MS = 1500;
/** How often the AR scene reads ARCore's pose while the radar is shown. */
export const GEO_HEADING_POLL_MS = 250;

/** reading: { heading, accuracy, at } | null */
export function isGeoHeadingUsable(reading, now = Date.now()) {
  return Boolean(reading)
    && Number.isFinite(reading.heading)
    && Number.isFinite(reading.accuracy)
    && reading.accuracy <= GEO_HEADING_MAX_ACCURACY_DEG
    && now - reading.at <= GEO_HEADING_STALE_MS;
}

/**
 * A value that can be written from one component and read in another without
 * re-rendering anything in between. The AR scene writes ARCore's heading a few
 * times a second; only the radar subscribes, so the rest of the AR screen
 * never renders for it.
 */
export function createValueStore(initial = null) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set: (next) => {
      value = next;
      listeners.forEach((fn) => fn(next));
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
