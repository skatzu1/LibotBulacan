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
import * as Haptics from "expo-haptics";
import { useMissions } from "../context/MissionContext";
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroARPlane,
  Viro3DObject,
  ViroBox,
  ViroNode,
  ViroText,
  ViroAmbientLight,
  ViroSpotLight,
  ViroAnimations,
  ViroMaterials,
  isARSupportedOnDevice,
  ViroTrackingStateConstants,
} from "@reactvision/react-viro";
import { GpsSmoother, isBetterFix, MAX_USABLE_ACCURACY_M } from "../utils/gpsFilter";
// `explainReason` is exported by the module but deliberately not used here:
// the absence of precise placement needs no explanation to the user, since
// plane placement is the normal experience. It's there for debugging and for
// any future screen that wants to surface the reason.
import { evaluateGeospatial, anchorAtLocation, releaseAnchor } from "../utils/geospatial";
import { resolveTrail } from "../utils/arTrail";
import { fonts } from "../context/ThemeContext";
import Icon from "../components/Icon";

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
// How close you have to be for an AR model to appear.
//
// Room level: 6 m is about the width of a chapel side-aisle or a gallery room,
// so an anchor now means "this corner of the building" rather than "somewhere
// on these grounds". Each model at a spot gets its own findable place instead
// of all of them firing the moment you reach the site.
//
// ── The catch, stated plainly ────────────────────────────────────────────
// 6 m is BELOW what a phone's GPS can resolve. Standing exactly on the pinned
// coordinate, an Android device typically reports you 5–20 m away, and 20–40 m
// away beside a large building — which is precisely where these spots are.
// Taken alone, a 6 m gate would therefore fail for a user standing on the
// exact spot, with nothing they could do about it. That was the original bug
// on this screen and it is why this number used to be 30.
//
// What makes the smaller number safe is the slack below: the radius is widened
// by however wrong the device itself says the fix might be. In good conditions
// (±4 m) the gate is ~10 m and genuinely room-scale; in poor conditions it
// opens up rather than becoming unreachable. The experience is as tight as the
// hardware allows at that moment, which is the most this can honestly promise
// while the position comes from GPS.
const BASE_MODEL_RADIUS_METERS = 6;

// Floor for the shrink applied when two anchors sit close together. At 3 m two
// models in the same room stay separately findable; below that they would be
// inside each other's error bars and the gate would be meaningless.
const MIN_MODEL_RADIUS_METERS = 3;

// Ceiling on how far a poor fix may widen the radius, lowered with the base
// (was 35, for a 30 m base). Two jobs: a junk indoor fix (±150 m) must not
// report every anchor as in range at once, and a room-level gate that has
// stretched to three rooms has stopped being room-level — past ±12 m the
// device simply cannot support this experience, so there is nothing to gain by
// widening further.
const MAX_ACCURACY_SLACK_METERS = 12;

// ── AR model geometry ────────────────────────────────────────────────────
// Derived from the asset by applying its full node transform hierarchy:
//   world bounds  X -3.992..3.997   Y -4.525..8.593   Z -0.987..0.987
// At MODEL_SCALE that is 0.64 m wide, 1.05 m tall, 0.16 m deep.
const MODEL_SCALE = 0.08;
// The asset's origin is 4.525 units above its own base, so without this lift
// the bottom third of the model is buried under the plane it stands on.
const MODEL_BASE_OFFSET_Y = 4.525 * MODEL_SCALE;   // 0.362 m
const MODEL_HEIGHT_M = (8.593 + 4.525) * MODEL_SCALE; // 1.05 m
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
        <Icon name="zap" size={15} color={TOKEN.ctaText} />
        <Text style={flashSt.bannerText} numberOfLines={1}>
          {label ? `${label.toUpperCase()} FOUND!` : "OBJECT FOUND!"}
        </Text>
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────
// DISTANCE FORMATTING
// ─────────────────────────────────────────────
// Metres are only readable up to a point: a spot 30 km away rendered as
// "30284 m", which told the user nothing useful. Switch to km past 1000 m.
//
// The second job is honesty about precision. The distance itself is computed
// correctly (the Haversine here matches reference values to within 0.2%), but
// it is built from a GPS fix that is typically +/- 5-20 m. Printing "142 m"
// from a +/- 12 m measurement claims a precision that does not exist, and it
// is why the readout looks wrong: it changes to 139, then 144, while the user
// is standing still, and disagrees with whatever their Maps app says.
//
// So the displayed figure is rounded to a step the fix can actually support,
// and marked approximate when the uncertainty is material. `accuracy` is the
// device's own horizontal accuracy in metres; omit it to get an exact value.
function distanceStep(accuracy) {
  if (!Number.isFinite(accuracy)) return 1;
  if (accuracy <= 5)  return 1;
  if (accuracy <= 15) return 5;
  if (accuracy <= 40) return 10;
  return 25;
}

function formatDistance(m, accuracy) {
  if (m >= 1000) {
    const km = m / 1000;
    // Past a kilometre the rounding already exceeds any GPS error.
    return { value: km >= 10 ? String(Math.round(km)) : km.toFixed(1), unit: "km", approx: false };
  }

  const step = distanceStep(accuracy);
  if (step > 1) {
    const rounded = Math.max(step, Math.round(m / step) * step);
    return { value: String(rounded), unit: "m", approx: true };
  }
  return { value: String(Math.round(m)), unit: "m", approx: false };
}

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
    color: TOKEN.ctaText, fontSize: 14, fontFamily: fonts.sansBold, letterSpacing: 0.8,
  },
});

// ─────────────────────────────────────────────
// RADAR MAP
// ─────────────────────────────────────────────
// Top-down view with the user at the centre, replacing the bare metre count.
//
// A number alone answers "how far" but not "where", and it can't show the one
// thing that actually governs the experience: the model has an activation
// radius, and nothing appears until you are inside it. Here that radius is
// drawn to scale around the model, so "walk until the dot is inside the ring"
// is something you can see rather than infer from a shrinking number.
//
// Orientation is camera-relative — the top of the radar is wherever the phone
// is pointing — so the blip sits in the direction you would actually turn.
const RADAR_PX = 148;                       // drawing area
const RADAR_R  = RADAR_PX / 2 - 12;         // usable radius, leaving an edge margin

