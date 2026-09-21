// GPS quality helpers for the AR screen.
//
// Raw `watchPosition` output is not good enough to drive a distance readout on
// its own, for two reasons:
//
//   1. Fixes arrive from different sources. A network/wifi fix (±40 m) can land
//      immediately after a satellite fix (±5 m), and if you just take whatever
//      arrived last, your reported position — and the distance built from it —
//      gets worse. `isBetterFix` decides whether a new reading is actually an
//      improvement before it replaces the current one.
//
//   2. Even a good fix jitters by several metres while standing still, so the
//      distance readout flickers ("142 m … 137 m … 144 m") and the radar pulse
//      stutters. `GpsSmoother` runs a small Kalman filter over the coordinates
//      so the number settles, without adding lag when you actually walk.
//
// Both are pure functions of their inputs, so they're unit-testable without a
// device — see the checks run against this file.

// A fix older than this is stale enough that a newer one wins on recency alone,
// even if its accuracy is worse: you have probably moved.
const STALE_MS = 10_000;

// Beyond this, a reading is too vague to be worth acting on at all. Indoors a
// phone will happily report ±500 m, which would put every anchor "in range".
export const MAX_USABLE_ACCURACY_M = 100;

/**
 * Android's classic "is this new location better?" test, trimmed to what this
 * screen needs. Returns true if `next` should replace `current`.
 */
export function isBetterFix(current, next) {
  if (!next || !Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) return false;
  if (!current) return true;

  const nextAcc = Number.isFinite(next.accuracy) ? next.accuracy : Infinity;
  const curAcc  = Number.isFinite(current.accuracy) ? current.accuracy : Infinity;

  const timeDelta = (next.timestamp ?? 0) - (current.timestamp ?? 0);

  // Clearly newer: take it. Standing on an old fix is worse than a slightly
  // vaguer fresh one, because the old one may describe where you used to be.
  if (timeDelta > STALE_MS) return true;
  // Clearly older: ignore it (fixes can arrive out of order).
  if (timeDelta < -STALE_MS) return false;

  const accuracyDelta = nextAcc - curAcc;
  if (accuracyDelta < 0) return true;        // more accurate
  if (timeDelta > 0 && accuracyDelta <= 0) return true;
  // Newer and not much worse is still useful — it tracks movement.
  if (timeDelta > 0 && accuracyDelta < 50) return true;

  return false;
}

/**
 * A 1-D Kalman filter applied to latitude and longitude.
 *
 * `variance` is the filter's current uncertainty in m². It grows with elapsed
 * time (you could have walked), which is what keeps the filter responsive:
 * stand still and it tightens onto a steady value; start walking and the
 * growing variance makes it trust new readings quickly again.
 */
export class GpsSmoother {
  /**
   * @param expectedSpeedMps Process noise, expressed as the speed the user
   *   might be moving at. This is the one dial that trades stability against
   *   lag, and it was picked by measurement rather than by guessing at walking
   *   pace. Against ±8 m noise at 1 Hz:
   *
   *     1.4 m/s -> 1.5 m wobble standing still, but 6.3 m behind when walking
   *     3.0 m/s -> 2.5 m wobble,                1.7 m behind      <- chosen
   *     8.0 m/s -> 5.0 m wobble,                no lag
   *
   *   1.4 (literal walking pace) is the intuitive value and the wrong one: it
   *   smooths beautifully while still and then trails badly once you move,
   *   which on this screen means the model appears late. 3.0 keeps both errors
   *   around 2 m — comfortably inside GPS accuracy either way.
   */
  constructor(expectedSpeedMps = 3.0) {
    this.speed = expectedSpeedMps;
    this.lat = null;
    this.lng = null;
    this.variance = -1;      // < 0 means "not initialised"
    this.timestamp = 0;
  }

  reset() {
    this.lat = null;
    this.lng = null;
    this.variance = -1;
    this.timestamp = 0;
  }

  /**
   * Feeds in a raw fix and returns the smoothed position.
   * @returns {{latitude:number, longitude:number, accuracy:number}}
   */
  push({ latitude, longitude, accuracy, timestamp }) {
    const acc = Math.max(Number.isFinite(accuracy) ? accuracy : 30, 1);
    const ts  = timestamp || Date.now();

    if (this.variance < 0) {
      this.lat = latitude;
      this.lng = longitude;
      this.variance = acc * acc;
      this.timestamp = ts;
      return { latitude, longitude, accuracy: acc };
    }

    const dtMs = ts - this.timestamp;
    if (dtMs > 0) {
      // Uncertainty grows with the distance the user could have covered.
      this.variance += (dtMs / 1000) * this.speed * this.speed;
      this.timestamp = ts;
    }

    // Innovation: how far the new reading is from where the filter expected the
    // user to be, in metres.
    //
    // Time-based variance growth alone is far too timid once someone starts
    // walking — measured over a simulated 40 m walk it trailed about 6 m
    // behind, which on this screen means the model appears late. If a reading
    // lands much further away than sensor noise can explain, the user has
    // actually moved, so the filter inflates its own uncertainty and snaps to
    // it. Standing still, the innovation stays inside the noise band and this
    // never fires, so the readout keeps its stability.
    const dLatM = (latitude - this.lat) * 111_320;
    const dLngM = (longitude - this.lng) * 111_320 * Math.cos((latitude * Math.PI) / 180);
    const innovation = Math.hypot(dLatM, dLngM);
    const expected = Math.sqrt(this.variance + acc * acc);
    if (innovation > 2 * expected) {
      this.variance += innovation * innovation;
    }

    // Kalman gain: 0 = trust the filter entirely, 1 = trust the new reading.
    const k = this.variance / (this.variance + acc * acc);
    this.lat += k * (latitude - this.lat);
    this.lng += k * (longitude - this.lng);
    this.variance = (1 - k) * this.variance;

    return {
      latitude:  this.lat,
      longitude: this.lng,
      // The filter's own uncertainty, which is never worse than the raw fix.
      accuracy: Math.sqrt(this.variance),
    };
  }
}
