// ARCore Geospatial helpers.
//
// WHAT THIS CHANGES
// Until now the AR model was placed on whatever horizontal plane the camera
// happened to find, and GPS only decided *whether* to show it. The model was
// therefore never at a real-world location — it sat on the floor in front of
// you, wherever you happened to be standing.
//
// Geospatial anchors fix that: ARCore resolves the device's pose against
// Google's VPS (built on Street View imagery) and can then place content at a
// true latitude/longitude, so the model stays put as you walk around it.
//
// WHEN IT WORKS
// Only where VPS has coverage, which follows Street View. Outside coverage
// ARCore falls back to GNSS + sensors, whose accuracy is no better than the
// GPS the app already uses — so there is no point paying the extra complexity
// there. Every function below is therefore written to fail soft: if anything
// is unsupported, unavailable, or errors, the caller falls back to the
// existing plane-based placement rather than showing nothing.

/**
 * Horizontal accuracy (metres) required before a geospatial pose is used.
 *
 * This is the ONE guard kept after VPS coverage was confirmed, and it is not a
 * coverage check — it's how you tell a real VPS fix from ARCore silently
 * falling back to GNSS. A resolved VPS pose is typically well under a metre;
 * a GNSS fallback is 5–20 m+. Using a GNSS-grade pose as though it were
 * geospatial would place the model at a wrong world position — quite possibly
 * inside a building or across the road — which is worse than the plane
 * placement it replaced.
 *
 * Raise it if you want to accept looser fixes; 10 m still separates the two
 * cases cleanly.
 */
export const GEO_ACCURACY_LIMIT_M = 10;

/**
 * Earth tracking states that mean the pose can be trusted.
 *
 * Viro reports Earth tracking as "Enabled" | "Paused" | "Stopped" — its enum
 * is ARScene.EarthTrackingState { ENABLED, PAUSED, STOPPED }, and "Enabled" is
 * its name for ARCore's TRACKING. This set used to contain only "TRACKING" /
 * "tracking", which Viro never returns, so every evaluation ended as
 * "earth-not-tracking" after 30 s of retries and geospatial placement never
 * switched on. The accuracy limit below still guards against a coarse pose.
 */
const EARTH_OK = new Set(["Enabled", "ENABLED", "TRACKING", "tracking"]);

export const isEarthTracking = (state) => EARTH_OK.has(String(state));

// setGeospatialModeEnabled reconfigures the ARCore session, so call it once
// per navigator. evaluateGeospatial used to call it on every retry — up to 15
// reconfigurations while Earth tracking was still converging.
const geoEnabled = new WeakSet();

/**
 * Turns geospatial mode on for this navigator if the device supports it.
 * Returns true when it's on. Safe to call repeatedly.
 */
export async function ensureGeospatialEnabled(nav) {
  if (!nav || typeof nav.isGeospatialModeSupported !== "function") return false;
  if (geoEnabled.has(nav)) return true;
  try {
    const support = await nav.isGeospatialModeSupported();
    if (!support?.supported) return false;
    nav.setGeospatialModeEnabled(true);
    geoEnabled.add(nav);
    return true;
  } catch {
    return false;
  }
}

/**
 * The camera's heading from ARCore Geospatial, or null when Earth isn't
 * tracking or there's no pose. Where Google's VPS covers the spot this is
 * accurate to a few degrees and — unlike the magnetometer — unaffected by
 * steel, concrete or a nearby car, and valid with the phone held upright.
 *
 * @returns {Promise<{heading: number, accuracy: number, at: number} | null>}
 */
export async function readGeoHeading(nav) {
  if (!nav || typeof nav.getCameraGeospatialPose !== "function") return null;
  try {
    const earth = await nav.getEarthTrackingState();
    if (!isEarthTracking(earth?.state)) return null;
    const res = await nav.getCameraGeospatialPose();
    const pose = res?.pose;
    if (!res?.success || !Number.isFinite(pose?.heading) || !Number.isFinite(pose?.headingAccuracy)) return null;
    return { heading: ((pose.heading % 360) + 360) % 360, accuracy: pose.headingAccuracy, at: Date.now() };
  } catch {
    return null;
  }
}