// No `inRange` prop: this radar only ever renders in step 1, which by
// definition is the out-of-range state — the card switches to "point at the
// ground" the moment you cross in. An in-range styling branch here would be
// unreachable code pretending to be a feature.
const RadarMap = ({ distance, bearing, heading, modelRadius, label }) => {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  // Scale so both the model and its whole radius ring always fit. Adaptive
  // rather than fixed: a 15 m walk and a 900 m walk both need to be readable.
  const span  = Math.max(distance + modelRadius * 1.3, modelRadius * 2.4, 12);
  const toPx  = (m) => (m / span) * RADAR_R;

  // Screen angle: 0 = straight ahead. Bearing and heading are both compass
  // degrees, so the difference is how far to turn.
  const rel   = ((bearing - heading + 360) % 360) * (Math.PI / 180);
  const blipX = Math.sin(rel) * toPx(distance);
  const blipY = -Math.cos(rel) * toPx(distance);

  // Legibility floor on the activation ring.
  //
  // The ring is drawn to scale, and at room level that scale disappears: a 6 m
  // radius seen from 200 m away is under 2 px, so "walk until the dot is
  // inside the circle" refers to something the user cannot see. 5 px keeps it
  // on screen as a target from any distance. The floor only ever applies when
  // you are far enough away that the ring would be a speck anyway — by the
  // time the distance matters the true scale has taken over.
  const ringPx = Math.max(toPx(modelRadius), 5);

  const spin = sweep.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={radar.wrap}>
      <View style={radar.face}>
        {/* Range rings, purely for depth perception */}
        <View style={[radar.grid, { width: RADAR_R * 2, height: RADAR_R * 2, borderRadius: RADAR_R }]} />
        <View style={[radar.grid, { width: RADAR_R, height: RADAR_R, borderRadius: RADAR_R / 2 }]} />

        {/* Sweep hand */}
        <Animated.View style={[radar.sweep, { transform: [{ rotate: spin }] }]}>
          <View style={radar.sweepArm} />
        </Animated.View>

        {/* The model's activation radius, drawn around the model itself —
            this is the thing the user is trying to get inside. */}
        <View
          style={[
            radar.radiusRing,
            {
              width: ringPx * 2, height: ringPx * 2, borderRadius: ringPx,
              left: RADAR_PX / 2 + blipX - ringPx,
              top:  RADAR_PX / 2 + blipY - ringPx,
              borderColor: TOKEN.info,
              backgroundColor: "rgba(79,208,220,0.10)",
            },
          ]}
        />

        {/* The model */}
        <View
          style={[
            radar.blip,
            {
              left: RADAR_PX / 2 + blipX - 5,
              top:  RADAR_PX / 2 + blipY - 5,
              backgroundColor: TOKEN.gold,
            },
          ]}
        />

        {/* You, always dead centre, pointing up */}
        <View style={radar.you} />
      </View>

      <Text style={radar.label}>{label}</Text>
    </View>
  );
};

const radar = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  face: {
    width: RADAR_PX, height: RADAR_PX, borderRadius: RADAR_PX / 2,
    backgroundColor: "rgba(8,26,28,0.72)",
    borderWidth: 1, borderColor: TOKEN.borderAccent,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  grid: {
    position: "absolute",
    borderWidth: 1, borderColor: "rgba(120,204,208,0.16)",
  },
  sweep: { position: "absolute", width: RADAR_PX, height: RADAR_PX, alignItems: "center" },
  sweepArm: {
    width: 1.5, height: RADAR_PX / 2,
    backgroundColor: "rgba(79,208,220,0.45)",
  },
  radiusRing: { position: "absolute", borderWidth: 1.5 },
  blip: {
    position: "absolute", width: 10, height: 10, borderRadius: 5,
    borderWidth: 1.5, borderColor: "rgba(0,0,0,0.35)",
  },
  you: {
    width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: TOKEN.textPrimary,
    borderWidth: 2, borderColor: "rgba(8,26,28,0.9)",
  },
  label: { color: TOKEN.textSecond, fontSize: 13, fontFamily: fonts.sansSemi },
});

// ─────────────────────────────────────────────
// STEP CARD  — the main HUD
// ─────────────────────────────────────────────
// One card, one instruction, always answering "what do I do right now?".
//
// It replaces a panel that showed a radar dial, progress pips, a nearest-target
// label and a cue line all at once, and left the user to work out which of them
// was the current task. The three steps below are the three physical actions an
// AR mission actually requires, and exactly one is ever active.
// The pulsing frame drawn over the lower half of the camera during step 2.
// Pointing the phone DOWN at the ground is the single least obvious part of the
// whole flow — ARCore needs a horizontal surface before it can place anything —
// so it gets a target on screen rather than only a sentence.
const GroundReticle = () => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={step.reticleWrap} pointerEvents="none">
      <Animated.View
        style={[
          step.reticle,
          {
            opacity:   pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }],
          },
        ]}
      />
      <View style={step.reticleStatic} />
      <View style={step.reticleArrowWrap}>
        <Icon name="chevrons-down" size={22} color={TOKEN.info} />
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// HOW-IT-WORKS GUIDE
// ─────────────────────────────────────────────
// Shown automatically the first time anyone opens an AR mission, and re-openable
// any time from the "?" button. Without this, a first-time user landed on a
// live camera feed with no idea that the job is to walk somewhere, look
// around, and tap something.
const AR_GUIDE_SEEN_KEY = "arGuideSeen_v1";

