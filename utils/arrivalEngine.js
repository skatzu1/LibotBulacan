/*
 * Arrival detection, as pure functions so every rule can be unit-tested
 * without a phone. ArrivalContext feeds GPS fixes in and acts on the result.
 *
 * What was wrong with "distance <= 50 m, every fix, always at full GPS rate":
 *
 * 1. Jitter at the edge. Standing near the 50 m line, normal GPS wander of a
 *    few metres flipped the state inside -> outside -> inside, repeating the
 *    arrival handling and its API calls. Fix: hysteresis — you arrive inside
 *    ENTER_M but only count as having left beyond EXIT_M.
 *
 * 2. Bad fixes counted. A ±150 m network fix, or one GPS jump off a building
 *    (multipath), could land inside the radius and trigger an arrival. Fix:
 *    ignore fixes too vague to judge, and require either one precise fix or two
 *    consecutive decent ones before declaring an arrival.
 *
 * 3. Full-rate GPS all day. The watch ran at high accuracy every 3 s / 5 m
 *    even when the nearest spot was 20 km away — the common case, and the
 *    app's biggest battery cost. Fix: the update rate follows the distance to
 *    the nearest spot (see watchTierFor), so GPS works hard only when an
 *    arrival is actually possible soon.
 */

export const ENTER_M = 50;              // arrive inside this distance…
export const EXIT_M = 80;               // …and only "leave" beyond this one
export const MAX_ENTRY_ACCURACY_M = 75; // vaguer fixes can't cause an arrival
export const MAX_EXIT_ACCURACY_M = 100; // or an exit
export const PRECISE_FIX_M = 20;        // one fix this good is enough on its own
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
 * @param spots  [{ id, lat, lng }]
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

    if (state.inside.has(spot.id)) {
      if (d > EXIT_M && acc <= MAX_EXIT_ACCURACY_M) {
        state.inside.delete(spot.id);
        left.push(spot.id);
      }
      continue;
    }

    const qualifies = d <= ENTER_M && acc <= MAX_ENTRY_ACCURACY_M;
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

/*
 * How hard GPS should work, from the distance to the nearest spot.
 *
 * The distance intervals are chosen so an arrival can't be skipped: you can't
 * get from beyond a tier's boundary to inside a spot's radius without the OS
 * delivering a fix in between (it reports on whichever of time or distance
 * comes first), and crossing into a nearer tier switches to faster updates.
 */
export const WATCH_TIERS = {
  near:     { key: 'near',     maxM: 400,      accuracy: 'high',     timeInterval: 3_000,  distanceInterval: 5 },
  approach: { key: 'approach', maxM: 2_500,    accuracy: 'high',     timeInterval: 8_000,  distanceInterval: 25 },
  far:      { key: 'far',      maxM: Infinity, accuracy: 'balanced', timeInterval: 20_000, distanceInterval: 150 },
};
const ORDER = ['near', 'approach', 'far'];

/**
 * The tier for `nearestM`. Moving to a nearer tier happens immediately;
 * moving back out needs 20 % beyond the boundary, so hovering around a
 * boundary doesn't restart the GPS watch over and over.
 */
export function watchTierFor(nearestM, currentKey = null) {
  if (!Number.isFinite(nearestM)) return WATCH_TIERS[currentKey] ?? WATCH_TIERS.approach;
  const target = ORDER.find((k) => nearestM <= WATCH_TIERS[k].maxM);
  if (!currentKey || ORDER.indexOf(target) <= ORDER.indexOf(currentKey)) return WATCH_TIERS[target];
  // Farther tier wanted: only leave the current one past its boundary + 20 %.
  return nearestM > WATCH_TIERS[currentKey].maxM * 1.2 ? WATCH_TIERS[target] : WATCH_TIERS[currentKey];
}
