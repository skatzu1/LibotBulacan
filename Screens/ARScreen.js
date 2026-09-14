import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  StatusBar,
  Dimensions,
  Easing,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Geolocation from "@react-native-community/geolocation";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMissions } from "../context/MissionContext";
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroARPlane,
  Viro3DObject,
  ViroNode,
  ViroText,
  ViroAmbientLight,
  ViroSpotLight,
  ViroAnimations,
  isARSupportedOnDevice,
  ViroTrackingStateConstants,
} from "@reactvision/react-viro";

// ─────────────────────────────────────────────
// COMPASS HEADING HOOK  (tilt-aware, real-time)
// Strategy 1 — expo-location watchHeadingAsync:
//   Uses the OS's own sensor fusion (mag + accel + gyro).
//   Correct for any phone orientation including upright AR use.
// Strategy 2 — tilt-compensated Magnetometer + Accelerometer:
//   Fallback when expo-location is unavailable. Uses pitch/roll
//   from the accelerometer to project the mag vector into the
//   horizontal plane before computing the bearing.
// ─────────────────────────────────────────────
function useCompassHeading() {
  const [heading, setHeading] = useState(0);
  const smoothedRef = useRef(null);

  // Exponential moving average — handles 0/360 wraparound cleanly
  const applyEMA = useCallback((raw) => {
    if (smoothedRef.current === null) {
      smoothedRef.current = raw;
      return raw;
    }
    let diff = raw - smoothedRef.current;
    if (diff >  180) diff -= 360;
    if (diff < -180) diff += 360;
    smoothedRef.current = (smoothedRef.current + diff * 0.3 + 360) % 360;
    return smoothedRef.current;
  }, []);

  useEffect(() => {
    let headingSub = null;
    let magSub     = null;
    let accSub     = null;

    // ── Strategy 1: expo-location watchHeadingAsync ──────────────────
    const tryLocationHeading = async () => {
      try {
        const Location = require("expo-location");
        headingSub = await Location.watchHeadingAsync((data) => {
          // trueHeading is -1 when GPS unavailable; fall back to magHeading
          const raw = data.trueHeading >= 0 ? data.trueHeading : data.magHeading;
          if (raw >= 0) setHeading(applyEMA(raw));
        });
        return true;
      } catch (_) {
        return false;
      }
    };

    // ── Strategy 2: tilt-compensated Magnetometer + Accelerometer ────
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
          setHeading(applyEMA(angle));
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
  }, [applyEMA]);

  return heading;
}

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
// The AR HUD always sits on top of a live camera feed, so it stays dark-panel /
// light-text in every app theme. Only the accent hues follow the brand:
// yellow (`cta`/`gold`) for actions & progress, cyan (`info`) for direction.
const TOKEN = {
  bg:           "#0E1C1E",
  surface:      "rgba(16,32,34,0.90)",
  surfaceHigh:  "rgba(24,48,50,0.95)",
  surfaceMid:   "rgba(34,60,60,0.88)",
  border:       "rgba(120,204,208,0.18)",
  borderAccent: "rgba(120,204,208,0.42)",
  textPrimary:  "#EAF6F7",
  textSecond:   "#A6BEC0",
  textMuted:    "#7C9698",
  gold:         "#F2CE1B",
  goldLight:    "#F6DF5C",
  goldDim:      "rgba(242,206,27,0.16)",
  success:      "#57C795",
  successDim:   "rgba(87,199,149,0.18)",
  warn:         "#E7B45C",
  danger:       "#E97A7A",
  dangerDim:    "rgba(233,122,122,0.18)",
  info:         "#4FD0DC",
  infoLight:    "#8BE4EC",
  cta:          "#F2CE1B",
  ctaLight:     "#F6DF5C",
  ctaText:      "#2C2810",
  radiusSm:     8,
  radiusMd:     14,
  radiusLg:     20,
  radiusXl:     28,
  spaceSm:      8,
  spaceMd:      16,
  spaceLg:      24,
};

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const BASE_MODEL_RADIUS_METERS = 90;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─────────────────────────────────────────────
// HAPTICS
// ─────────────────────────────────────────────
// Every call is fire-and-forget and swallowed: haptics are a nice-to-have,
// and they throw on devices/emulators without a vibrator. Nothing in the AR
// flow should ever fail because a buzz didn't land.
const buzz = {
  encounter: () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {} },
  tap:       () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {} },
  complete:  () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {} },
  tick:      () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} },
};

