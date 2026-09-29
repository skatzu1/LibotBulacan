import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { HeadingFilter, shouldEmit } from "../utils/headingFilter";
import { isGeoHeadingUsable, GEO_HEADING_STALE_MS } from "../utils/headingSource";

/*
 * The heading the AR radar points with.
 *
 * Sources, best first:
 *   1. ARCore Geospatial (optional `geoStore`, written by the AR scene): where
 *      Google's VPS covers the spot it's within a few degrees, immune to
 *      magnetic interference, and it's the direction the CAMERA faces — which
 *      is what AR needs — rather than the top edge of the phone.
 *   2. expo-location watchHeadingAsync: the OS's own sensor fusion
 *      (magnetometer + accelerometer + gyroscope).
 *   3. Tilt-compensated magnetometer + accelerometer, when (2) is unavailable.
 * While a usable ARCore reading is fresh the compass is ignored; when ARCore
 * loses tracking the compass takes over after GEO_HEADING_STALE_MS. Both feed
 * the same filter, so switching source doesn't make the arrow jump.
 *
 * Smoothing is a One Euro filter (utils/headingFilter.js): steady when the
 * phone is still, responsive while turning. State only changes when the
 * smoothed heading moves ≥ 1° and at most ~30 times a second — the sensors
 * report far more often than the radar can show, and every setHeading is a
 * render.
 *
 * Returns { heading, needsCalibration, precise }:
 *   needsCalibration — the OS says the magnetometer is unreliable (Android
 *     accuracy 0–1 of 3; iOS error > 25°) and the compass is what's in use;
 *     fixed by moving the phone in a figure 8.
 *   precise — the heading currently comes from ARCore Geospatial.
 */
export default function useCompassHeading(geoStore = null) {
  const [heading, setHeading] = useState(0);
  const [needsCalibration, setNeedsCalibration] = useState(false);
  const [source, setSource] = useState("compass");
  const filterRef = useRef(new HeadingFilter());
  const emittedRef = useRef({ value: null, at: 0 });
  const lastGeoAtRef = useRef(0);

  const applyReading = useCallback((raw, now = Date.now()) => {
    const smoothed = filterRef.current.push(raw, now);
    const last = emittedRef.current;
    if (smoothed !== null && shouldEmit(last.value, smoothed, last.at, now)) {
      emittedRef.current = { value: smoothed, at: now };
      setHeading(smoothed);
    }
  }, []);

  const applyCompass = useCallback((raw) => {
    const now = Date.now();
    if (now - lastGeoAtRef.current <= GEO_HEADING_STALE_MS) return; // ARCore has it
    setSource("compass");
    applyReading(raw, now);
  }, [applyReading]);

  // ── Source 1: ARCore Geospatial ──────────────────────────────────────
  useEffect(() => {
    if (!geoStore) return undefined;
    return geoStore.subscribe((reading) => {
      const now = Date.now();
      if (!isGeoHeadingUsable(reading, now)) return;
      lastGeoAtRef.current = now;
      setSource("geo");
      applyReading(reading.heading, now);
    });
  }, [geoStore, applyReading]);

  useEffect(() => {
    let headingSub = null;
    let magSub     = null;
    let accSub     = null;

    // ── Source 2: expo-location watchHeadingAsync ──────────────────────
    const tryLocationHeading = async () => {
      try {
        const Location = require("expo-location");
        headingSub = await Location.watchHeadingAsync((data) => {
          // trueHeading is -1 when GPS unavailable; fall back to magHeading
          const raw = data.trueHeading >= 0 ? data.trueHeading : data.magHeading;
          if (raw >= 0) applyCompass(raw);
          if (Number.isFinite(data.accuracy)) {
            const poor = Platform.OS === "android" ? data.accuracy <= 1 : data.accuracy > 25;
            setNeedsCalibration((prev) => (prev === poor ? prev : poor));
          }
        });
        return true;
      } catch (_) {
        return false;
      }
    };

    // ── Source 3: tilt-compensated Magnetometer + Accelerometer ────────
    const tryTiltCompensated = async () => {
      try {
        const { Magnetometer, Accelerometer } = require("expo-sensors");

        const magOk = await Magnetometer.isAvailableAsync().catch(() => false);
        if (!magOk) return;

        Magnetometer.setUpdateInterval(50);   // 20 Hz
        Accelerometer.setUpdateInterval(50);

        // Default: phone held upright in portrait (camera facing forward)
        let mag = { x: 0, y: 1, z: 0 };
        let acc = { x: 0, y: 0, z: -1 };

        const compute = () => {
          const { x: ax, y: ay, z: az } = acc;
          const { x: mx, y: my, z: mz } = mag;

          // Normalize gravity vector
          const na = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
          const nx = ax / na, ny = ay / na, nz = az / na;

          // Pitch (rotation around X) and roll (rotation around Z)
          const pitch = Math.asin(-Math.max(-1, Math.min(1, nx)));
          const roll  = Math.atan2(ny, nz);

          const cp = Math.cos(pitch), sp = Math.sin(pitch);
          const cr = Math.cos(roll),  sr = Math.sin(roll);

          // Project magnetometer into the horizontal plane
          const xh =  mx * cp      + mz * sp;
          const yh =  mx * sr * sp + my * cr - mz * sr * cp;

          let angle = Math.atan2(-yh, xh) * (180 / Math.PI);
          angle = (angle + 360) % 360;
          applyCompass(angle);
        };

        // Mag fires the heading update; acc keeps tilt current
        magSub = Magnetometer.addListener((d)  => { mag = d; compute(); });
        accSub = Accelerometer.addListener((d) => { acc = d; });
      } catch (_) {
        // Both strategies failed — heading stays 0 (arrow points north)
      }
    };

    (async () => {
      const ok = await tryLocationHeading();
      if (!ok) await tryTiltCompensated();
    })();

    return () => {
      headingSub?.remove();
      magSub?.remove();
      accSub?.remove();
    };
  }, [applyCompass]);

  const precise = source === "geo";
  return { heading, needsCalibration: needsCalibration && !precise, precise };
}