/**
 * Decides, in one call, whether geospatial placement should be used here.
 *
 * Kept as a single function returning a reason string because the AR screen
 * needs to *explain* the outcome to the user, not just branch on a boolean.
 *
 * @param nav   the `sceneNavigator` handed to a Viro scene
 * @param lat   target latitude
 * @param lng   target longitude
 * @returns {Promise<{usable: boolean, reason: string, accuracy?: number}>}
 */
export async function evaluateGeospatial(nav, lat, lng) {
  if (!nav || typeof nav.isGeospatialModeSupported !== "function") {
    return { usable: false, reason: "unsupported-build" };
  }

  try {
    if (!geoEnabled.has(nav)) {
      const support = await nav.isGeospatialModeSupported();
      if (!support?.supported) {
        // Device lacks ARCore Geospatial, or the API key is missing/invalid.
        return { usable: false, reason: support?.error ? "auth-or-device" : "device" };
      }
      nav.setGeospatialModeEnabled(true);
      geoEnabled.add(nav);
    }

    // The pre-flight `checkVPSAvailability` gate is deliberately gone: VPS
    // coverage at these spots is confirmed, and that call is an extra network
    // round-trip that can return UNKNOWN on a slow connection and would then
    // refuse geospatial somewhere it actually works. It's logged for
    // diagnostics only — never used to refuse.
    // Promise.resolve().then(...) so that a *synchronous* throw from this call
    // is turned into a rejected promise and swallowed too — a diagnostic log
    // must never be able to take down geospatial placement.
    Promise.resolve()
      .then(() => nav.checkVPSAvailability?.(lat, lng))
      .then((v) => console.log("[Geospatial] VPS availability:", v?.availability))
      .catch(() => {});

    // Earth tracking needs a moment and some camera movement before it
    // converges; the caller is expected to retry rather than give up here.
    const earth = await nav.getEarthTrackingState();
    if (!isEarthTracking(earth?.state)) {
      return { usable: false, reason: "earth-not-tracking" };
    }

    const poseRes = await nav.getCameraGeospatialPose();
    const acc = poseRes?.pose?.horizontalAccuracy;
    if (!poseRes?.success || !Number.isFinite(acc)) {
      return { usable: false, reason: "no-pose" };
    }
    if (acc > GEO_ACCURACY_LIMIT_M) {
      return { usable: false, reason: "low-accuracy", accuracy: acc };
    }

    return { usable: true, reason: "ok", accuracy: acc };
  } catch (err) {
    console.warn("[Geospatial] evaluation failed:", err?.message || err);
    return { usable: false, reason: "error" };
  }
}

/**
 * Places a terrain anchor at a real lat/lng and returns the world position to
 * render content at.
 *
 * Terrain (not WGS84) anchors are used deliberately: a WGS84 anchor needs an
 * absolute altitude above the ellipsoid, which the spot records don't have and
 * which is easy to get badly wrong. A terrain anchor asks ARCore to resolve
 * ground level itself and place the model `heightAboveGround` above it.
 *
 * @returns {Promise<{position: [number,number,number], anchorId: string} | null>}
 */
export async function anchorAtLocation(nav, lat, lng, heightAboveGround = 0) {
  if (!nav || typeof nav.createTerrainAnchor !== "function") return null;
  try {
    const res = await nav.createTerrainAnchor(lat, lng, heightAboveGround);
    if (!res?.success || !res.anchor?.position) {
      if (res?.error) console.warn("[Geospatial] anchor failed:", res.error);
      return null;
    }
    return { position: res.anchor.position, anchorId: res.anchor.anchorId };
  } catch (err) {
    console.warn("[Geospatial] anchor threw:", err?.message || err);
    return null;
  }
}

/** Releases an anchor. Safe to call with a null id. */
export async function releaseAnchor(nav, anchorId) {
  if (!nav || !anchorId || typeof nav.removeGeospatialAnchor !== "function") return;
  try {
    await nav.removeGeospatialAnchor(anchorId);
  } catch {
    // Session may already be gone — nothing useful to do.
  }
}

/** Plain-language explanation for each `reason`, for the HUD. */
export function explainReason(reason) {
  switch (reason) {
    case "earth-not-tracking":
      return "Getting your bearings — point the camera at buildings nearby.";
    case "low-accuracy":
      return "Location isn't precise enough yet — using standard AR.";
    case "device":
    case "unsupported-build":
      return "This phone doesn't support precise AR placement.";
    case "auth-or-device":
      return "Precise AR placement isn't set up — using standard AR.";
    default:
      return "Using standard AR placement.";
  }
}