const HowItWorks = ({ visible, onClose }) => {
  // These are the same three steps the card at the bottom of the screen walks
  // through, in the same order and the same words. The guide teaches them once;
  // the card then says which one you're on. They must not drift apart.
  const steps = [
    { icon: "navigation", title: "Walk closer",
      body: "The radar shows where the object is. Walk until the white dot is inside the blue circle — nothing appears until you are there." },
    { icon: "chevrons-down", title: "Point your phone at the ground",
      body: "Aim at the floor a few steps ahead and move the phone slowly. Patterned ground — tiles, grass, paving — works far better than a plain wall or bare floor." },
    { icon: "aperture",   title: "Tap the object",
      body: "It appears near where you are standing, so turn and look down until you see it. Find every object here to finish." },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={guideSt.backdrop}>
        <View style={guideSt.card}>
          <View style={guideSt.header}>
            <Icon name="compass" size={18} color={TOKEN.gold} />
            <Text style={guideSt.title}>How the AR activity works</Text>
          </View>

          {steps.map((s, i) => (
            <View key={s.title} style={guideSt.step}>
              <View style={guideSt.stepIcon}>
                <Icon name={s.icon} size={15} color={TOKEN.gold} />
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
  title:  { color: TOKEN.textPrimary, fontSize: 17, fontFamily: fonts.sansBold, letterSpacing: -0.2 },
  step:   { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: TOKEN.goldDim,
    alignItems: "center", justifyContent: "center",
  },
  stepTitle: { color: TOKEN.textPrimary, fontSize: 14, fontFamily: fonts.sansBold, marginBottom: 3 },
  stepBody:  { color: TOKEN.textSecond, fontSize: 12.5, lineHeight: 18 },
  cta: {
    backgroundColor: TOKEN.cta, borderRadius: TOKEN.radiusXl,
    paddingVertical: 13, alignItems: "center", marginTop: 2,
  },
  ctaText: { color: TOKEN.ctaText, fontSize: 14, fontFamily: fonts.sansBold, letterSpacing: 0.6 },
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
// MATERIALS
// ─────────────────────────────────────────────
// Material for the invisible tap target that wraps each model (see
// ModelOnPlane). `writesToDepthBuffer: false` is the important part: a
// transparent box that still wrote depth would sit in front of the model and
// hide it, trading a click bug for an invisibility bug.
ViroMaterials.createMaterials({
  hitTarget: {
    diffuseColor: "#FFFFFF01",
    writesToDepthBuffer: false,
    readsFromDepthBuffer: false,
  },
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
        // Split the gap so two nearby anchors don't both claim the same
        // ground, but never go below the floor.
        //
        // The floor must stay BELOW the base radius or this whole pass
        // silently does nothing. It was once hardcoded to `Math.max(15, half)`
        // against a base of 5, so the guard `cap < radii[i]` compared 15 < 5
        // and was never true. With 3 against a base of 6, `cap` lands in 3..6
        // and the guard bites whenever two anchors are under 12 m apart.
        const cap = Math.max(MIN_MODEL_RADIUS_METERS, half);
        if (cap < radii[i]) radii[i] = cap;
        if (cap < radii[j]) radii[j] = cap;
      }
    }
  }
  return radii;
}

function computeAnchorProximities(spot, userLat, userLon, accuracyMeters) {
  const anchors = spot.modelsCoordinates ?? [];
  const radii   = assignRadii(anchors);

  // Widen the trigger by however wrong the device itself says the fix might
  // be. The alternative is holding the user responsible for their phone's
  // error: they stand on the exact coordinate, the phone reports them 40 m
  // away, nothing appears, and there is no action they can take to fix it.
  const slack = Math.min(Math.max(accuracyMeters ?? 0, 0), MAX_ACCURACY_SLACK_METERS);

  return anchors
    .map((anchor, index) => {
      const distance = Math.round(distanceMeters(userLat, userLon, anchor.lat, anchor.lng));
      const radius   = Math.round(radii[index] + slack);
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
// ─────────────────────────────────────────────
// AR SCENE
// ─────────────────────────────────────────────
// `geoPosition`, when set, is a world position resolved from a real latitude
// and longitude by ARCore Geospatial. When it's null the component falls back
// to the original behaviour: find a floor plane and stand the model on it.
// There is no `tapped` prop any more. A model that has been explored is
// removed from the scene outright and cannot come back until the user leaves
// AR and re-enters, so "this one is already done" is not a state this
// component can ever be in.
const ModelOnPlane = ({ spot, anchorLabel, onModelClick, onModelError, onPlacedChange, geoPosition = null }) => {
  // The model only renders once ARCore finds a HORIZONTAL surface — i.e. once
  // the camera has actually seen the ground. That's the step users get stuck
  // on, and nothing was reporting it outward: the HUD said "TAP THE OBJECT" as
  // soon as ARCore tracking went normal, which happens well before any plane is
  // found. People were being told to tap something that wasn't on screen yet.
  const [, setPlaced]                     = useState(false);
  const [animationName, setAnimationName] = useState("slowSpin");
  const [animationLoop, setAnimationLoop] = useState(true);
  const [animationRun, setAnimationRun]   = useState(true);

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

  // The model, its lights, its tap target and its label. Identical whether it
  // hangs off a detected floor plane or a real-world geospatial anchor, so it
  // lives in one place and both placements render it.
  //
  // `offsetZ` differs between the two: on a plane the anchor is the patch of
  // floor the camera found, so the model is stood 1.4 m clear of it to be
  // lookable. A geospatial anchor is already AT the landmark's coordinates, so
  // any offset would push it off the real spot — it renders at the origin.
  const content = (offsetZ) => (
    <>
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
        // Dimensions measured by walking the asset's node hierarchy and
        // applying every transform — NOT by reading the raw accessor bounds,
        // which describe the mesh before its parent matrices are applied.
        //
        // That distinction matters here: this file came from an FBX export and
        // its root matrices swap Y and Z (the usual Z-up to Y-up conversion).
        // Read raw, the asset looks 13.12 m DEEP and 1.97 m tall; in world
        // space it is actually 1.97 m deep and 13.12 m TALL. At scale 0.08 it
        // is 0.64 m wide, 1.05 m tall, 0.16 m deep — an upright panel, not the
        // shin-high slab an earlier reading of this file suggested.
        //
        // Its origin also sits 0.36 m above its own base (world Y runs -4.525
        // to +8.593), so placing the origin at plane level buried the bottom
        // third of it in the floor. MODEL_BASE_OFFSET_Y lifts it to rest ON
        // the surface.
        scale={[0.08, 0.08, 0.08]}
        position={[0, MODEL_BASE_OFFSET_Y, offsetZ]}
        rotation={[0, 0, 0]}
        animation={{
          name:     animationName,
          run:      animationRun,
          loop:     animationLoop,
          onFinish: handleAnimationFinish,
        }}
        // `onClick`, not `onClickState` with state 1.
        //
        // State 1 is CLICK_DOWN — it fires the moment a press *begins* on
        // the object. Viro calls `onClick` exactly when clickState == CLICKED
        // (see ViroBase.tsx), i.e. a completed down+up on this object.
        onClick={handleClick}
        // Report upward as well as logging. A console.warn alone meant a
        // failed model (404, dead link, corrupt .glb) looked identical to
        // "the object just hasn't appeared yet" — the user stood there
        // waiting for something that was never going to load.
        onError={(e) => {
          console.warn(`[AR] Model load error "${spot.name}"(${anchorLabel}):`, e);
          onModelError?.();
        }}
      />

      {/* Invisible tap target.
          The model is only 0.16 m deep, so seen from the side it is a thin
          sliver — Viro hit-tests against that geometry, which is why a drag
          (sweeping a line across the screen) registered and a tap (a single
          point) usually missed.
          This box wraps the model's real extent — 0.64 m wide, 1.05 m tall,
          0.16 m deep, standing on the plane — and pads it out to something
          hand-sized. It is sized from the measured bounds, NOT from the raw
          accessor values, which have Y and Z the wrong way round for this
          asset.
          opacity 0.01 rather than 0: a fully transparent node is not
          guaranteed to stay in the hit-test pass, and 1% is invisible in
          practice. */}
      <ViroBox
        position={[0, MODEL_HEIGHT_M / 2, offsetZ]}
        scale={[1.0, MODEL_HEIGHT_M + 0.3, 0.9]}
        opacity={0.01}
        materials={["hitTarget"]}
        onClick={handleClick}
      />
      {/* Sits just above the model's head rather than through its middle. */}
      <ViroText
        text={`Tap to explore\n${anchorLabel}`}
        position={[0, MODEL_HEIGHT_M + 0.25, offsetZ]}
        scale={[0.32, 0.32, 0.32]}
        style={arStyles.tapHint}
      />
    </>
  );

  // Geospatial placement: ARCore resolved the landmark's real latitude and
  // longitude, so the model is rendered at that world position and stays put
  // as the user walks around it. No plane detection involved.
  if (geoPosition) {
    return <ViroNode position={geoPosition}>{content(0)}</ViroNode>;
  }

  // Automatic placement: the object appears as soon as ARCore finds a floor,
  // with no tap required. The geofence is what gates it — ARScene renders an
  // empty scene unless an anchor is in range, so a plane found while the user
  // is still walking there can never produce a model.
  //
  // The trade-off to know about: ARCore picks the surface, and indoors it often
  // locks onto a table or a bed before the floor, which puts the object
  // waist-high. Two things here soften that — requiring half a metre of surface
  // rather than a scrap, so it waits for something floor-sized, and standing the
  // model 1.4 m back from the anchor so it isn't under the user's feet.
  return (
    <ViroARPlane
      // 0.1 x 0.1 was a 10 cm square: ARCore latched onto the first scrap of
      // floor it resolved, which is almost always the patch directly underfoot.
      minHeight={0.5}
      minWidth={0.5}
      alignment="Horizontal"
      onAnchorFound={()   => { setPlaced(true);  onPlacedChange?.(true); }}
      onAnchorRemoved={() => { setPlaced(false); onPlacedChange?.(false); }}
    >
      {/* Stood 1.4 m clear of the anchor. The anchor is an arbitrary patch of
          detected floor rather than a point the user chose, so placing the
          model on it directly put the object under their nose. */}
      {content(-1.4)}
    </ViroARPlane>
  );
};

const ARScene = ({ sceneNavigator }) => {
  const { spot, activeAnchors, focusAnchor, onModelClick, onTrackingChange, onModelError, onPlacedChange, onGeoStatus } =
    sceneNavigator.viroAppProps;

  // ── ARCore Geospatial ────────────────────────────────────────────────────
  // Where VPS has coverage, the model is anchored to the landmark's actual
  // latitude/longitude instead of to a floor plane, so it stays where the
  // landmark really is as the user walks around it.
  //
  // This is strictly an upgrade path: every failure — old device, no API key,
  // no VPS coverage here, Earth not yet tracking, pose too coarse — leaves
  // geoAnchors empty and the plane-based placement runs exactly as before.
  // Bulacan's VPS coverage is unknown and patchy outside the main highways, so
  // the fallback is expected to be the common case, not an edge case.
  const [geoAnchors, setGeoAnchors] = useState({});   // anchor.index -> position
  const geoTriedRef = useRef(false);
  const geoIdsRef   = useRef([]);

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

  // Try geospatial once ARCore is tracking and we know which anchors are in
  // range. Earth tracking needs a few seconds and some camera movement to
  // converge, so a "not tracking yet" result is retried rather than treated as
  // a refusal — but only for a bounded number of attempts.
  useEffect(() => {
    if (!tracking || !activeAnchors?.length || geoTriedRef.current) return;

    // Claim the guard BEFORE any await.
    //
    // It used to be set only after the async work finished, and the effect's
    // deps include `activeAnchors` (a fresh array from .filter() on every
    // render) and a callback recreated each render — so the effect re-ran
    // constantly and a dozen evaluations were all in flight before the first
    // one could set the flag. On the device that showed up as
    // "Geospatial mode applied: enabled" twenty times inside 0.4 seconds,
    // each one re-configuring the ARCore session while the others were still
    // resolving. One attempt, claimed synchronously.
    geoTriedRef.current = true;

    let cancelled = false;
    let attempts = 0;
    let timer = null;

    const attempt = async () => {
      if (cancelled) return;
      attempts += 1;

      const first = activeAnchors[0];
      const verdict = await evaluateGeospatial(sceneNavigator, first.lat, first.lng);
      if (cancelled) return;

      if (!verdict.usable) {
        // VPS coverage here is confirmed, so the expectation is that this
        // succeeds — it just needs time. Earth tracking converges only once
        // ARCore has seen enough of the surroundings, and a poor initial pose
        // tightens as it does, so both of those are retried for a real window
        // (15 attempts x 2s = 30s) rather than the token few tries that were
        // appropriate when coverage itself was in doubt.
        const retryable = verdict.reason === "earth-not-tracking"
          || verdict.reason === "low-accuracy"
          || verdict.reason === "no-pose";

        if (retryable && attempts < 15) {
          timer = setTimeout(attempt, 2000);
          return;
        }
        onGeoStatus?.({ active: false, reason: verdict.reason, accuracy: verdict.accuracy });
        return;
      }

      // Resolve one terrain anchor per in-range model.
      const resolved = {};
      const ids = [];
      for (const a of activeAnchors) {
        const anchor = await anchorAtLocation(sceneNavigator, a.lat, a.lng, 0);
        if (cancelled) return;
        if (anchor) {
          resolved[a.index] = anchor.position;
          ids.push(anchor.anchorId);
        }
      }

      geoIdsRef.current = ids;
      setGeoAnchors(resolved);
      onGeoStatus?.({
        active: Object.keys(resolved).length > 0,
        reason: Object.keys(resolved).length ? "ok" : "anchor-failed",
        accuracy: verdict.accuracy,
      });
    };

    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tracking, activeAnchors, sceneNavigator, onGeoStatus]);

  // Release anchors when the scene goes away, so a re-entry starts clean
  // rather than accumulating them in the ARCore session.
  useEffect(() => () => {
    geoIdsRef.current.forEach((id) => releaseAnchor(sceneNavigator, id));
    geoIdsRef.current = [];
  }, [sceneNavigator]);

  if (!tracking) {
    return <ViroARScene onTrackingUpdated={handleTracking} />;
  }

  // EXACTLY ONE model, and only when it is that model's turn.
  //
  // Which model that is — and whether there is one at all — is decided in
  // ARScreen (see `focusAnchor`), because the rule needs the full anchor list
  // and the popup state, neither of which the scene has. The scene's whole job
  // here is to render what it is handed, or nothing.
  //
  // `null` is a normal state, not an error: it means the next object in the
  // sequence isn't in range yet, its trivia card is still open, or everything
  // at this spot has been explored.
  //
  // An empty scene, specifically — not a placeholder. There used to be a
  // floating ViroText here ("Walk closer to …") anchored at [0,0,-2], and that
  // is precisely the node whose nativeCreateAnchoredNode call segfaulted the
  // app: a bare world-positioned node needs an ARCore anchor that may never
  // arrive (poor light, blank wall, session still starting). The HUD says the
  // same thing in plain React Native views that cannot crash.
  if (!focusAnchor) {
    return <ViroARScene onTrackingUpdated={handleTracking} />;
  }

  return (
    <ViroARScene onTrackingUpdated={handleTracking}>
      <ModelOnPlane
        key={focusAnchor.index}
        spot={spot}
        anchorLabel={focusAnchor.label}
        onModelClick={() => onModelClick(focusAnchor)}
        onModelError={onModelError}
        onPlacedChange={onPlacedChange}
        geoPosition={geoAnchors[focusAnchor.index] || null}
      />
    </ViroARScene>
  );
};

const arStyles = {
  tapHint: { fontFamily: fonts.sansMedium, fontSize: 10, color: TOKEN.goldLight, textAlign: "center", textAlignVertical: "center" },
  // `tapHintDone` is gone with the `tapped` prop — an explored model is
  // removed from the scene, so there is nothing left to label "Explored".
  // `scanning` and `outOfRange` are gone with their floating ViroTexts. Both
  // said in 3D what the HUD now says in plain React Native — and a world-
  // positioned node rendered before its anchor exists is the exact pattern that
  // segfaulted this screen before.
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
        <TouchableOpacity
          accessibilityRole="button" style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[popup.card, { transform: [{ translateY: slideAnim }], opacity: fadeAnim }]}
      >
        <View style={popup.dragHandle} />

        <View style={popup.header}>
          <View style={popup.categoryBadge}>
            <Icon name="book-open" size={10} color={TOKEN.goldLight} style={{ marginRight: 5 }} />
            <Text style={popup.categoryText}>ImpactFeedbackStyle</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onClose}
            style={popup.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Icon name="x" size={16} color={TOKEN.textSecond} />
          </TouchableOpacity>
        </View>

        <Text style={popup.spotTitle} numberOfLines={2}>{spot?.name}</Text>

        {activeAnchor?.label ? (
          <View style={popup.anchorBadge}>
            <Icon name="map-pin" size={10} color={TOKEN.cta} style={{ marginRight: 5 }} />
            <Text style={popup.anchorBadgeText}>{activeAnchor.label}</Text>
          </View>
        ) : null}

        {missionJustCompleted ? (
          <View style={popup.missionCompleteBanner}>
            <Icon name="check-circle" size={13} color={TOKEN.success} style={{ marginRight: 7 }} />
            <Text style={popup.missionCompleteText}>AR mission completed! All models explored.</Text>
          </View>
        ) : (
          <View style={popup.missionProgressBanner}>
            <Icon name="aperture" size={13} color={TOKEN.goldLight} style={{ marginRight: 7 }} />
            <Text style={popup.missionProgressText}>
              {tappedCount} / {totalCount} models explored
              {remaining > 0 ? ` — ${remaining} more to finish this activity` : ""}
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
                  accessibilityRole="button"
                  key={i}
                  onPress={() => setCurrentIdx(i)}
                  style={[popup.dot, i === currentIdx && popup.dotActive]}
                />
              ))}
            </View>
            <View style={popup.navRow}>
              <TouchableOpacity
                accessibilityRole="button"
                style={[popup.navBtn, isFirst && popup.navBtnDisabled]}
                onPress={goPrev}
                disabled={isFirst}
                activeOpacity={0.7}
              >
                <Icon name="chevron-left" size={16} color={isFirst ? TOKEN.textMuted : TOKEN.goldLight} />
                <Text style={[popup.navText, isFirst && popup.navTextDisabled]}>Previous</Text>
              </TouchableOpacity>
              <Text style={popup.counter}>{currentIdx + 1} of {trivia.length}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                style={[popup.navBtn, isLast && popup.navBtnDisabled]}
                onPress={goNext}
                disabled={isLast}
                activeOpacity={0.7}
              >
                <Text style={[popup.navText, isLast && popup.navTextDisabled]}>Next</Text>
                <Icon name="chevron-right" size={16} color={isLast ? TOKEN.textMuted : TOKEN.goldLight} />
              </TouchableOpacity>
            </View>
          </>
        )}

        <TouchableOpacity
          accessibilityRole="button" style={popup.doneBtn} onPress={onClose} activeOpacity={0.85}>
          <Icon name="arrow-left" size={15} color={TOKEN.ctaText} style={{ marginRight: 8 }} />
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
  categoryText:    { color: TOKEN.goldLight, fontSize: 9, fontFamily: fonts.sansBold, letterSpacing: 1.5 },
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
  spotTitle:   { color: TOKEN.textPrimary, fontSize: 22, fontFamily: fonts.sansBold, letterSpacing: 0.2, lineHeight: 30, marginBottom: 8 },
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
  anchorBadgeText: { color: TOKEN.infoLight, fontSize: 11, fontFamily: fonts.sansSemi },
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
  missionCompleteText: { color: TOKEN.success, fontSize: 12, fontFamily: fonts.sansBold, letterSpacing: 0.3 },
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
  missionProgressText: { color: TOKEN.goldLight, fontSize: 12, fontFamily: fonts.sansSemi, letterSpacing: 0.2, flex: 1 },
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
  triviaIndexText: { color: TOKEN.goldLight, fontSize: 12, fontFamily: fonts.sansBold },
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
  navText:         { color: TOKEN.textPrimary, fontSize: 13, fontFamily: fonts.sansSemi },
  navTextDisabled: { color: TOKEN.textMuted },
  counter:         { color: TOKEN.textSecond, fontSize: 12, fontFamily: fonts.sansMedium },
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
  doneBtnText: { color: TOKEN.ctaText, fontSize: 14, fontFamily: fonts.sansBold, letterSpacing: 0.3 },
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
        ? computeAnchorProximities(
            spot, userLocation.latitude, userLocation.longitude, userLocation.accuracy
          )
        : [],
    [spot, userLocation?.latitude, userLocation?.longitude, userLocation?.accuracy]
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

  // Set when Viro fails to load the .glb. Distinguishes "the model is broken"
  // from "the model hasn't appeared yet", which look the same through a camera.
  const [modelFailed, setModelFailed] = useState(false);

  // True once ARCore has found a horizontal surface and the model is actually
  // on screen. This is the difference between "tap it" being true and being a
  // lie — see the note in ModelOnPlane.
  const [modelPlaced, setModelPlaced] = useState(false);

  // Whether the model is pinned to the landmark's real coordinates (ARCore
  // Geospatial) or stood on a detected floor plane. Logged rather than shown:
  // the old crosshair badge was an unlabeled icon that meant nothing to a
  // user, and this is developer diagnostics.
  const geoStatusRef = useRef(null);
  const setGeoStatus = (s) => {
    geoStatusRef.current = s;
    console.log("[Geospatial] placement:", s?.active ? `active (±${s.accuracy?.toFixed?.(1)} m)` : `off — ${s?.reason}`);
  };

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

    // Raw last-accepted fix, used only to judge whether the next one is an
    // improvement. What the screen actually renders is the smoothed output.
    const bestRef  = { current: null };
    const smoother = new GpsSmoother();

    const applyFix = (pos) => {
      if (cancelled) return;
      const { latitude, longitude, accuracy } = pos.coords;
      const next = { latitude, longitude, accuracy, timestamp: pos.timestamp || Date.now() };

      // A reading this vague says almost nothing — indoors a phone will
      // happily report ±500 m, which would put every anchor "in range" at once.
      if (Number.isFinite(accuracy) && accuracy > MAX_USABLE_ACCURACY_M) return;

      // Don't let a coarse network fix overwrite a good satellite one. Fixes
      // arrive from several providers and not in quality order, so taking
      // whatever came last made the reported position get *worse* at random.
      if (!isBetterFix(bestRef.current, next)) return;
      bestRef.current = next;

      const smoothed = smoother.push(next);
      setUserLocation({
        latitude:  smoothed.latitude,
        longitude: smoothed.longitude,
        accuracy:  smoothed.accuracy,
        // Kept so the HUD can warn on a genuinely poor fix rather than on the
        // filter's (always better) estimate of its own confidence.
        rawAccuracy: accuracy,
      });
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
            (err2) => {
              if (cancelled) return;
              // A watch error once we already have a fix is almost always just
              // a timeout waiting for the NEXT update — the position we have
              // is still perfectly good. Reporting "Can't find your location"
              // then is simply false, and it replaced a working screen with an
              // error card. Only surface it if we have nothing at all.
              if (bestRef.current) {
                console.warn("[Location] watch error, keeping last fix:", err2.message);
                return;
              }
              setLocationError(err2.message);
            },
            { enableHighAccuracy: false, distanceFilter: 0, interval: 3000, timeout: 30000, maximumAge: 30000 }
          );
        },
        {
          enableHighAccuracy: true,
          distanceFilter:     0,
          interval:           1000,
          fastestInterval:    500,
          timeout:            20000,
          // Was 15000, which let the OS hand back a fix up to fifteen seconds
          // old — on a screen whose whole job is "how far away am I right
          // now". 0 forces every callback to be a fresh reading.
          maximumAge:         0,
        }
      );
    };

    const init = async () => {
      if (Platform.OS === "android") {
        // Use Google Play Services' fused provider instead of the bare
        // platform LocationManager. It merges GPS, wifi and cell signals, so
        // the first fix arrives in a couple of seconds rather than tens of
        // seconds, and subsequent fixes are tighter. The dependency was
        // already in android/app/build.gradle; nothing was selecting it.
        try {
          Geolocation.setRNConfiguration({
            skipPermissionRequests: false,
            authorizationLevel: "whenInUse",
            locationProvider: "playServices",
          });
        } catch {
          // Older builds / no Play Services — the platform provider still works.
        }

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
      smoother.reset();
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

  const activeAnchors = anchorProximities.filter((a) => a.isInRange);

  // ── The one object the whole screen agrees on ─────────────────────────
  //
  // The models at a spot are a numbered trail, walked in the order the
  // moderator listed them. See utils/arTrail.js for the rule itself.
  //
  // It used to pick the *nearest* model you hadn't collected. Two things went
  // wrong with that. The order depended on which way you happened to walk in,
  // so no two users saw the same trail; and because all the anchors at a spot
  // are usually within range of each other, collecting one made the next appear
  // instantly on the same patch of floor — objects that were meant to be a
  // sequence read as one pile flickering between shapes.
  //
  // A collected model is never rendered again: `tappedIndices` lives only as
  // long as this screen is mounted, so the only way to see one a second time is
  // to leave AR and come back, which starts the trail over.
  const trail = useMemo(
    () => resolveTrail(anchorProximities, tappedIndices, triviaVisible),
    [anchorProximities, tappedIndices, triviaVisible]
  );
  // `trail.next` is not pulled out here: everything on screen keys off either
  // `focus` (what is drawn) or `pending` (where to walk), and having a third
  // "the anchor whose turn it is" in scope is how the arrow and the radar came
  // to track two different objects last time.
  const { inRange: nextInRange, focus: focusAnchor, pending: targetPending } = trail;

  // Nothing on screen means nothing is placed. `onAnchorRemoved` is not
  // guaranteed to fire when ModelOnPlane unmounts, and a stale `modelPlaced`
  // would leave the HUD on "look around for the object" with no object.
  useEffect(() => {
    if (!focusAnchor) setModelPlaced(false);
  }, [focusAnchor]);

  // ── Encounter moment ──────────────────────────────────────────────────
  // Fires the flash + haptic exactly once per crossing into range of the
  // object whose turn it is (not on every GPS tick while standing inside one).
  //
  // Keyed to the sequence, so it also fires when you collect one object and
  // are already standing close enough for the next — that is an arrival at the
  // next stop on the trail and deserves the same beat.
  // Which anchor the flash has already been spent on. An index rather than a
  // boolean: with a boolean, collecting the first object while already standing
  // at the second meant "in range" never went false, so the second object slid
  // in with no arrival beat at all.
  const announcedRef = useRef(null);
  const [encounterTrigger, setEncounterTrigger] = useState(0);
  const [encounterLabel, setEncounterLabel]     = useState(null);

  useEffect(() => {
    // Walked away: forget it, so coming back announces again.
    if (!nextInRange) { announcedRef.current = null; return; }
    // In range but nothing drawn yet — the trivia card from the previous
    // object is still up. Announcing now would fire the flash underneath it.
    if (!focusAnchor) return;
    if (announcedRef.current === focusAnchor.index) return;

    announcedRef.current = focusAnchor.index;
    setEncounterLabel(focusAnchor.label);
    setEncounterTrigger((n) => n + 1);
    buzz.encounter();
  }, [nextInRange, focusAnchor?.index]);

  // ── HUD ──────────────────────────────────────────────────────────────
  const renderHUD = () => {
    // `!userLocation` as well as the error: a location error only matters if
    // it left us with nothing to show. With a fix in hand the screen stays
    // usable, which is why this no longer takes over the moment a watch
    // times out.
    if (locationError && !userLocation) {
      // A raw error string ("Location permission denied") left the user at a
      // dead end — nothing to tap, and no hint that the fix lives in system
      // settings. Explain it in plain words and give them the way out.
      const isPermission = /permission|denied/i.test(locationError);
      return (
        <Animated.View style={[hud.container, hud.errorContainer, { opacity: hudOpacity }]}>
          <View style={hud.errorRow}>
            <View style={hud.errorIconWrap}>
              <Icon name="map-pin" size={14} color={TOKEN.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={hud.errorTitle}>
                {isPermission ? "Location access is off" : "Can't find your location"}
              </Text>
              <Text style={hud.errorMsg}>
                {isPermission
                  ? "The AR activity needs your location to know when you've reached the landmark."
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
                <Icon name="settings" size={12} color={TOKEN.ctaText} style={{ marginRight: 6 }} />
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
        <Animated.View style={[hud.container, { opacity: hudOpacity }]} pointerEvents="box-none">
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

    // ── Which of the three steps is the user actually on? ──────────────
    // Exactly one, always. Everything the card shows is derived from this, so
    // it can't tell them to tap an object while also telling them to walk.
    const allCollected = totalAnchors > 0 && tappedIndices.size >= totalAnchors;
    // Three steps: placement is automatic again, so "find a surface" and
    // "object appears" are one event rather than two instructions.
    const TOTAL_STEPS = 3;
    const stepIndex =
      allCollected ? TOTAL_STEPS                       // done
      : !nextInRange ? 0                               // walk there
      : !arTracking || !modelPlaced ? 1                // point at the ground
      : 2;                                             // tap the object

    // rawAccuracy, not the smoothed figure: the question is how much the
    // underlying fix could be out by, not how confident the filter is.
    const dist = targetPending
      ? formatDistance(targetPending.distance, userLocation?.rawAccuracy)
      : null;

    return (
      <Animated.View style={[hud.container, { opacity: hudOpacity }]} pointerEvents="box-none">

        {/* Header: the place, and progress in words.
            Everything unlabeled is gone. There used to be a "2/3" badge, a
            wifi-off glyph and a crosshair glyph here, none of which said what
            they meant — and the three bars below them had to be asked about to
            be understood. A stranger should not have to decode an icon to use
            this screen, and a panel should not have to be told what a bar is.
            "Found 1 of 3" and "Step 2 of 3" carry the same information and
            need no key. */}
        <View style={step.header}>
          <Text style={step.spotName} numberOfLines={1}>{spot.name}</Text>
          {totalAnchors > 1 && !allCollected && (
            <Text style={step.count}>Found {tappedIndices.size} of {totalAnchors}</Text>
          )}
        </View>

        {!modelFailed && !allCollected && targetPending !== undefined && (
          <Text style={step.stepLine}>Step {stepIndex + 1} of {TOTAL_STEPS}</Text>
        )}

        {modelFailed ? (
          <View style={step.body}>
            <View style={[step.iconWrap, { backgroundColor: TOKEN.dangerDim }]}>
              <Icon name="alert-triangle" size={22} color={TOKEN.warn} />
            </View>
            <Text style={step.title}>This model couldn't load</Text>
            <Text style={step.sub}>
              Something's wrong with this spot's 3D file. The other missions here
              still work.
            </Text>
          </View>
        ) : allCollected ? (
          <View style={step.body}>
            <View style={[step.iconWrap, { backgroundColor: TOKEN.successDim }]}>
              <Icon name="check-circle" size={22} color={TOKEN.success} />
            </View>
            <Text style={step.title}>All found!</Text>
            <Text style={step.sub}>
              You've explored everything at {spot.name}.
            </Text>
          </View>

        // ── Step 1: walk there ──────────────────────────────────────────
        ) : stepIndex === 0 ? (
          <View style={step.body}>
            {targetPending ? (
              <>
                <RadarMap
                  distance={targetPending.distance}
                  bearing={bearingDegrees(
                    userLocation.latitude, userLocation.longitude,
                    targetPending.lat, targetPending.lng
                  )}
                  heading={compassHeading}
                  modelRadius={targetPending.radius}
                  // The tilde still carries the honesty about precision; it
                  // just sits under the radar now instead of being the whole
                  // display.
                  label={dist ? `${dist.approx ? "~" : ""}${dist.value} ${dist.unit} away` : "Finding the way…"}
                />
                <Text style={step.title}>Walk closer</Text>
                <Text style={step.sub}>
                  The white dot is you. Walk until it is inside the blue circle
                  — that is where the object is hiding.
                </Text>
              </>
            ) : (
              <>
                <View style={[step.iconWrap, { backgroundColor: TOKEN.dangerDim }]}>
                  <Icon name="map-pin" size={22} color={TOKEN.warn} />
                </View>
                <Text style={step.title}>No AR spots set here yet</Text>
                <Text style={step.sub}>
                  This landmark has a 3D model but nobody has pinned where it
                  should appear. The other missions here still work.
                </Text>
              </>
            )}
          </View>

        // ── Step 2: point at the ground ─────────────────────────────────
        // The step people got stuck on. ARCore needs to see a flat horizontal
        // surface before it can place anything, and nothing in the old UI ever
        // said so — it just said "look around", which people did at eye level.
        ) : stepIndex === 1 ? (
          <View style={step.body}>
            <View style={[step.iconWrap, { backgroundColor: "rgba(79,208,220,0.16)" }]}>
              <Icon name="chevrons-down" size={22} color={TOKEN.info} />
            </View>
            <Text style={step.title}>Point your phone at the ground</Text>
            <Text style={step.sub}>
              You have arrived. Aim at the floor a few steps ahead and move the
              phone slowly. Patterned ground works best — tiles, grass, paving.
              A plain wall or a bare white floor gives it nothing to lock onto.
            </Text>
          </View>

        // ── Step 3: tap it ──────────────────────────────────────────────
        ) : (
          <View style={step.body}>
            <View style={[step.iconWrap, { backgroundColor: TOKEN.goldDim }]}>
              <Icon name="aperture" size={22} color={TOKEN.gold} />
            </View>
            <Text style={step.title}>Look around for the object</Text>
            {/* NOT "it is on screen now".
                `modelPlaced` means a plane was found and the model attached to
                it — it says nothing about whether the object is in view. The
                model stands 1.4 m from the anchor in whatever direction that
                plane faces, so the user is often looking the other way. Claiming
                it is on screen when they are staring at a blank wall is exactly
                the "tap something that isn't there" problem from before, moved
                one step along. */}
            <Text style={step.sub}>
              It is placed near you — turn slowly and look down until you see it,
              then tap it to read the story behind this place
              {totalAnchors > 1 ? ` — ${totalAnchors - tappedIndices.size} still to find here.` : "."}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  // No model uploaded for this spot — bail out before mounting an AR session.
  //
  // Viro3DObject was being handed `source={{ uri: undefined }}`, which fails
  // inside the renderer: nothing ever appears, the mission can't be completed,
  // and in a dev build it surfaces as a load error with no explanation. Most
  // spots are in this state today, because the AR mission is auto-created for
  // every spot while the .glb has to be uploaded by hand afterwards.
  if (!spot.AR3DModelURL) {
    return (
      <View style={[main.root, main.unsupportedRoot]}>
        <StatusBar barStyle="light-content" backgroundColor={TOKEN.bg} />
        <View style={main.unsupportedCard}>
          <View style={main.unsupportedIcon}>
            <Icon name="box" size={26} color={TOKEN.warn} />
          </View>
          <Text style={main.unsupportedTitle}>No 3D model here yet</Text>
          <Text style={main.unsupportedBody}>
            {spot.name} doesn't have its AR model set up yet, so there's nothing to
            find here for now. The other missions at this spot still work.
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

  // Device can't do AR — say so plainly instead of mounting the navigator and
  // leaving the user on a black screen wondering what broke.
  if (arSupport === "unsupported") {
    return (
      <View style={[main.root, main.unsupportedRoot]}>
        <StatusBar barStyle="light-content" backgroundColor={TOKEN.bg} />
        <View style={main.unsupportedCard}>
          <View style={main.unsupportedIcon}>
            <Icon name="camera-off" size={26} color={TOKEN.warn} />
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
          // `activeAnchors` is still every in-range anchor, because the
          // geospatial pass resolves terrain anchors for all of them up front —
          // the trail should not stall for a network round trip each time the
          // next object's turn comes around. `focusAnchor` is the only one that
          // gets rendered.
          activeAnchors,
          focusAnchor,
          onModelClick:     handleModelClick,
          onTrackingChange: setArTracking,
          onModelError:     () => setModelFailed(true),
          onPlacedChange:   setModelPlaced,
          onGeoStatus:      setGeoStatus,
        }}
        style={{ flex: 1 }}
      />

      {/* While the user still has to walk somewhere, the camera feed is not the
          task — it's a distraction that makes the screen look like it should
          already be showing something. Dimming it says "not yet, keep walking"
          far better than any sentence, and it lifts the moment they arrive. */}
      {!nextInRange && <View style={main.travelScrim} pointerEvents="none" />}

      {/* In range but nothing placed yet: put the target on the screen instead
          of only describing it. Suppressed while the trivia card is up —
          `focusAnchor` is null then, so there is no object being placed and a
          reticle would be hunting for a surface nothing is waiting on. */}
      {focusAnchor && arTracking && !modelPlaced && !modelFailed && <GroundReticle />}

      {/* ── Top bar ── */}
      <View style={main.topBar}>
        <TouchableOpacity
          style={main.iconBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Leave AR activity"
        >
          <Icon name="arrow-left" size={18} color={TOKEN.textPrimary} />
        </TouchableOpacity>
        {/* "AR ACTIVITY" in tracked capitals was branding, not information —
            the user already knows they opened AR, and the spot's name is on
            the card below. Removed rather than reworded. */}

        <View style={main.topRight}>
          <TouchableOpacity
            style={main.helpBtn}
            onPress={() => setGuideVisible(true)}
            activeOpacity={0.8}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="How this works"
          >
            <Icon name="help-circle" size={15} color={TOKEN.textPrimary} />
            <Text style={main.helpBtnText}>How this works</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* The floating direction arrow is gone. It answered the same question as
          the radar — which way to turn — while sitting in a different corner of
          the screen with its own colour language and its own status badge
          ("Bear right", "Turn around"). Two navigation aids competing is the
          main reason this screen felt busy; the radar shows bearing, distance
          and the activation ring in one place. */}

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
// STEP CARD STYLES
// ─────────────────────────────────────────────
// Deliberately roomy. This card is read at arm's length, outdoors, in sunlight,
// by someone who is walking — so the instruction is set large and centred with
// nothing competing beside it.
const step = StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", gap: 8 },
  spotName:    { flex: 1, color: TOKEN.textPrimary, fontSize: 13.5, fontFamily: fonts.sansBold },
  count:       { color: TOKEN.textSecond, fontSize: 12.5, fontFamily: fonts.sansSemi },
  // Plain words where three unlabeled bars used to be.
  stepLine:    { color: TOKEN.textMuted, fontSize: 11.5, fontFamily: fonts.sansBold, letterSpacing: 0.4, textAlign: "center" },

  body:     { alignItems: "center", gap: 6, paddingTop: 6, paddingBottom: 2 },
  iconWrap: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  title: {
    color: TOKEN.textPrimary, fontSize: 17, fontFamily: fonts.sansBold,
    textAlign: "center", letterSpacing: -0.3,
  },
  sub: {
    color: TOKEN.textSecond, fontSize: 13, lineHeight: 18, textAlign: "center",
    paddingHorizontal: 4,
  },


  // Ground-scanning target, lower-centre so it sits where the floor is when
  // the phone is tilted down.
  reticleWrap: {
    position: "absolute", left: 0, right: 0,
    top: SCREEN_H * 0.42,
    alignItems: "center", justifyContent: "center",
  },
  reticle: {
    position: "absolute",
    width: 150, height: 150, borderRadius: 75,
    borderWidth: 2, borderColor: TOKEN.info,
  },
  reticleStatic: {
    width: 150, height: 150, borderRadius: 75,
    borderWidth: 1.5, borderColor: "rgba(79,208,220,0.35)",
    borderStyle: "dashed",
  },
  reticleArrowWrap: { position: "absolute" },
});

// ─────────────────────────────────────────────
// HUD STYLES
// ─────────────────────────────────────────────
const hud = StyleSheet.create({
  container: {
    position:        "absolute",
    bottom:          Platform.OS === "ios" ? 52 : 40,
    left: 16, right: 16,
    backgroundColor: TOKEN.surface,
    borderRadius:    TOKEN.radiusLg,
    padding:         16,
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
  errorTitle:   { color: TOKEN.textPrimary, fontSize: 13, fontFamily: fonts.sansBold, marginBottom: 3 },
  errorMsg:     { color: TOKEN.textSecond,  fontSize: 12, lineHeight: 17 },
  errorActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  errorBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: TOKEN.cta,
    borderRadius: TOKEN.radiusXl,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  errorBtnText: { color: TOKEN.ctaText, fontSize: 12, fontFamily: fonts.sansBold },
  errorBtnGhost: {
    borderRadius: TOKEN.radiusXl,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: TOKEN.border,
  },
  errorBtnGhostText: { color: TOKEN.textSecond, fontSize: 12, fontFamily: fonts.sansBold },
  loadingRow:   { flexDirection: "row", alignItems: "center" },
  loadingText:  { color: TOKEN.textSecond, fontSize: 13 },
  loadingHint:  { color: TOKEN.textMuted, fontSize: 11, marginTop: 2, lineHeight: 15 },
  // Collected-progress pips (replaced the two "x / y" stat badges)
  // In-zone call to action — replaces the small grey "point camera…" line
  // with the one instruction that matters, styled as the primary action.
});

// ─────────────────────────────────────────────
// MAIN STYLES
// ─────────────────────────────────────────────
const main = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKEN.bg },
  // Not opaque — the camera stays visible so the phone doesn't feel broken,
  // just clearly backgrounded while walking is the job.
  travelScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,18,20,0.62)" },
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
  unsupportedTitle: { color: TOKEN.textPrimary, fontSize: 17, fontFamily: fonts.sansBold, textAlign: "center" },
  unsupportedBody:  { color: TOKEN.textSecond, fontSize: 13, lineHeight: 19, textAlign: "center" },
  unsupportedBtn: {
    backgroundColor: TOKEN.cta, borderRadius: TOKEN.radiusXl,
    paddingVertical: 12, paddingHorizontal: 22, marginTop: 4,
  },
  unsupportedBtnText: { color: TOKEN.ctaText, fontSize: 13.5, fontFamily: fonts.sansBold },
  // A labelled button, not a bare "?" glyph — the one control on this
  // screen a first-time user most needs to find is the explanation.
  helpBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: TOKEN.surface,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: TOKEN.borderAccent,
  },
  helpBtnText: { color: TOKEN.textPrimary, fontSize: 12, fontFamily: fonts.sansBold },
});