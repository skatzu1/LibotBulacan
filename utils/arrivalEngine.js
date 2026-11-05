export const ENTER_M = 50;              // within this distance to be considered as arrived.
export const EXIT_M = 80;               // beyond this distance to be considered as left.
const EXIT_MARGIN_M = EXIT_M - ENTER_M;
export const MAX_ENTRY_ACCURACY_M = 75; // GPS must be accurate to 75m or better to trigger an arrival
export const MAX_EXIT_ACCURACY_M = 100; // GPs must be accurate to 100m or better to trigger a departure
export const PRECISE_FIX_M = 20;        // If GPS is this accurate, one reading is enough to confirm arrival
export const CONFIRM_FIXES = 2;         // otherwise, this many in a row

const R = 6_371_000;
const rad = (d) => (d * Math.PI) / 180;

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Fresh detector state. `inside` can be seeded from storage. */
export const createArrivalState = (inside = []) => ({
  inside: new Set(inside),
  pending: new Map(), // spotId -> consecutive qualifying fixes so far
});

/**
 * Feeds one fix in.
 *
 * @param state  from createArrivalState; mutated in place
 * @param fix    { latitude, longitude, accuracy }  (accuracy in metres, may be missing)
 * @param spots  [{ id, lat, lng, radius? }]  (radius: the spot's arrival radius, default ENTER_M)
 * @returns { entered: id[], left: id[], nearestM: number|null }
 */
export function evaluateFix(state, fix, spots) {
  const entered = [];
  const left = [];
  let nearestM = null;
  if (!fix || !Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude)) {
    return { entered, left, nearestM };
  }
  const acc = Number.isFinite(fix.accuracy) ? fix.accuracy : Infinity;

  for (const spot of spots) {
    const d = distanceMeters(fix.latitude, fix.longitude, spot.lat, spot.lng);
    if (nearestM === null || d < nearestM) nearestM = d;
    const enterM = spot.radius > 0 ? spot.radius : ENTER_M;

    if (state.inside.has(spot.id)) {
      if (d > enterM + EXIT_MARGIN_M && acc <= MAX_EXIT_ACCURACY_M) {
        state.inside.delete(spot.id);
        left.push(spot.id);
      }
      continue;
    }

    const qualifies = d <= enterM && acc <= MAX_ENTRY_ACCURACY_M;
    if (!qualifies) {
      state.pending.delete(spot.id);
      continue;
    }
    const seen = (state.pending.get(spot.id) ?? 0) + 1;
    if (acc <= PRECISE_FIX_M || seen >= CONFIRM_FIXES) {
      state.pending.delete(spot.id);
      state.inside.add(spot.id);
      entered.push(spot.id);
    } else {
      state.pending.set(spot.id, seen);
    }
  }
  return { entered, left, nearestM };
}

export const WATCH_TIERS = {
  near:     { key: 'near',     maxM: 400,      accuracy: 'high',     timeInterval: 3_000,  distanceInterval: 5 },
  approach: { key: 'approach', maxM: 2_500,    accuracy: 'high',     timeInterval: 8_000,  distanceInterval: 25 },
  far:      { key: 'far',      maxM: Infinity, accuracy: 'balanced', timeInterval: 20_000, distanceInterval: 150 },
};
const ORDER = ['near', 'approach', 'far'];

export function watchTierFor(nearestM, currentKey = null) {
  if (!Number.isFinite(nearestM)) return WATCH_TIERS[currentKey] ?? WATCH_TIERS.approach;
  const target = ORDER.find((k) => nearestM <= WATCH_TIERS[k].maxM);
  if (!currentKey || ORDER.indexOf(target) <= ORDER.indexOf(currentKey)) return WATCH_TIERS[target];
  // Farther tier wanted: only leave the current one past its boundary + 20 %.
  return nearestM > WATCH_TIERS[currentKey].maxM * 1.2 ? WATCH_TIERS[target] : WATCH_TIERS[currentKey];
}