// ─────────────────────────────────────────────
// ENCOUNTER FLASH
// ─────────────────────────────────────────────
// The Pokémon GO "something appeared!" beat. Fires once each time the user
// crosses into an AR zone: a gold shockwave ring expands from the centre
// while a banner drops in, then both clear themselves so the camera view is
// unobstructed again. `trigger` is a counter — bumping it replays the effect.
const EncounterFlash = ({ trigger, label }) => {
  const ring   = useRef(new Animated.Value(0)).current;
  const banner = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setVisible(true);
    ring.setValue(0);
    banner.setValue(0);

    Animated.parallel([
      Animated.timing(ring, {
        toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(banner, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(banner, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => { if (finished) setVisible(false); });
  }, [trigger]);

  if (!visible) return null;

  const ringSize = Math.max(SCREEN_W, SCREEN_H) * 1.15;

  return (
    <View style={flashSt.overlay} pointerEvents="none">
      <Animated.View
        style={[
          flashSt.ring,
          {
            width: ringSize, height: ringSize, borderRadius: ringSize / 2,
            opacity:   ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          flashSt.banner,
          {
            opacity:   banner,
            transform: [
              { translateY: banner.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
              { scale:      banner.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            ],
          },
        ]}
      >
        <Feather name="zap" size={15} color={TOKEN.ctaText} />
        <Text style={flashSt.bannerText} numberOfLines={1}>
          {label ? `${label.toUpperCase()} FOUND!` : "OBJECT FOUND!"}
        </Text>
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────
// PROXIMITY RADAR
// ─────────────────────────────────────────────
// Replaces the old linear progress bar for the "still walking there" state.
// Concentric rings sweep outward and the pulse speeds up as the target gets
// closer, so distance is felt rather than read — the radar reads at a glance
// while walking, which a thin progress bar never did.
// Metres are only readable up to a point: a spot 30 km away rendered as
// "30284 m", which both overflowed the radar dial and told the user nothing
// useful. Switch to km past 1000 m, and keep the digit count short so it
// always fits inside the circle.
function formatDistance(m) {
  if (m >= 1000) {
    const km = m / 1000;
    return { value: km >= 10 ? String(Math.round(km)) : km.toFixed(1), unit: "km" };
  }
  return { value: String(Math.round(m)), unit: "m" };
}

const ProximityRadar = ({ metersToEdge, radius }) => {
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;

  // 0 (far) → 1 (at the edge). Drives both colour and pulse speed.
  const closeness = Math.max(0, Math.min(1, 1 - metersToEdge / Math.max(radius * 4, 1)));
  const period    = 1600 - closeness * 900; // 1600ms far → 700ms near

  useEffect(() => {
    const mk = (v, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: period, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const a = mk(wave1, 0);
    const b = mk(wave2, period / 2);
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
  }, [period]);

  const tint = closeness > 0.75 ? TOKEN.gold : closeness > 0.4 ? TOKEN.infoLight : TOKEN.info;
  const dist = formatDistance(metersToEdge);

  const waveStyle = (v) => ({
    opacity:   v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.35] }) }],
    borderColor: tint,
  });

  return (
    <View style={radarSt.wrap}>
      <View style={radarSt.radar}>
        <Animated.View style={[radarSt.wave, waveStyle(wave1)]} />
        <Animated.View style={[radarSt.wave, waveStyle(wave2)]} />
        <View style={[radarSt.core, { borderColor: tint }]}>
          <Text
            style={[radarSt.coreNum, { color: tint, fontSize: dist.value.length >= 4 ? 20 : 26 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {dist.value}
          </Text>
          <Text style={radarSt.coreUnit}>{dist.unit}</Text>
        </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// PROGRESS PIPS
// ─────────────────────────────────────────────
// Visual stand-in for the old "2 / 5 tapped" text — reads instantly at a
// glance the way Pokémon GO's catch indicators do.
const ProgressPips = ({ total, done }) => {
  if (!total || total < 2) return null;
  return (
    <View style={pipSt.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[pipSt.pip, i < done && pipSt.pipDone]} />
      ))}
    </View>
  );
};

const flashSt = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ring: {
    position:    "absolute",
    borderWidth: 3,
    borderColor: TOKEN.gold,
  },
  banner: {
    position:        "absolute",
    top:             SCREEN_H * 0.18,
    flexDirection:   "row",
    alignItems:      "center",
    gap:             8,
    backgroundColor: TOKEN.cta,
    paddingHorizontal: 20,
    paddingVertical:   11,
    borderRadius:      TOKEN.radiusXl,
    shadowColor:   TOKEN.gold,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius:  18,
    elevation:     16,
  },
  bannerText: {
    color: TOKEN.ctaText, fontSize: 14, fontWeight: "900", letterSpacing: 0.8,
  },
});

const RADAR = 132;
const radarSt = StyleSheet.create({
  wrap:  { alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  radar: { width: RADAR, height: RADAR, alignItems: "center", justifyContent: "center" },
  wave: {
    position:    "absolute",
    width:       RADAR,
    height:      RADAR,
    borderRadius: RADAR / 2,
    borderWidth: 2,
  },
  core: {
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 2,
    backgroundColor: TOKEN.surfaceHigh,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row",
  },
  coreNum:  { fontSize: 26, fontWeight: "900", letterSpacing: -1 },
  coreUnit: { fontSize: 12, fontWeight: "700", color: TOKEN.textSecond, marginLeft: 2, marginTop: 6 },
});

// ─────────────────────────────────────────────
// HOW-IT-WORKS GUIDE
// ─────────────────────────────────────────────
// Shown automatically the first time anyone opens an AR mission, and re-openable
// any time from the "?" button. Without this, a first-time user landed on a
// live camera feed with no idea that the job is to walk somewhere, look
// around, and tap something.
const AR_GUIDE_SEEN_KEY = "arGuideSeen_v1";

const HowItWorks = ({ visible, onClose }) => {
  const steps = [
    { icon: "navigation", title: "Walk to the landmark",
      body: "The arrow and radar point the way. The object only appears once you're close enough." },
    { icon: "camera",     title: "Look around slowly",
      body: "Point your camera at the ground or a flat surface nearby so the object can settle into place." },
    { icon: "aperture",   title: "Tap the object",
      body: "Tap it to read its story. Tap every object at this landmark to finish the mission." },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={guideSt.backdrop}>
        <View style={guideSt.card}>
          <View style={guideSt.header}>
            <Feather name="compass" size={18} color={TOKEN.gold} />
            <Text style={guideSt.title}>How AR missions work</Text>
          </View>

          {steps.map((s, i) => (
            <View key={s.title} style={guideSt.step}>
              <View style={guideSt.stepIcon}>
                <Feather name={s.icon} size={15} color={TOKEN.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={guideSt.stepTitle}>{i + 1}. {s.title}</Text>
                <Text style={guideSt.stepBody}>{s.body}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={guideSt.cta}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close the how it works guide"
          >
            <Text style={guideSt.ctaText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const guideSt = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center", justifyContent: "center", padding: 26,
  },
  card: {
    width: "100%", maxWidth: 380,
    backgroundColor: TOKEN.surfaceHigh,
    borderRadius: TOKEN.radiusLg,
    borderWidth: 1, borderColor: TOKEN.borderAccent,
    padding: 22, gap: 16,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  title:  { color: TOKEN.textPrimary, fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  step:   { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: TOKEN.goldDim,
    alignItems: "center", justifyContent: "center",
  },
  stepTitle: { color: TOKEN.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: 3 },
  stepBody:  { color: TOKEN.textSecond, fontSize: 12.5, lineHeight: 18 },
  cta: {
    backgroundColor: TOKEN.cta, borderRadius: TOKEN.radiusXl,
    paddingVertical: 13, alignItems: "center", marginTop: 2,
  },
  ctaText: { color: TOKEN.ctaText, fontSize: 14, fontWeight: "900", letterSpacing: 0.6 },
});

const pipSt = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  pip: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: TOKEN.textMuted,
  },
  pipDone: { backgroundColor: TOKEN.gold, borderColor: TOKEN.gold },
});

// ─────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────
ViroAnimations.registerAnimations({
  fadeIn:   { properties: { opacity: 1 }, duration: 600 },
  slowSpin: { properties: { rotateY: "+=360" }, duration: 6000, easing: "Linear" },
  wiggle:   { properties: { rotateY: "+=20" },  duration: 250,  easing: "EaseInEaseOut" },
});

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R     = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLon  = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function assignRadii(anchors) {
  const n     = anchors.length;
  const radii = Array(n).fill(BASE_MODEL_RADIUS_METERS);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d    = distanceMeters(anchors[i].lat, anchors[i].lng, anchors[j].lat, anchors[j].lng);
      const half = d / 2;
      if (half < BASE_MODEL_RADIUS_METERS) {
        const cap = Math.max(15, half);
        if (cap < radii[i]) radii[i] = cap;
        if (cap < radii[j]) radii[j] = cap;
      }
    }
  }
  return radii;
}

function computeAnchorProximities(spot, userLat, userLon) {
  const anchors = spot.modelsCoordinates ?? [];
  const radii   = assignRadii(anchors);
  return anchors
    .map((anchor, index) => {
      const distance = Math.round(distanceMeters(userLat, userLon, anchor.lat, anchor.lng));
      const radius   = radii[index];
      return {
        index,
        label:     anchor.label ?? `Model ${index + 1}`,
        lat:       anchor.lat,
        lng:       anchor.lng,
        distance,
        radius,
        isInRange: distance <= radius,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

// ─────────────────────────────────────────────
// DIRECTIONAL ARROW INDICATOR
// ─────────────────────────────────────────────
const DirectionalArrow = ({ anchors, tappedIndices, userLocation, compassHeading }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  // Cumulative absolute rotation for shortest-arc animation
  const currentDeg  = useRef(0);

  // Distance trend tracking
  const prevDistRef = useRef(null);
  const [distTrend, setDistTrend] = useState(null); // 'closer' | 'farther' | null

  // ── Find next untapped anchor (by original index order) ──
  const nextTarget = anchors
    .map((a, i) => ({ ...a, originalIndex: i }))
    .find((a) => !tappedIndices.has(a.originalIndex));

  const allDone      = !nextTarget;
  const targetNumber = nextTarget ? nextTarget.originalIndex + 1 : anchors.length;

  const ordinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // ── Distance to next target ──
  const dist =
    nextTarget && userLocation
      ? Math.round(distanceMeters(
          userLocation.latitude, userLocation.longitude,
          nextTarget.lat, nextTarget.lng,
        ))
      : null;

  // Update distance trend whenever dist changes
  useEffect(() => {
    if (dist === null) return;
    if (prevDistRef.current !== null) {
      const delta = dist - prevDistRef.current;
      if (Math.abs(delta) >= 3) {
        setDistTrend(delta < 0 ? "closer" : "farther");
      }
    }
    prevDistRef.current = dist;
  }, [dist]);

  // ── Alignment angle: degrees between user's facing and target bearing ──
  const alignmentAngle = (() => {
    if (!nextTarget || !userLocation) return null;
    const targetBearing = bearingDegrees(
      userLocation.latitude, userLocation.longitude,
      nextTarget.lat, nextTarget.lng,
    );
    let diff = Math.abs(targetBearing - compassHeading);
    if (diff > 180) diff = 360 - diff;
    return diff; // 0 = perfectly aligned, 180 = facing directly away
  })();

  // ── Color + guidance label from alignment ──
  const getDirectionState = (angle) => {
    if (angle === null) return { color: TOKEN.goldLight, label: null };
    if (angle <= 25) {
      return { color: TOKEN.success, label: "On track ✓" };
    }
    if (angle <= 90) {
      const targetBearing = bearingDegrees(
        userLocation.latitude, userLocation.longitude,
        nextTarget.lat, nextTarget.lng,
      );
      const signedDiff = ((targetBearing - compassHeading) + 360) % 360;
      const side = signedDiff < 180 ? "right →" : "← left";
      return { color: TOKEN.warn, label: `Bear ${side}` };
    }
    return { color: TOKEN.danger, label: "Turn around ↩" };
  };

  const { color: arrowColor, label: statusLabel } = getDirectionState(alignmentAngle);

  // ── Distance trend display ──
  const distDisplay = (() => {
    if (dist === null) return null;
    const d = formatDistance(dist);
    const text = `${d.value} ${d.unit}`;
    if (distTrend === "closer")  return { text, icon: "trending-down", color: TOKEN.success  };
    if (distTrend === "farther") return { text, icon: "trending-up",   color: TOKEN.danger   };
    return                              { text, icon: "navigation",    color: TOKEN.infoLight };
  })();

  // Fade in on mount
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // Pulse loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Arrow rotation ──
  useEffect(() => {
    if (!nextTarget || !userLocation) return;

    const targetBearing = bearingDegrees(
      userLocation.latitude, userLocation.longitude,
      nextTarget.lat, nextTarget.lng,
    );

    // Screen angle = compass bearing to target, relative to device facing
    const rawAngle = (targetBearing - compassHeading + 360) % 360;

    // Always take the shortest angular path
    let delta = rawAngle - (currentDeg.current % 360);
    if (delta >  180) delta -= 360;
    if (delta < -180) delta += 360;

    const nextDeg = currentDeg.current + delta;
    currentDeg.current = nextDeg;

    Animated.spring(rotateAnim, {
      toValue:           nextDeg,
      useNativeDriver:   true,
      tension:           40,
      friction:          7,
      overshootClamping: false,
    }).start();
  }, [compassHeading, nextTarget?.originalIndex, userLocation?.latitude, userLocation?.longitude]);

  // Wide input range so interpolation never clamps regardless of full rotations
  const spin = rotateAnim.interpolate({
    inputRange:  [-7200, 7200],
    outputRange: ["-7200deg", "7200deg"],
    extrapolate: "extend",
  });

  // ── All done ──
  if (allDone) {
    return (
      <Animated.View style={[arrowSt.wrapper, { opacity: fadeAnim }]}>
        <View style={arrowSt.allDoneContainer}>
          <Feather name="check-circle" size={20} color={TOKEN.success} />
          <Text style={arrowSt.allDoneText}>All found!</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[arrowSt.wrapper, { opacity: fadeAnim }]}>

      {/* Ordinal label + model name */}
      <View style={arrowSt.sequenceRow}>
        <View style={arrowSt.sequenceBadge}>
          <Text style={arrowSt.sequenceNum}>{ordinal(targetNumber)}</Text>
        </View>
        <Text style={arrowSt.sequenceLabel} numberOfLines={1}>
          {nextTarget.label ?? `Model ${targetNumber}`}
        </Text>
      </View>

      {/* Rotating arrow — color and icon driven by alignment angle */}
      <View style={arrowSt.arrowRow}>
        <Animated.View
          style={[
            arrowSt.arrowCircle,
            {
              borderColor: arrowColor,
              shadowColor: arrowColor,
              transform:   [{ scale: pulseAnim }, { rotate: spin }],
            },
          ]}
        >
          {/*
            Feather arrow-right points right at 0°.
            A fixed -90° base rotation makes it point UP at rest so the
            parent's dynamic rotation maps correctly to compass directions.
          */}
          <View style={{ transform: [{ rotate: "-90deg" }] }}>
            <Feather name="arrow-right" size={24} color={arrowColor} />
          </View>
        </Animated.View>

        {/* Distance badge with trend icon */}
        {distDisplay && (
          <View style={[arrowSt.distBadge, { borderColor: `${arrowColor}55` }]}>
            <Feather
              name={distDisplay.icon}
              size={9}
              color={distDisplay.color}
              style={{ marginRight: 3 }}
            />
            <Text style={[arrowSt.distText, { color: distDisplay.color }]}>
              {distDisplay.text}
            </Text>
          </View>
        )}
      </View>

      {/* Alignment guidance label */}
      {statusLabel && (
        <View
          style={[
            arrowSt.statusBadge,
            { backgroundColor: `${arrowColor}22`, borderColor: `${arrowColor}55` },
          ]}
        >
          <Text style={[arrowSt.statusText, { color: arrowColor }]}>
            {statusLabel}
          </Text>
        </View>
      )}

      {/* Step dots — grey / active (matches arrow color) / done */}
      <View style={arrowSt.dotsRow}>
        {anchors.map((_, i) => (
          <View
            key={i}
            style={[
              arrowSt.dot,
              tappedIndices.has(i) && arrowSt.dotDone,
              !tappedIndices.has(i) &&
                i === nextTarget.originalIndex && {
                  ...arrowSt.dotActive,
                  backgroundColor: arrowColor,
                  shadowColor:     arrowColor,
                },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
};

const arrowSt = StyleSheet.create({
  wrapper: {
    position:   "absolute",
    right:      16,
    top:        Platform.OS === "ios" ? 110 : 96,
    alignItems: "center",
    gap:        6,
    zIndex:     200,
  },
  sequenceRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   TOKEN.surface,
    borderRadius:      TOKEN.radiusSm,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       TOKEN.borderAccent,
    maxWidth:          130,
  },
  sequenceBadge: {
    backgroundColor:   TOKEN.goldDim,
    borderRadius:      4,
    paddingHorizontal: 5,
    paddingVertical:   1,
    borderWidth:       1,
    borderColor:       TOKEN.borderAccent,
  },
  sequenceNum: {
    color:         TOKEN.goldLight,
    fontSize:      9,
    fontWeight:    "800",
    letterSpacing: 0.5,
  },
  sequenceLabel: {
    color:      TOKEN.textSecond,
    fontSize:   10,
    fontWeight: "600",
    flex:       1,
  },
  arrowRow:    { alignItems: "center", gap: 4 },
  arrowCircle: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: TOKEN.surface,
    borderWidth:     2,
    borderColor:     TOKEN.cta,       // overridden dynamically
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     TOKEN.cta,       // overridden dynamically
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.55,
    shadowRadius:    10,
    elevation:       10,
  },
  distBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.surface,
    borderRadius:      10,
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderWidth:       1,
    borderColor:       TOKEN.borderAccent,
  },
  distText:   { color: TOKEN.infoLight, fontSize: 10, fontWeight: "700" },
  statusBadge: {
    borderRadius:      TOKEN.radiusSm,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderWidth:       1,
    alignItems:        "center",
    minWidth:          80,
  },
  statusText: {
    fontSize:      9,
    fontWeight:    "700",
    letterSpacing: 0.4,
  },
  dotsRow: { flexDirection: "row", gap: 5, marginTop: 2 },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: TOKEN.border,
  },
  dotActive: {
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius:  4,
    elevation:     4,
  },
  dotDone: { backgroundColor: TOKEN.success },
  allDoneContainer: {
    alignItems:      "center",
    gap:             4,
    backgroundColor: TOKEN.surface,
    borderRadius:    TOKEN.radiusMd,
    padding:         10,
    borderWidth:     1,
    borderColor:     TOKEN.successDim,
  },
  allDoneText: { color: TOKEN.success, fontSize: 10, fontWeight: "700" },
});

// ─────────────────────────────────────────────
// AR SCENE
// ─────────────────────────────────────────────
const ModelOnPlane = ({ spot, anchorLabel, tapped, onModelClick }) => {
  const [placed, setPlaced]               = useState(false);
  const [animationName, setAnimationName] = useState("slowSpin");
  const [animationLoop, setAnimationLoop] = useState(true);
  const [animationRun, setAnimationRun]   = useState(true);

  useEffect(() => {
    if (tapped) {
      setAnimationName("slowSpin");
      setAnimationLoop(true);
      setAnimationRun(true);
    }
  }, [tapped]);

  const handleClick = () => {
    setAnimationName("wiggle");
    setAnimationLoop(false);
    setAnimationRun(true);
    onModelClick();
  };

  const handleAnimationFinish = () => {
    if (animationName === "wiggle") {
      setAnimationName("slowSpin");
      setAnimationLoop(true);
      setAnimationRun(true);
    }
  };

  return (
    <ViroARPlane minHeight={0.1} minWidth={0.1} alignment="Horizontal" onAnchorFound={() => setPlaced(true)}>
      {placed ? (
        <ViroNode position={[0, 0, 0]}>
          <ViroAmbientLight color="#fff8f5" intensity={300} />
          <ViroSpotLight
            innerAngle={5}
            outerAngle={90}
            direction={[0, -1, -0.2]}
            position={[0, 3, 1]}
            color="#fff8f5"
            castsShadow
          />
          <Viro3DObject
            source={{ uri: spot.AR3DModelURL }}
            type="GLB"
            scale={[0.1, 0.1, 0.1]}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            animation={{
              name:     animationName,
              run:      animationRun,
              loop:     animationLoop,
              onFinish: handleAnimationFinish,
            }}
            onClickState={(state) => { if (state === 1) handleClick(); }}
            onError={(e) =>
              console.warn(`[AR] Model load error "${spot.name}" (${anchorLabel}):`, e)
            }
          />
          <ViroText
            text={tapped ? `✓ Explored\n${anchorLabel}` : `Tap to explore\n${anchorLabel}`}
            position={[1, 1, 1]}
            scale={[0.32, 0.32, 0.32]}
            style={tapped ? arStyles.tapHintDone : arStyles.tapHint}
          />
        </ViroNode>
      ) : (
        <ViroText
          text={`Scanning surface…\n${anchorLabel}`}
          position={[0, 0, -1.5]}
          scale={[0.38, 0.38, 0.38]}
          style={arStyles.scanning}
        />
      )}
    </ViroARPlane>
  );
};

const ARScene = ({ sceneNavigator }) => {
  const { spot, activeAnchors, tappedIndices, onModelClick, onTrackingChange } =
    sceneNavigator.viroAppProps;

  // Nothing may be added to the scene until ARCore reports real tracking.
  // Mounting children earlier makes Viro call nativeCreateAnchoredNode against
  // a session that has no anchor yet — which logged "Failed to acquire anchor
  // from world position" and, on this device, escalated to a hard native
  // SIGSEGV (fault addr 0x0) that killed the app. The RN HUD already explains
  // what to do while we wait, so an empty scene here costs the user nothing.
  const [tracking, setTracking] = useState(false);

  const handleTracking = (state) => {
    const ok = state === ViroTrackingStateConstants.TRACKING_NORMAL;
    setTracking(ok);
    // Report upward so the HUD can tell the user *why* nothing is appearing
    // (too dark, phone held still, camera pointed at a blank wall).
    onTrackingChange?.(ok);
  };

  if (!tracking) {
    return <ViroARScene onTrackingUpdated={handleTracking} />;
  }

  // Out of range: render an empty scene. There used to be a floating ViroText
  // here ("Walk closer to …") anchored at [0,0,-2] — that is precisely the
  // node whose nativeCreateAnchoredNode call segfaulted the app, because a
  // bare world-positioned node needs an ARCore anchor that may never arrive
  // (poor light, blank wall, session still starting). The HUD's radar,
  // distance and directional arrow already say the same thing far more
  // clearly, and they're plain React Native views that cannot crash.
  if (!activeAnchors || activeAnchors.length === 0) {
    return <ViroARScene onTrackingUpdated={handleTracking} />;
  }

  return (
    <ViroARScene onTrackingUpdated={handleTracking}>
      {activeAnchors.map((anchor) => (
        <ModelOnPlane
          key={anchor.index}
          spot={spot}
          anchorLabel={anchor.label}
          tapped={tappedIndices.has(anchor.index)}
          onModelClick={() => onModelClick(anchor)}
        />
      ))}
    </ViroARScene>
  );
};

const arStyles = {
  tapHint:     { fontFamily: "Arial", fontSize: 10, color: TOKEN.goldLight,   textAlign: "center", textAlignVertical: "center" },
  tapHintDone: { fontFamily: "Arial", fontSize: 10, color: TOKEN.success,     textAlign: "center", textAlignVertical: "center" },
  scanning:    { fontFamily: "Arial", fontSize: 11, color: TOKEN.warn,        textAlign: "center", textAlignVertical: "center" },
  // (outOfRange removed with the floating "walk closer" ViroText — the HUD
  //  handles that state now.)
};

// ─────────────────────────────────────────────
// TRIVIA POPUP
// ─────────────────────────────────────────────
const TriviaPopup = ({
  spot,
  activeAnchor,
  visible,
  onClose,
  tappedCount,
  totalCount,
  missionJustCompleted,
}) => {
  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const [currentIdx, setCurrentIdx]     = useState(0);
  const [modalMounted, setModalMounted] = useState(false);

  const trivia = spot?.trivia?.length
    ? spot.trivia
    : [`${spot?.name ?? "This spot"} is a remarkable place worth exploring!`];

  useEffect(() => {
    if (visible) {
      setModalMounted(true);
      setCurrentIdx(0);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 11 }),
          Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 100, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setModalMounted(false); });
    }
  }, [visible]);

  if (!modalMounted) return null;

  const goNext    = () => setCurrentIdx((i) => Math.min(i + 1, trivia.length - 1));
  const goPrev    = () => setCurrentIdx((i) => Math.max(i - 1, 0));
  const isFirst   = currentIdx === 0;
  const isLast    = currentIdx === trivia.length - 1;
  const remaining = totalCount - tappedCount;

  return (
    <Modal transparent visible={modalMounted} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[popup.scrim, { opacity: fadeAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[popup.card, { transform: [{ translateY: slideAnim }], opacity: fadeAnim }]}
      >
        <View style={popup.dragHandle} />

        <View style={popup.header}>
          <View style={popup.categoryBadge}>
            <Feather name="book-open" size={10} color={TOKEN.goldLight} style={{ marginRight: 5 }} />
            <Text style={popup.categoryText}>HERITAGE INFO</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={popup.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={16} color={TOKEN.textSecond} />
          </TouchableOpacity>
        </View>

        <Text style={popup.spotTitle} numberOfLines={2}>{spot?.name}</Text>

        {activeAnchor?.label ? (
          <View style={popup.anchorBadge}>
            <Feather name="map-pin" size={10} color={TOKEN.cta} style={{ marginRight: 5 }} />
            <Text style={popup.anchorBadgeText}>{activeAnchor.label}</Text>
          </View>
        ) : null}

        {missionJustCompleted ? (
          <View style={popup.missionCompleteBanner}>
            <Feather name="check-circle" size={13} color={TOKEN.success} style={{ marginRight: 7 }} />
            <Text style={popup.missionCompleteText}>AR mission completed! All models explored.</Text>
          </View>
        ) : (
          <View style={popup.missionProgressBanner}>
            <Feather name="aperture" size={13} color={TOKEN.goldLight} style={{ marginRight: 7 }} />
            <Text style={popup.missionProgressText}>
              {tappedCount} / {totalCount} models explored
              {remaining > 0 ? ` — ${remaining} more to complete mission` : ""}
            </Text>
          </View>
        )}

        <View style={popup.divider} />

        <View style={popup.triviaBox}>
          <View style={popup.triviaIndexBadge}>
            <Text style={popup.triviaIndexText}>{currentIdx + 1}</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <Text style={popup.triviaText}>{trivia[currentIdx]}</Text>
          </ScrollView>
        </View>

        {trivia.length > 1 && (
          <>
            <View style={popup.dotsRow}>
              {trivia.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setCurrentIdx(i)}
                  style={[popup.dot, i === currentIdx && popup.dotActive]}
                />
              ))}
            </View>
            <View style={popup.navRow}>
              <TouchableOpacity
                style={[popup.navBtn, isFirst && popup.navBtnDisabled]}
                onPress={goPrev}
                disabled={isFirst}
                activeOpacity={0.7}
              >
                <Feather name="chevron-left" size={16} color={isFirst ? TOKEN.textMuted : TOKEN.goldLight} />
                <Text style={[popup.navText, isFirst && popup.navTextDisabled]}>Previous</Text>
              </TouchableOpacity>
              <Text style={popup.counter}>{currentIdx + 1} of {trivia.length}</Text>
              <TouchableOpacity
                style={[popup.navBtn, isLast && popup.navBtnDisabled]}
                onPress={goNext}
                disabled={isLast}
                activeOpacity={0.7}
              >
                <Text style={[popup.navText, isLast && popup.navTextDisabled]}>Next</Text>
                <Feather name="chevron-right" size={16} color={isLast ? TOKEN.textMuted : TOKEN.goldLight} />
              </TouchableOpacity>
            </View>
          </>
        )}

        <TouchableOpacity style={popup.doneBtn} onPress={onClose} activeOpacity={0.85}>
          <Feather name="arrow-left" size={15} color={TOKEN.ctaText} style={{ marginRight: 8 }} />
          <Text style={popup.doneBtnText}>Return to AR View</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const popup = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.60)" },
  card: {
    position:             "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor:      "#12262A",
    borderTopLeftRadius:  TOKEN.radiusXl,
    borderTopRightRadius: TOKEN.radiusXl,
    paddingHorizontal:    TOKEN.spaceLg,
    paddingTop:           12,
    paddingBottom:        Platform.OS === "ios" ? 42 : 32,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor:          TOKEN.borderAccent,
    shadowColor:          "#000",
    shadowOffset:         { width: 0, height: -8 },
    shadowOpacity:        0.55,
    shadowRadius:         20,
    elevation:            24,
  },
  dragHandle: {
    alignSelf:       "center",
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: TOKEN.border,
    marginBottom:    18,
  },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  categoryBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.goldDim,
    borderRadius:      TOKEN.radiusSm,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       TOKEN.border,
  },
  categoryText:    { color: TOKEN.goldLight, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  closeBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: TOKEN.surfaceHigh,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     TOKEN.border,
  },
  spotTitle:   { color: TOKEN.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: 0.2, lineHeight: 30, marginBottom: 8 },
  anchorBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.surfaceHigh,
    borderRadius:      TOKEN.radiusSm,
    paddingHorizontal: 10,
    paddingVertical:   5,
    alignSelf:         "flex-start",
    marginBottom:      10,
    borderWidth:       1,
    borderColor:       TOKEN.border,
  },
  anchorBadgeText: { color: TOKEN.infoLight, fontSize: 11, fontWeight: "600" },
  missionCompleteBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.successDim,
    borderRadius:      TOKEN.radiusSm,
    paddingHorizontal: 12,
    paddingVertical:   8,
    alignSelf:         "stretch",
    marginBottom:      12,
    borderWidth:       1,
    borderColor:       TOKEN.successDim,
  },
  missionCompleteText: { color: TOKEN.success, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  missionProgressBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.goldDim,
    borderRadius:      TOKEN.radiusSm,
    paddingHorizontal: 12,
    paddingVertical:   8,
    alignSelf:         "stretch",
    marginBottom:      12,
    borderWidth:       1,
    borderColor:       TOKEN.border,
  },
  missionProgressText: { color: TOKEN.goldLight, fontSize: 12, fontWeight: "600", letterSpacing: 0.2, flex: 1 },
  divider:    { height: 1, backgroundColor: TOKEN.border, marginBottom: 16 },
  triviaBox: {
    flexDirection:   "row",
    backgroundColor: TOKEN.surfaceHigh,
    borderRadius:    TOKEN.radiusMd,
    padding:         TOKEN.spaceMd,
    marginBottom:    16,
    minHeight:       88,
    maxHeight:       160,
    gap:             12,
    borderWidth:     1,
    borderColor:     TOKEN.border,
  },
  triviaIndexBadge: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: TOKEN.goldDim,
    borderWidth:     1,
    borderColor:     TOKEN.border,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
    marginTop:       1,
  },
  triviaIndexText: { color: TOKEN.goldLight, fontSize: 12, fontWeight: "700" },
  triviaText:      { color: TOKEN.textPrimary, fontSize: 14, lineHeight: 22, flex: 1, flexShrink: 1, opacity: 0.92 },
  dotsRow:         { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 14 },
  dot:             { width: 6, height: 6, borderRadius: 3, backgroundColor: TOKEN.border },
  dotActive:       { backgroundColor: TOKEN.goldLight, width: 20, borderRadius: 3 },
  navRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  navBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    paddingVertical:   9,
    paddingHorizontal: 14,
    backgroundColor:   TOKEN.surfaceHigh,
    borderRadius:      TOKEN.radiusSm,
    borderWidth:       1,
    borderColor:       TOKEN.border,
    minWidth:          100,
    justifyContent:    "center",
  },
  navBtnDisabled:  { opacity: 0.3 },
  navText:         { color: TOKEN.textPrimary, fontSize: 13, fontWeight: "600" },
  navTextDisabled: { color: TOKEN.textMuted },
  counter:         { color: TOKEN.textSecond, fontSize: 12, fontWeight: "500" },
  doneBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: TOKEN.cta,
    borderRadius:    24,
    paddingVertical: 14,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.25,
    shadowRadius:    6,
    elevation:       6,
  },
  doneBtnText: { color: TOKEN.ctaText, fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function ARScreen({ route, navigation }) {
  const { spot, arMissionId } = route.params;
  const { completeMission, completedMissions } = useMissions();

  // Tilt-aware, real-time compass heading
  const compassHeading = useCompassHeading();

  const [userLocation, setUserLocation] = useState(null);

  // Derived rather than stored: proximities are a pure function of where you
  // are, so keeping them in their own state just risked them drifting out of
  // sync with the location that produced them.
  const anchorProximities = useMemo(
    () =>
      userLocation
        ? computeAnchorProximities(spot, userLocation.latitude, userLocation.longitude)
        : [],
    [spot, userLocation?.latitude, userLocation?.longitude]
  );
  const [locationError, setLocationError]         = useState(null);

  const [triviaVisible, setTriviaVisible] = useState(false);
  const [tappedAnchor, setTappedAnchor]   = useState(null);

  // ── Device AR capability ──────────────────────────────────────────────
  // Not every Android phone ships ARCore. Without this check the screen just
  // mounted the AR navigator anyway and the user got a black camera view with
  // no explanation. Viro rejects with the reason string on Android;
  // "TRANSIENT" means ARCore is still deciding, so retry rather than
  // condemning the device.
  const [arSupport, setArSupport] = useState("checking"); // checking | ok | unsupported

  // Whether ARCore currently has a solid fix on the room. Reported up from
  // ARScene; drives the "camera can't see enough yet" hint below.
  const [arTracking, setArTracking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const check = () => {
      attempts += 1;
      isARSupportedOnDevice()
        .then((res) => {
          if (cancelled) return;
          setArSupport(res?.isARSupported ? "ok" : "unsupported");
        })
        .catch((err) => {
          if (cancelled) return;
          const reason = String(err?.message ?? err ?? "");
          if (reason.includes("TRANSIENT") && attempts < 4) {
            setTimeout(check, 1200); // ARCore hasn't made up its mind yet
            return;
          }
          setArSupport("unsupported");
        });
    };

    check();
    return () => { cancelled = true; };
  }, []);

  // First-run guide. Opens automatically the first time (per install), and is
  // re-openable from the "?" button afterwards.
  const [guideVisible, setGuideVisible] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(AR_GUIDE_SEEN_KEY)
      .then((seen) => { if (!cancelled && !seen) setGuideVisible(true); })
      .catch(() => {}); // storage unavailable — just skip the guide
    return () => { cancelled = true; };
  }, []);

  const dismissGuide = () => {
    setGuideVisible(false);
    AsyncStorage.setItem(AR_GUIDE_SEEN_KEY, "1").catch(() => {});
  };

  const tappedIndicesRef = useRef(new Set());
  const [tappedIndices, setTappedIndices] = useState(new Set());

  const missionJustCompletedRef = useRef(false);
  const [missionJustCompleted, setMissionJustCompleted] = useState(false);

  const watchId    = useRef(null);
  const hudOpacity = useRef(new Animated.Value(0)).current;

  const totalAnchors    = spot.modelsCoordinates?.length ?? 0;
  const originalAnchors = spot.modelsCoordinates ?? [];

  useEffect(() => {
    Animated.timing(hudOpacity, {
      toValue:         1,
      duration:        500,
      delay:           300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyFix = (pos) => {
      if (cancelled) return;
      const { latitude, longitude, accuracy } = pos.coords;
      setUserLocation({ latitude, longitude, accuracy });
      setLocationError(null);
    };

    // Step 1 — seed the screen with whatever fix the device can give us
    // *immediately*, including a cached one. Without this the HUD sat on
    // "Acquiring GPS signal…" indefinitely: the watch below asks for a
    // satellite-grade fix, which can take a minute outdoors and may never
    // arrive indoors, and with no timeout it never reported an error either.
    const seed = () => {
      Geolocation.getCurrentPosition(
        applyFix,
        () => {}, // non-fatal: the watch is still coming
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    };

    // Step 2 — the live high-accuracy watch. If it errors (commonly a
    // timeout indoors), fall back to a coarser watch rather than leaving the
    // user staring at a spinner: a network/wifi fix is still good enough to
    // show distance and guide someone toward the spot.
    const startWatch = () => {
      watchId.current = Geolocation.watchPosition(
        applyFix,
        () => {
          if (cancelled) return;
          if (watchId.current != null) {
            Geolocation.clearWatch(watchId.current);
            watchId.current = null;
          }
          watchId.current = Geolocation.watchPosition(
            applyFix,
            (err2) => { if (!cancelled) setLocationError(err2.message); },
            { enableHighAccuracy: false, distanceFilter: 0, interval: 3000, timeout: 30000, maximumAge: 30000 }
          );
        },
        {
          enableHighAccuracy: true,
          distanceFilter:     0,
          interval:           1000,
          fastestInterval:    500,
          timeout:            20000,
          maximumAge:         15000,
        }
      );
    };

    const init = async () => {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setLocationError("Location permission denied");
          return;
        }
      }
      if (cancelled) return;
      seed();
      startWatch();
    };

    init();
    return () => {
      cancelled = true;
      if (watchId.current != null) Geolocation.clearWatch(watchId.current);
    };
  }, []);

  const handleModelClick = (anchor) => {
    const alreadyTapped = tappedIndicesRef.current.has(anchor.index);
    if (!alreadyTapped) {
      const next = new Set(tappedIndicesRef.current);
      next.add(anchor.index);
      tappedIndicesRef.current = next;
      setTappedIndices(next);

      const alreadyCompleted = completedMissions?.includes(arMissionId);
      if (
        !missionJustCompletedRef.current &&
        !alreadyCompleted &&
        arMissionId &&
        next.size >= totalAnchors
      ) {
        missionJustCompletedRef.current = true;
        setMissionJustCompleted(true);
        completeMission(arMissionId);
        buzz.complete();
      } else {
        buzz.tap();
      }
    } else {
      buzz.tick();
    }
    setTappedAnchor(anchor);
    setTriviaVisible(true);
  };

  const activeAnchors  = anchorProximities.filter((a) => a.isInRange);
  const anyActive      = activeAnchors.length > 0;
  const nearestPending = anchorProximities.find((a) => !a.isInRange);

  // ── Encounter moment ──────────────────────────────────────────────────
  // Fires the flash + haptic exactly once per crossing into an AR zone
  // (not on every GPS tick while standing inside one).
  const wasActiveRef = useRef(false);
  const [encounterTrigger, setEncounterTrigger] = useState(0);
  const [encounterLabel, setEncounterLabel]     = useState(null);

  useEffect(() => {
    if (anyActive && !wasActiveRef.current) {
      setEncounterLabel(activeAnchors[0]?.label ?? null);
      setEncounterTrigger((n) => n + 1);
      buzz.encounter();
    }
    wasActiveRef.current = anyActive;
  }, [anyActive]);

  // ── HUD ──────────────────────────────────────────────────────────────
  const renderHUD = () => {
    if (locationError) {
      // A raw error string ("Location permission denied") left the user at a
      // dead end — nothing to tap, and no hint that the fix lives in system
      // settings. Explain it in plain words and give them the way out.
      const isPermission = /permission|denied/i.test(locationError);
      return (
        <Animated.View style={[hud.container, hud.errorContainer, { opacity: hudOpacity }]}>
          <View style={hud.errorRow}>
            <View style={hud.errorIconWrap}>
              <Feather name="map-pin" size={14} color={TOKEN.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={hud.errorTitle}>
                {isPermission ? "Location access is off" : "Can't find your location"}
              </Text>
              <Text style={hud.errorMsg}>
                {isPermission
                  ? "AR missions need your location to know when you've reached the landmark."
                  : "We couldn't get a location fix. Check that location is turned on, then try again."}
              </Text>
            </View>
          </View>

          <View style={hud.errorActions}>
            {isPermission && (
              <TouchableOpacity
                style={hud.errorBtn}
                onPress={() => Linking.openSettings().catch(() => {})}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Open app settings to allow location access"
              >
                <Feather name="settings" size={12} color={TOKEN.ctaText} style={{ marginRight: 6 }} />
                <Text style={hud.errorBtnText}>Open Settings</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={hud.errorBtnGhost}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={hud.errorBtnGhostText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    }

    if (!userLocation) {
      return (
        <Animated.View style={[hud.container, { opacity: hudOpacity }]}>
          <View style={hud.loadingRow}>
            <ActivityIndicator size="small" color={TOKEN.goldLight} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={hud.loadingText}>Acquiring GPS signal…</Text>
              <Text style={hud.loadingHint}>
                This can take a while indoors — step outside for a faster fix.
              </Text>
            </View>
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={[hud.container, { opacity: hudOpacity }]}>
        <View style={hud.spotRow}>
          <View style={[hud.spotDot, anyActive && hud.spotDotActive]} />
          <Text style={hud.spotName} numberOfLines={1}>{spot.name}</Text>
          {/* GPS quality as a plain "Weak signal" warning instead of a "±37 m"
              readout. A good fix needs no comment at all; only a poor one is
              worth telling the user about, because it explains why the object
              might not appear exactly where they expect. */}
          {userLocation.accuracy != null && userLocation.accuracy >= 20 && (
            <View style={hud.gpsChip} accessibilityLabel="Weak GPS signal">
              <Feather name="wifi-off" size={9} color={TOKEN.warn} style={{ marginRight: 4 }} />
              <Text style={[hud.gpsChipText, { color: TOKEN.warn }]}>Weak signal</Text>
            </View>
          )}
        </View>

        {/* Collected-so-far, as pips rather than a "2 / 5 tapped" readout —
            glanceable while walking, and it keeps the panel short. */}
        {totalAnchors > 1 && (
          <View style={hud.pipRow}>
            <ProgressPips total={totalAnchors} done={tappedIndices.size} />
            <Text style={hud.pipCount}>
              {tappedIndices.size}/{totalAnchors}
            </Text>
          </View>
        )}

        <View style={hud.divider} />

        {anyActive ? (
          <View style={hud.insideRow}>
            <View style={hud.insideBadge}>
              <Feather name="check-circle" size={13} color={TOKEN.success} style={{ marginRight: 6 }} />
              <Text style={hud.insideBadgeText}>YOU'RE HERE</Text>
            </View>

            {totalAnchors > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 6 }}
                contentContainerStyle={{ gap: 6 }}
              >
                {activeAnchors.map((a) => (
                  <View
                    key={a.index}
                    style={[hud.activeLabelPill, tappedIndices.has(a.index) && hud.activeLabelPillDone]}
                  >
                    <Feather
                      name={tappedIndices.has(a.index) ? "check" : "circle"}
                      size={9}
                      color={tappedIndices.has(a.index) ? TOKEN.goldLight : TOKEN.success}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[hud.activeLabelText, tappedIndices.has(a.index) && { color: TOKEN.goldLight }]}>
                      {a.label}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* In range, but ARCore hasn't locked onto the surroundings yet —
                without this the user just stares at an empty camera view with
                no idea the app is waiting on them to move/light the scene. */}
            {arTracking ? (
              <View style={hud.tapCue}>
                <Feather name="aperture" size={12} color={TOKEN.ctaText} style={{ marginRight: 6 }} />
                <Text style={hud.tapCueText}>TAP THE OBJECT</Text>
              </View>
            ) : (
              <View style={hud.scanCue}>
                <ActivityIndicator size="small" color={TOKEN.infoLight} style={{ marginRight: 8 }} />
                <Text style={hud.scanCueText}>
                  Move your phone slowly to look around — needs a bit of light
                </Text>
              </View>
            )}
          </View>
        ) : (
          (() => {
            if (!nearestPending) return null;
            const metersToEdge = Math.max(0, Math.round(nearestPending.distance - nearestPending.radius));
            return (
              <View style={hud.outsideWrap}>
                {totalAnchors > 1 && (
                  <Text style={hud.nearestLabel}>
                    Nearest:{" "}
                    <Text style={{ color: TOKEN.goldLight }}>{nearestPending.label}</Text>
                  </Text>
                )}

                {/* Radar replaces the old number + linear progress bar: the
                    pulse rate itself encodes "how close am I". */}
                <ProximityRadar metersToEdge={metersToEdge} radius={nearestPending.radius} />

                <Text style={hud.distanceHint}>
                  {metersToEdge > nearestPending.radius * 3
                    ? "Head toward the landmark — the object appears when you're close"
                    : metersToEdge > nearestPending.radius
                    ? "Getting closer — keep walking"
                    : "Almost there — look around for the object"}
                </Text>
              </View>
            );
          })()
        )}
      </Animated.View>
    );
  };

  // Device can't do AR — say so plainly instead of mounting the navigator and
  // leaving the user on a black screen wondering what broke.
  if (arSupport === "unsupported") {
    return (
      <View style={[main.root, main.unsupportedRoot]}>
        <StatusBar barStyle="light-content" backgroundColor={TOKEN.bg} />
        <View style={main.unsupportedCard}>
          <View style={main.unsupportedIcon}>
            <Feather name="camera-off" size={26} color={TOKEN.warn} />
          </View>
          <Text style={main.unsupportedTitle}>AR isn't available on this phone</Text>
          <Text style={main.unsupportedBody}>
            This mission needs ARCore, which this device doesn't support. You can still
            visit {spot.name} and complete the other missions there.
          </Text>
          <TouchableOpacity
            style={main.unsupportedBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go back to the spot"
          >
            <Text style={main.unsupportedBtnText}>Back to {spot.name}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={main.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ViroARSceneNavigator
        initialScene={{ scene: ARScene }}
        viroAppProps={{
          spot,
          activeAnchors,
          tappedIndices,
          onModelClick:     handleModelClick,
          onTrackingChange: setArTracking,
        }}
        style={{ flex: 1 }}
      />

      {/* ── Top bar ── */}
      <View style={main.topBar}>
        <TouchableOpacity
          style={main.iconBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Leave AR mission"
        >
          <Feather name="arrow-left" size={18} color={TOKEN.textPrimary} />
        </TouchableOpacity>
        <View style={main.topLabel}>
          <Feather name="layers" size={12} color={TOKEN.goldLight} style={{ marginRight: 5 }} />
          <Text style={main.topLabelText}>AR MISSION</Text>
        </View>

        <View style={main.topRight}>
          <TouchableOpacity
            style={main.iconBtn}
            onPress={() => setGuideVisible(true)}
            activeOpacity={0.8}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="How AR missions work"
          >
            <Feather name="help-circle" size={17} color={TOKEN.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Directional Arrow (only for multi-anchor spots) ── */}
      {userLocation && originalAnchors.length > 1 && (
        <DirectionalArrow
          anchors={originalAnchors}
          tappedIndices={tappedIndices}
          userLocation={userLocation}
          compassHeading={compassHeading}
        />
      )}

      {/* ── HUD ── */}
      {renderHUD()}

      {/* ── "Object found!" encounter beat — sits above the HUD but is
             pointerEvents:none so it never blocks a tap on the model. ── */}
      <EncounterFlash trigger={encounterTrigger} label={encounterLabel} />

      {/* First-run (and on-demand) explainer */}
      <HowItWorks visible={guideVisible} onClose={dismissGuide} />

      {/* ── Trivia popup ── */}
      <TriviaPopup
        spot={spot}
        activeAnchor={tappedAnchor}
        visible={triviaVisible}
        onClose={() => setTriviaVisible(false)}
        tappedCount={tappedIndices.size}
        totalCount={totalAnchors}
        missionJustCompleted={missionJustCompleted}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// HUD STYLES
// ─────────────────────────────────────────────
const hud = StyleSheet.create({
  container: {
    position:        "absolute",
    bottom:          Platform.OS === "ios" ? 52 : 40,
    left: 16, right: 16,
    backgroundColor: TOKEN.surface,
    borderRadius:    TOKEN.radiusMd,
    padding:         14,
    borderWidth:     1,
    borderColor:     TOKEN.borderAccent,
    gap:             8,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.45,
    shadowRadius:    12,
    elevation:       12,
  },
  errorContainer:  { borderColor: TOKEN.danger, backgroundColor: TOKEN.dangerDim },
  errorRow:        { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  errorIconWrap:   {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: TOKEN.dangerDim,
    alignItems:      "center",
    justifyContent:  "center",
  },
  errorTitle:   { color: TOKEN.textPrimary, fontSize: 13, fontWeight: "800", marginBottom: 3 },
  errorMsg:     { color: TOKEN.textSecond,  fontSize: 12, lineHeight: 17 },
  errorActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  errorBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: TOKEN.cta,
    borderRadius: TOKEN.radiusXl,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  errorBtnText: { color: TOKEN.ctaText, fontSize: 12, fontWeight: "800" },
  errorBtnGhost: {
    borderRadius: TOKEN.radiusXl,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: TOKEN.border,
  },
  errorBtnGhostText: { color: TOKEN.textSecond, fontSize: 12, fontWeight: "700" },
  loadingRow:   { flexDirection: "row", alignItems: "center" },
  loadingText:  { color: TOKEN.textSecond, fontSize: 13 },
  loadingHint:  { color: TOKEN.textMuted, fontSize: 11, marginTop: 2, lineHeight: 15 },
  spotRow:      { flexDirection: "row", alignItems: "center", gap: 7 },
  spotDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: TOKEN.goldLight,
    shadowColor:     TOKEN.goldLight,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.9,
    shadowRadius:    4,
    elevation:       3,
  },
  spotDotActive:  { backgroundColor: TOKEN.success, shadowColor: TOKEN.success },
  spotName:       { color: TOKEN.textPrimary, fontSize: 14, fontWeight: "700", letterSpacing: 0.2, flex: 1 },
  gpsChip: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.surfaceHigh,
    borderRadius:      20,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       TOKEN.border,
  },
  gpsChipText:            { fontSize: 10, fontWeight: "700" },
  // Collected-progress pips (replaced the two "x / y" stat badges)
  pipRow:                 { flexDirection: "row", alignItems: "center", gap: 8 },
  pipCount:               { color: TOKEN.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  divider:                { height: 1, backgroundColor: TOKEN.border },
  insideRow:              { gap: 8 },
  insideBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.successDim,
    borderRadius:      TOKEN.radiusSm,
    paddingHorizontal: 10,
    paddingVertical:   6,
    alignSelf:         "flex-start",
    borderWidth:       1,
    borderColor:       TOKEN.successDim,
  },
  insideBadgeText:     { color: TOKEN.success, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  activeLabelPill: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.successDim,
    borderRadius:      20,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       TOKEN.successDim,
  },
  activeLabelPillDone: { backgroundColor: TOKEN.goldDim, borderColor: TOKEN.border },
  activeLabelText:     { color: TOKEN.success, fontSize: 10, fontWeight: "600" },
  // In-zone call to action — replaces the small grey "point camera…" line
  // with the one instruction that matters, styled as the primary action.
  tapCue: {
    flexDirection:     "row",
    alignItems:        "center",
    alignSelf:         "flex-start",
    backgroundColor:   TOKEN.cta,
    borderRadius:      TOKEN.radiusXl,
    paddingHorizontal: 14,
    paddingVertical:   8,
    shadowColor:   TOKEN.gold,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius:  12,
    elevation:     8,
  },
  tapCueText:          { color: TOKEN.ctaText, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  scanCue: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: TOKEN.surfaceHigh,
    borderRadius: TOKEN.radiusXl,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: TOKEN.border,
  },
  scanCueText:         { color: TOKEN.textSecond, fontSize: 11.5, fontWeight: "600", flex: 1 },
  outsideWrap:         { gap: 7, alignItems: "center" },
  nearestLabel:        { color: TOKEN.textSecond, fontSize: 11, fontWeight: "500", alignSelf: "flex-start" },
  distanceHint:        { color: TOKEN.textMuted, fontSize: 11, fontWeight: "500", letterSpacing: 0.2, textAlign: "center" },
});

// ─────────────────────────────────────────────
// MAIN STYLES
// ─────────────────────────────────────────────
const main = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKEN.bg },
  topBar: {
    position:       "absolute",
    top:            Platform.OS === "ios" ? 54 : 36,
    left: 16, right: 16,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    zIndex:         100,
  },
  iconBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: TOKEN.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     TOKEN.borderAccent,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.35,
    shadowRadius:    6,
    elevation:       8,
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  // ── "This device can't do AR" fallback ──
  unsupportedRoot: { backgroundColor: TOKEN.bg, alignItems: "center", justifyContent: "center", padding: 26 },
  unsupportedCard: {
    width: "100%", maxWidth: 360, alignItems: "center", gap: 14,
    backgroundColor: TOKEN.surfaceHigh,
    borderRadius: TOKEN.radiusLg,
    borderWidth: 1, borderColor: TOKEN.border,
    padding: 26,
  },
  unsupportedIcon: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: TOKEN.goldDim,
    alignItems: "center", justifyContent: "center",
  },
  unsupportedTitle: { color: TOKEN.textPrimary, fontSize: 17, fontWeight: "800", textAlign: "center" },
  unsupportedBody:  { color: TOKEN.textSecond, fontSize: 13, lineHeight: 19, textAlign: "center" },
  unsupportedBtn: {
    backgroundColor: TOKEN.cta, borderRadius: TOKEN.radiusXl,
    paddingVertical: 12, paddingHorizontal: 22, marginTop: 4,
  },
  unsupportedBtnText: { color: TOKEN.ctaText, fontSize: 13.5, fontWeight: "900" },
  topLabel: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.surface,
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderWidth:       1,
    borderColor:       TOKEN.borderAccent,
  },
  topLabelText: { color: TOKEN.textSecond, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
});