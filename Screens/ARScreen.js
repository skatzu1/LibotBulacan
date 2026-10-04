import React, { useState, useEffect, useRef, useMemo } from "react";
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
import Geolocation from "@react-native-community/geolocation";
import * as Haptics from "expo-haptics";
import { useIsFocused } from "@react-navigation/native";
import { useMissions } from "../context/MissionContext";
import { usePreferredFrameRate } from "../modules/frame-rate";
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroARPlane,
  Viro3DObject,
  ViroBox,
  ViroText,
  ViroAmbientLight,
  ViroSpotLight,
  ViroAnimations,
  ViroMaterials,
  isARSupportedOnDevice,
  ViroTrackingStateConstants,
} from "@reactvision/react-viro";
import { GpsSmoother, isBetterFix, MAX_USABLE_ACCURACY_M } from "../utils/gpsFilter";
import useCompassHeading from "../hooks/useCompassHeading";
import { resolveTrail, triviaForModel } from "../utils/arTrail";
import { fonts, typography, radius, shadow, useTheme } from "../context/ThemeContext";
import Icon from "../components/Icon";
import { showAlert } from "../components/AppAlert";
import { PrimaryButton, EmptyState, ScreenHeader, H_PAD } from "../components/ui";
import { useCachedModel } from "../utils/modelCache";

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
// "#rrggbb" + alpha → rgba(). The theme's colours are plain hex.
const withAlpha = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

// The HUD follows the app's light/dark setting like every other screen (the
// thesis panel asked for it; it used to be dark in every theme). Text and
// status colours are the app's own theme tokens. What's specific to AR is how
// the panels sit on a live camera feed: they're nearly opaque, so contrast
// never depends on what the camera is looking at — dark teal glass in dark
// mode, cream and white in light mode.
//
// Yellow has two jobs. `gold` / `cta` are FILLS and marks drawn over the
// camera (buttons, the encounter ring, focus brackets) and stay the brand
// yellow in both themes. `goldLight` is yellow used as TEXT or an icon on a
// panel: a pale yellow on dark, the readable amber (`accentDark`) on light,
// since raw yellow is 1.5:1 on cream. Cyan works the same way through
// `info` / `infoLight`.
const arTokens = (c, isDark) => ({
  bg:           c.background,
  surface:      isDark ? "rgba(16,32,34,0.90)" : "rgba(251,248,242,0.97)",
  surfaceHigh:  isDark ? "rgba(24,48,50,0.95)" : "rgba(255,255,255,0.97)",
  sheet:        isDark ? "#12262A" : c.card,          // the trivia bottom sheet
  border:       isDark ? "rgba(120,204,208,0.18)" : "rgba(10,111,120,0.16)",
  borderAccent: isDark ? "rgba(120,204,208,0.42)" : "rgba(10,111,120,0.32)",
  textPrimary:  c.textPrimary,
  textSecond:   c.textSecondary,
  textMuted:    c.textMuted,
  gold:         c.accent,
  goldLight:    isDark ? "#F6DF5C" : c.accentDark,
  goldDim:      isDark ? "rgba(242,206,27,0.16)" : c.accentSoft,
  success:      c.success,
  // Light mode uses the app's solid badge fills: a see-through tint let a dark
  // camera frame pull green text on it under 4.5:1.
  successDim:   isDark ? withAlpha(c.success, 0.18) : c.successBg,
  warn:         c.warning,
  danger:       c.danger,
  dangerDim:    isDark ? withAlpha(c.danger, 0.18) : c.dangerBg,
  // The location-error card. Nearly opaque like every other panel — it used
  // to be the 18% tint above, so its text sat almost straight on the camera.
  errorSurface: isDark ? "rgba(44,20,20,0.94)" : c.dangerBg,
  info:         c.brand,
  infoLight:    isDark ? "#8BE4EC" : c.brand,
  infoFaint:    withAlpha(c.brand, 0.10),
  infoDim:      withAlpha(c.brand, 0.16),
  infoDash:     withAlpha(c.brand, 0.35),
  cta:          c.accent,
  ctaText:      c.onAccent,

  // Radar dial and the small chips that sit straight on the camera.
  radarFace:    isDark ? "rgba(8,26,28,0.72)" : "rgba(251,248,242,0.88)",
  radarGrid:    withAlpha(c.brand, isDark ? 0.16 : 0.20),
  radarSweep:   withAlpha(c.brand, 0.45),
  // The copy calls this "the white dot", so it's white in both themes; light
  // mode rings it in dark so it holds on the cream dial.
  youDot:       isDark ? c.textPrimary : "#FFFFFF",
  youRing:      isDark ? "rgba(8,26,28,0.9)" : c.textPrimary,
  chipBg:       isDark ? "rgba(6,18,20,0.72)" : "rgba(251,248,242,0.85)",
  // Backgrounds the camera while there's still walking to do: dimmed in dark
  // mode, washed out toward the page in light mode. Either way, "not yet".
  travelScrim:  isDark ? "rgba(6,18,20,0.62)" : "rgba(251,248,242,0.60)",
  statusBar:    isDark ? "light-content" : "dark-content",
  // Behind the trivia sheet and the guide: the same dim as every other
  // dialog in the app.
  scrim:        c.overlay,

  // The app's own corner radii (ThemeContext `radius`), so a card here has
  // the same corners as a card on any other screen.
  radiusSm:     radius.sm,
  radiusMd:     radius.md,
  radiusLg:     radius.card,
  radiusXl:     radius.xl,
  spaceSm:      8,
  spaceMd:      16,
  spaceLg:      24,
});

// Shadows for the panels floating on the camera. iOS gets the app's soft
// shadow; Android gets none, because an elevation shadow under a see-through
// panel shows through it as a hard grey square (the same bug the tab bar had,
// see Home.js CustomTabBar).
const floatShadow = Platform.OS === "ios" ? shadow.md : { elevation: 0 };

// Every component on this screen reads its colours and styles from here, so
// the whole HUD switches together when the theme does. The style sheets are
// built per theme, once, next to the components that use them (makeFlashSt,
// makeRadar, …) and memoised on the theme.
function useAr() {
  const { colors, isDark } = useTheme();
  return useMemo(() => {
    const TOKEN = arTokens(colors, isDark);
    return {
      TOKEN,
      flashSt: makeFlashSt(TOKEN),
      radar:   makeRadar(TOKEN),
      focusSt: makeFocusSt(TOKEN),
      guideSt: makeGuideSt(TOKEN),
      popup:   makePopup(TOKEN),
      step:    makeStep(TOKEN),
      hud:     makeHud(TOKEN),
      main:    makeMain(TOKEN),
    };
  }, [colors, isDark]);
}

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
// How far the model stands from its floor anchor, in metres. The anchor is
// whatever patch of floor ARCore found first, usually right underfoot.
const MODEL_OFFSET_Z = -1.4;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ── Taps on the camera view ──────────────────────────────────────────────
// Viro's click events (ViroClickStateTypes).
const CLICK_UP = 2;
const CLICKED  = 3;
// A touch counts as a tap only if it is short and barely moves; anything
// longer is the user moving the phone around with a finger on the glass.
const TAP_MAX_MS      = 400;
const TAP_MAX_MOVE_DP = 12;
// One tap on the model can be reported twice (Viro's event + our own test).
const MODEL_TAP_DEDUPE_MS = 700;
// Forgiveness around the model's on-screen outline, in dp.
const MODEL_TAP_SLOP_DP = 24;
// Refocus: how long ARCore stays in FIXED focus before AUTO is restored (long
// enough for the lens to actually move, so AUTO starts a fresh focus pass),
// and the minimum gap between refocuses so tap-happy users don't thrash the
// session config.
const REFOCUS_FIXED_MS  = 300;
const REFOCUS_GAP_MS    = 1200;

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Does a tap at (x, y) — view coordinates in dp — land on the model?
 *
 * Projects the corners of the model's invisible hit box (world space) onto the
 * screen and checks the tap against their outline. `project` answers in the
 * renderer's units, which are pixels on Android; rather than assume a density,
 * it's calibrated on the spot: a point straight ahead of the camera projects
 * to the centre of the view, so its projection divided by half the view size
 * is the units-per-dp factor.
 */
async function modelHitTest({ x, y, view, hitNode, scene, sceneNavigator }) {
  if (!hitNode || !scene || !view?.width || !view?.height) return false;

  const [bbRes, cam] = await Promise.all([hitNode.getBoundingBoxAsync(), scene.getCameraOrientationAsync()]);
  const b = bbRes?.boundingBox;
  if (!b || !cam?.position || !cam?.forward) return false;

  const corners = [];
  for (const cx of [b.minX, b.maxX]) for (const cy of [b.minY, b.maxY]) for (const cz of [b.minZ, b.maxZ]) {
    corners.push([cx, cy, cz]);
  }
  // Only corners in front of the camera. A point behind it still projects —
  // mirrored — onto the screen, which would register taps on empty sky.
  const ahead = corners.filter((p) => dot3(p.map((v, i) => v - cam.position[i]), cam.forward) > 0.05);
  if (!ahead.length) return false;

  const straightAhead = cam.position.map((p, i) => p + cam.forward[i]);
  const [mid, ...proj] = await Promise.all(
    [straightAhead, ...ahead].map((p) => sceneNavigator.project(p))
  );
  const kx = mid?.screenPosition?.[0] / (view.width / 2);
  const ky = mid?.screenPosition?.[1] / (view.height / 2);
  // A calibration that makes no sense (session not ready, odd return) means
  // "don't know" — fall back to Viro's own click rather than guess.
  if (!(kx > 0.25 && kx < 6 && ky > 0.25 && ky < 6)) return false;

  const xs = proj.map((r) => r?.screenPosition?.[0] / kx).filter(Number.isFinite);
  const ys = proj.map((r) => r?.screenPosition?.[1] / ky).filter(Number.isFinite);
  if (!xs.length || !ys.length) return false;

  const hit = x >= Math.min(...xs) - MODEL_TAP_SLOP_DP && x <= Math.max(...xs) + MODEL_TAP_SLOP_DP
           && y >= Math.min(...ys) - MODEL_TAP_SLOP_DP && y <= Math.max(...ys) + MODEL_TAP_SLOP_DP;
  if (__DEV__) {
    console.log(`[AR tap] ${hit ? "model" : "miss"} at ${x.toFixed(0)},${y.toFixed(0)}; model x ${Math.min(...xs).toFixed(0)}–${Math.max(...xs).toFixed(0)} y ${Math.min(...ys).toFixed(0)}–${Math.max(...ys).toFixed(0)}; units/dp ${kx.toFixed(2)}`);
  }
  return hit;
}

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
  const { TOKEN, flashSt } = useAr();
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
        <Icon name="zap" size={16} color={TOKEN.ctaText} weight="fill" />
        <Text style={flashSt.bannerText} numberOfLines={1}>
          {label ? `${label} found!` : "Object found!"}
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

const makeFlashSt = (TOKEN) => StyleSheet.create({
  overlay:{ ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
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
    borderRadius:      radius.pill,
    ...shadow.md,
  },
  bannerText: {
    ...typography.title, fontFamily: fonts.sansBold, color: TOKEN.ctaText,
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
  const { TOKEN, radar } = useAr();
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
              backgroundColor: TOKEN.infoFaint,
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

// The radar is the only thing that uses the compass, so it owns the
// subscription. The compass used to live in the main AR component, where
// every reading re-rendered the whole screen — AR scene, HUD and all — to
// rotate this one widget. Owning it here also means the sensors only run while
// the radar is on screen (the "walk there" step), not for the whole session.
const LiveRadar = ({ label, ...props }) => {
  const { heading, needsCalibration } = useCompassHeading();
  const note = needsCalibration ? " · Compass unsure: move your phone in a figure 8" : "";
  return <RadarMap {...props} heading={heading} label={`${label}${note}`} />;
};

const makeRadar = (TOKEN) => StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  face: {
    width: RADAR_PX, height: RADAR_PX, borderRadius: RADAR_PX / 2,
    backgroundColor: TOKEN.radarFace,
    borderWidth: 1, borderColor: TOKEN.borderAccent,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  grid: {
    position: "absolute",
    borderWidth: 1, borderColor: TOKEN.radarGrid,
  },
  sweep: { position: "absolute", width: RADAR_PX, height: RADAR_PX, alignItems: "center" },
  sweepArm: {
    width: 1.5, height: RADAR_PX / 2,
    backgroundColor: TOKEN.radarSweep,
  },
  radiusRing: { position: "absolute", borderWidth: 1.5 },
  blip: {
    position: "absolute", width: 10, height: 10, borderRadius: 5,
    borderWidth: 1.5, borderColor: "rgba(0,0,0,0.35)",
  },
  you: {
    width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: TOKEN.youDot,
    borderWidth: 2, borderColor: TOKEN.youRing,
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
  const { TOKEN, step } = useAr();
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

// Feedback for tap-to-refocus: camera-style corner brackets that settle and
// fade. They appear in the MIDDLE of the frame rather than under the finger,
// because that's what ARCore's autofocus actually meters — a ring under the
// finger would promise a "focus here" that ARCore can't do.
const FocusRing = ({ pulse }) => {
  const { focusSt } = useAr();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulse) return undefined;
    anim.setValue(0);
    const run = Animated.timing(anim, { toValue: 1, duration: 950, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [pulse]);

  if (!pulse) return null;
  return (
    <View style={focusSt.wrap} pointerEvents="none" accessibilityLiveRegion="polite" accessibilityLabel="Focusing">
      <Animated.View
        style={[
          focusSt.box,
          {
            opacity:   anim.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ scale: anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1.35, 1, 1] }) }],
          },
        ]}
      >
        <View style={[focusSt.corner, focusSt.tl]} />
        <View style={[focusSt.corner, focusSt.tr]} />
        <View style={[focusSt.corner, focusSt.bl]} />
        <View style={[focusSt.corner, focusSt.br]} />
      </Animated.View>
      <Animated.Text
        style={[focusSt.label, { opacity: anim.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 1, 0] }) }]}
      >
        Focusing
      </Animated.Text>
    </View>
  );
};

const FOCUS_BOX = 88;
const makeFocusSt = (TOKEN) => StyleSheet.create({
  wrap:   { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  box:    { width: FOCUS_BOX, height: FOCUS_BOX },
  corner: { position: "absolute", width: 22, height: 22, borderColor: TOKEN.gold },
  tl:     { top: 0,    left: 0,  borderTopWidth: 2.5,    borderLeftWidth: 2.5,  borderTopLeftRadius: 6 },
  tr:     { top: 0,    right: 0, borderTopWidth: 2.5,    borderRightWidth: 2.5, borderTopRightRadius: 6 },
  bl:     { bottom: 0, left: 0,  borderBottomWidth: 2.5, borderLeftWidth: 2.5,  borderBottomLeftRadius: 6 },
  br:     { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 6 },
  label: {
    marginTop: 10,
    ...typography.label, color: TOKEN.textPrimary,
    backgroundColor: TOKEN.chipBg, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, overflow: "hidden",
  },
});

// ─────────────────────────────────────────────
// HOW-IT-WORKS GUIDE
// ─────────────────────────────────────────────
// Shown automatically every time an AR mission opens, and re-openable any time
// from "How this works". Without this, a first-time user landed on a live
// camera feed with no idea that the job is to walk somewhere, look around, and
// tap something.
const HowItWorks = ({ visible, onClose }) => {
  const { TOKEN, guideSt } = useAr();
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
            <Icon name="compass" size={18} color={TOKEN.goldLight} />
            <Text style={guideSt.title}>How the AR activity works</Text>
          </View>

          {steps.map((s, i) => (
            <View key={s.title} style={guideSt.step}>
              <View style={guideSt.stepIcon}>
                <Icon name={s.icon} size={15} color={TOKEN.goldLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={guideSt.stepTitle}>{i + 1}. {s.title}</Text>
                <Text style={guideSt.stepBody}>{s.body}</Text>
              </View>
            </View>
          ))}

          <PrimaryButton
            title="Got it"
            onPress={onClose}
            accessibilityLabel="Close the how it works guide"
            style={guideSt.cta}
          />
        </View>
      </View>
    </Modal>
  );
};

const makeGuideSt = (TOKEN) => StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: TOKEN.scrim,
    alignItems: "center", justifyContent: "center", padding: H_PAD,
  },
  // Opaque, like the app's other dialogs (components/AppAlert.js).
  card: {
    width: "100%", maxWidth: 380,
    backgroundColor: TOKEN.sheet,
    borderRadius: TOKEN.radiusLg,
    borderWidth: 1, borderColor: TOKEN.border,
    padding: 22, gap: 16,
    ...shadow.lg,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  title:  { ...typography.h2, fontSize: 22, lineHeight: 28, color: TOKEN.textPrimary, flex: 1 },
  step:   { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: TOKEN.goldDim,
    alignItems: "center", justifyContent: "center",
  },
  stepTitle: { ...typography.title, color: TOKEN.textPrimary, marginBottom: 3 },
  stepBody:  { ...typography.body, fontSize: 13.5, lineHeight: 20, color: TOKEN.textSecond },
  cta:       { marginTop: 2 },
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
// Stands the model on the first floor plane ARCore finds.
// There is no `tapped` prop any more. A model that has been explored is
// removed from the scene outright and cannot come back until the user leaves
// AR and re-enters, so "this one is already done" is not a state this
// component can ever be in.
const ModelOnPlane = ({ spot, modelUri, anchorLabel, onModelClick, onModelError, onPlacedChange, tapBridge }) => {
  // The model only renders once ARCore finds a HORIZONTAL surface — i.e. once
  // the camera has actually seen the ground. That's the step users get stuck
  // on, and nothing was reporting it outward: the HUD said "TAP THE OBJECT" as
  // soon as ARCore tracking went normal, which happens well before any plane is
  // found. People were being told to tap something that wasn't on screen yet.
  const [placed, setPlaced]               = useState(false);
  const [animationName, setAnimationName] = useState("slowSpin");
  const [animationLoop, setAnimationLoop] = useState(true);
  const [animationRun, setAnimationRun]   = useState(true);

  const handleClick = () => {
    // One tap can now arrive by two routes — Viro's own click event and the
    // screen-level tap test in ARScreen (see `tapBridge`) — so the second
    // one inside this window is the same tap, not a new one.
    const now = Date.now();
    if (now - tapBridge.lastModelTapAt < MODEL_TAP_DEDUPE_MS) return;
    tapBridge.lastModelTapAt = now;

    setAnimationName("wiggle");
    setAnimationLoop(false);
    setAnimationRun(true);
    onModelClick();
  };

  // Hand ARScreen a way to "tap" this model from outside the Viro scene. A ref
  // keeps it pointing at the current render's handler without re-registering.
  const clickRef = useRef(handleClick);
  clickRef.current = handleClick;
  useEffect(() => {
    const tap = () => clickRef.current();
    tapBridge.tapModel = tap;
    return () => { if (tapBridge.tapModel === tap) tapBridge.tapModel = null; };
  }, [tapBridge]);

  // The nodes exist before a plane is found, just not on screen — so the
  // screen-level tap test only runs once the model is really standing somewhere.
  useEffect(() => {
    tapBridge.placed = placed;
    return () => { tapBridge.placed = false; };
  }, [tapBridge, placed]);

  // Viro only reports CLICKED when it sees BOTH the press and the release land
  // on this node. On Android a quick first tap usually didn't qualify — the
  // model needed a second tap at the same spot, or a swipe. That pattern fits
  // the press being hit-tested before the new touch position reaches the
  // renderer (inferred from the behaviour, not read from Viro's native code).
  // CLICK_UP alone is therefore taken as the tap, and ARScreen also tests taps
  // itself (see `tapBridge`). Nothing in this scene is dragged, so a touch that
  // ends on the model can only mean "open it".
  const handleClickState = (state) => {
    if (state === CLICK_UP || state === CLICKED) handleClick();
  };

  const handleAnimationFinish = () => {
    if (animationName === "wiggle") {
      setAnimationName("slowSpin");
      setAnimationLoop(true);
      setAnimationRun(true);
    }
  };

  // The model, its lights, its tap target and its label, all stood
  // MODEL_OFFSET_Z clear of the floor anchor.
  const content = (
    <>
      {/* Intensities make up for HDR being off (see ViroARSceneNavigator):
          Viro's tone curve lifted shadows and softened highlights, so this
          is more ambient and less spot than the 300 / 1000 it used to be —
          the same look on the model's yellow, white and cyan within ≈5/255.
          No castsShadow: nothing in the scene receives a shadow, but casting
          one still rendered a shadow map every frame. */}
      <ViroAmbientLight color="#fff8f5" intensity={378} />
      <ViroSpotLight
        innerAngle={5}
        outerAngle={90}
        direction={[0, -1, -0.2]}
        position={[0, 3, 1]}
        color="#fff8f5"
        intensity={780}
      />
      <Viro3DObject
        // The phone's saved copy of spot.AR3DModelURL (utils/modelCache.js).
        source={{ uri: modelUri }}
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
        position={[0, MODEL_BASE_OFFSET_Y, MODEL_OFFSET_Z]}
        rotation={[0, 0, 0]}
        animation={{
          name:     animationName,
          run:      animationRun,
          loop:     animationLoop,
          onFinish: handleAnimationFinish,
        }}
        // CLICK_UP or CLICKED — see handleClickState. Never CLICK_DOWN: that
        // fires the moment a press begins, before it's known to be a tap.
        onClickState={handleClickState}
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
        // Also the shape ARScreen's own tap test projects onto the screen.
        ref={(node) => { tapBridge.hitNode = node; }}
        position={[0, MODEL_HEIGHT_M / 2, MODEL_OFFSET_Z]}
        scale={[1.0, MODEL_HEIGHT_M + 0.3, 0.9]}
        opacity={0.01}
        materials={["hitTarget"]}
        onClickState={handleClickState}
      />
      {/* Sits just above the model's head rather than through its middle. */}
      <ViroText
        text={`Tap to explore\n${anchorLabel}`}
        position={[0, MODEL_HEIGHT_M + 0.25, MODEL_OFFSET_Z]}
        scale={[0.32, 0.32, 0.32]}
        style={arStyles.tapHint}
      />
    </>
  );

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
      {content}
    </ViroARPlane>
  );
};

const ARScene = ({ sceneNavigator }) => {
  const { spot, modelUri, focusAnchor, onModelClick, onTrackingChange, onModelError, onPlacedChange, tapBridge } =
    sceneNavigator.viroAppProps;

  // Lets ARScreen ask "was that tap on the model?" — it sees the touch, but
  // only the scene can reach the camera pose, the projection and the node.
  const sceneRef = useRef(null);
  useEffect(() => {
    const hitTest = (x, y, view) => modelHitTest({
      x, y, view, sceneNavigator,
      hitNode: tapBridge.placed ? tapBridge.hitNode : null,
      scene: sceneRef.current,
    });
    tapBridge.hitTest = hitTest;
    return () => { if (tapBridge.hitTest === hitTest) tapBridge.hitTest = null; };
  }, [tapBridge, sceneNavigator]);

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
    return <ViroARScene ref={sceneRef} onTrackingUpdated={handleTracking} />;
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
  //
  // Also empty while the model is still downloading into the phone's cache
  // (modelUri null — see utils/modelCache.js): handed the URL meanwhile,
  // Viro would download the same file a second time.
  if (!focusAnchor || !modelUri) {
    return <ViroARScene ref={sceneRef} onTrackingUpdated={handleTracking} />;
  }

  return (
    <ViroARScene ref={sceneRef} onTrackingUpdated={handleTracking}>
      <ModelOnPlane
        key={focusAnchor.index}
        spot={spot}
        modelUri={modelUri}
        anchorLabel={focusAnchor.label}
        onModelClick={() => onModelClick(focusAnchor)}
        onModelError={onModelError}
        onPlacedChange={onPlacedChange}
        tapBridge={tapBridge}
      />
    </ViroARScene>
  );
};

// Drawn in the 3D scene itself, over the camera, so it's the same pale yellow
// in both themes — it never sits on one of the HUD's panels.
const arStyles = {
  tapHint: { fontFamily: fonts.sansMedium, fontSize: 10, color: "#F6DF5C", textAlign: "center", textAlignVertical: "center" },
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
  alreadyDone,
}) => {
  const { TOKEN, popup } = useAr();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const [modalMounted, setModalMounted] = useState(false);

  // One fact per model: finding model n reveals fact n, so the trivia is
  // collected piece by piece along the trail rather than read all at once.
  const modelNumber = (activeAnchor?.index ?? 0) + 1;
  const fact = triviaForModel(spot?.trivia, modelNumber - 1, spot?.name);

  useEffect(() => {
    if (visible) {
      setModalMounted(true);
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
            <Icon name="book-open" size={13} color={TOKEN.goldLight} style={{ marginRight: 6 }} />
            <Text style={popup.categoryText}>Did you know?</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close"
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
            <Icon name="map-pin" size={12} color={TOKEN.infoLight} style={{ marginRight: 5 }} />
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
              {remaining > 0
                ? alreadyDone
                  ? ` — already completed, ${remaining} more on this run`
                  : ` — ${remaining} more to finish this activity`
                : ""}
            </Text>
          </View>
        )}

        <View style={popup.divider} />

        <View style={popup.triviaBox}>
          <View style={popup.triviaIndexBadge} accessibilityLabel={`Model ${modelNumber}`}>
            <Text style={popup.triviaIndexText}>{modelNumber}</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <Text style={popup.triviaText}>{fact}</Text>
          </ScrollView>
        </View>

        <PrimaryButton title="Return to AR View" onPress={onClose} />
      </Animated.View>
    </Modal>
  );
};

const makePopup = (TOKEN) => StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: TOKEN.scrim },
  card: {
    position:             "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor:      TOKEN.sheet,
    borderTopLeftRadius:  TOKEN.radiusXl,
    borderTopRightRadius: TOKEN.radiusXl,
    paddingHorizontal:    H_PAD,
    paddingTop:           12,
    paddingBottom:        Platform.OS === "ios" ? 42 : 32,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor:          TOKEN.border,
    ...shadow.lg,
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
  // A pill, like the app's other chips. It used to be 9pt tracked capitals.
  categoryBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.goldDim,
    borderRadius:      radius.pill,
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  categoryText:    { ...typography.label, fontFamily: fonts.sansBold, color: TOKEN.goldLight },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: TOKEN.surfaceHigh,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     TOKEN.border,
  },
  // The spot's name in the display serif, as on its own page and in every
  // other sheet title in the app.
  spotTitle:   { ...typography.h2, color: TOKEN.textPrimary, marginBottom: 8 },
  anchorBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.infoDim,
    borderRadius:      radius.pill,
    paddingHorizontal: 10,
    paddingVertical:   5,
    alignSelf:         "flex-start",
    marginBottom:      10,
  },
  anchorBadgeText: { ...typography.label, color: TOKEN.infoLight },
  missionCompleteBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.successDim,
    borderRadius:      TOKEN.radiusMd,
    paddingHorizontal: 12,
    paddingVertical:   10,
    alignSelf:         "stretch",
    marginBottom:      12,
  },
  missionCompleteText: { ...typography.label, fontSize: 13, fontFamily: fonts.sansBold, color: TOKEN.success, flex: 1 },
  missionProgressBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.goldDim,
    borderRadius:      TOKEN.radiusMd,
    paddingHorizontal: 12,
    paddingVertical:   10,
    alignSelf:         "stretch",
    marginBottom:      12,
  },
  missionProgressText: { ...typography.label, fontSize: 13, color: TOKEN.goldLight, flex: 1 },
  divider:    { height: 1, backgroundColor: TOKEN.border, marginBottom: 16 },
  triviaBox: {
    flexDirection:   "row",
    backgroundColor: TOKEN.surfaceHigh,
    borderRadius:    TOKEN.radiusMd,
    padding:         TOKEN.spaceMd,
    marginBottom:    16,
    minHeight:       88,
    maxHeight:       170,
    gap:             12,
    borderWidth:     1,
    borderColor:     TOKEN.border,
  },
  triviaIndexBadge: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: TOKEN.goldDim,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
    marginTop:       1,
  },
  triviaIndexText: { fontSize: 12.5, fontFamily: fonts.sansBold, color: TOKEN.goldLight },
  triviaText:      { ...typography.body, fontSize: 15, lineHeight: 23, color: TOKEN.textPrimary, flex: 1, flexShrink: 1 },
});

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function ARScreen({ route, navigation }) {
  const { spot } = route.params;
  const { TOKEN, step, hud, main } = useAr();
  const { completeMission, completedMissions, fetchMissions, getMissionsForSpot } = useMissions();

  // The camera only delivers ~30 frames a second, but the HUD's looping
  // animations (radar sweep, ground reticle) redraw the whole window at the
  // display's rate — up to 144 Hz. 60 keeps them smooth.
  const isFocused = useIsFocused();
  usePreferredFrameRate(60, isFocused);

  // The spot's AR mission is what completion is saved against. Launching from
  // the spot page passes its id; launching from the AR picker on Home does
  // not, which meant finishing the trail from there was never recorded. Fall
  // back to looking it up from the spot's missions so every entry point saves.
  useEffect(() => { fetchMissions(spot._id); }, [spot._id, fetchMissions]);
  const arMissionId =
    route.params.arMissionId ??
    getMissionsForSpot(spot._id).find((m) => m.type === "ar")?._id ??
    null;
  // Already finished on an earlier visit. Doesn't lock anything — the trail
  // can be walked again as often as the user likes; it just isn't re-awarded.
  const alreadyDone = !!arMissionId && !!completedMissions?.includes(arMissionId);


  const [userLocation, setUserLocation] = useState(null);
  // Latest fix for saving the mission, without re-running that effect on
  // every GPS update.
  const userLocationRef = useRef(null);
  userLocationRef.current = userLocation;

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

  // The model, downloaded once and kept on the phone (utils/modelCache.js).
  // Starts as soon as the screen opens, so it's usually ready by the time
  // the traveler reaches the object. A saved copy Viro can't read is dropped
  // for the URL before the model counts as failed.
  const arModel = useCachedModel(spot.AR3DModelURL);

  // True once ARCore has found a horizontal surface and the model is actually
  // on screen. This is the difference between "tap it" being true and being a
  // lie — see the note in ModelOnPlane.
  const [modelPlaced, setModelPlaced] = useState(false);

  // ── Taps on the camera view: open the model, or refocus ─────────────────
  // A plain mutable object shared with the Viro scene; it never triggers a
  // render. The scene fills in `hitTest`, `hitNode`, `tapModel` and `placed`;
  // this screen reads them.
  const tapBridge = useMemo(() => ({
    hitTest: null, hitNode: null, tapModel: null, placed: false, lastModelTapAt: 0,
  }), []);
  const arViewRef   = useRef({ width: 0, height: 0 });
  const touchRef    = useRef(null);
  const refocusRef  = useRef({ at: 0, timer: null });
  // Drives ViroARSceneNavigator's `autofocus` — flipped off and back on to
  // force a refocus (see refocus()).
  const [autofocusOn, setAutofocusOn] = useState(true);
  const [focusPulse, setFocusPulse]   = useState(0);

  useEffect(() => () => clearTimeout(refocusRef.current.timer), []);

  // ARCore has no "focus here" — no tap-to-focus region at all. What it does
  // have is continuous AUTO focus, which meters the middle of the frame and
  // only re-hunts when it decides the scene changed. Dropping to FIXED for a
  // moment moves the lens, and restoring AUTO makes it run a fresh focus pass
  // right now. The session config is rebuilt from all of Viro's settings on
  // each change (VROARSessionARCore::updateARCoreConfig), so plane finding
  // stays as it was.
  const refocus = () => {
    const now = Date.now();
    if (now - refocusRef.current.at < REFOCUS_GAP_MS) return;
    refocusRef.current.at = now;
    buzz.tick();
    setFocusPulse((n) => n + 1);
    setAutofocusOn(false);
    clearTimeout(refocusRef.current.timer);
    refocusRef.current.timer = setTimeout(() => setAutofocusOn(true), REFOCUS_FIXED_MS);
  };

  const handleSceneTap = async (x, y) => {
    if (tapBridge.hitTest && tapBridge.tapModel) {
      const hit = await tapBridge.hitTest(x, y, arViewRef.current).catch(() => false);
      if (hit) { tapBridge.tapModel?.(); return; }
    }
    // Viro's own click may already have opened the model for this same tap.
    if (Date.now() - tapBridge.lastModelTapAt < MODEL_TAP_DEDUPE_MS) return;
    refocus();
  };

  // Observes touches on the camera view without claiming them — plain
  // onTouchStart/End, not the responder system, so Viro still receives every
  // touch for its own click handling.
  const onArTouchStart = (e) => {
    const t = e.nativeEvent;
    touchRef.current = (t.touches?.length ?? 1) > 1
      ? null                                        // pinch / two fingers: not a tap
      : { x: t.pageX, y: t.pageY, at: Date.now() };
  };
  const onArTouchEnd = (e) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.nativeEvent;
    const moved = Math.hypot(t.pageX - start.x, t.pageY - start.y);
    if (Date.now() - start.at > TAP_MAX_MS || moved > TAP_MAX_MOVE_DP) return;
    handleSceneTap(t.pageX, t.pageY);
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

  // The guide opens every time the AR activity does (the adviser asked for it
  // to always pop up — it used to show only on the first visit per install),
  // and is re-openable from "How this works".
  const [guideVisible, setGuideVisible] = useState(true);
  const dismissGuide = () => setGuideVisible(false);

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

      // Saving happens in the effect below; this is only the feel of it.
      if (!alreadyDone && next.size >= totalAnchors) buzz.complete();
      else buzz.tap();
    } else {
      buzz.tick();
    }
    setTappedAnchor(anchor);
    setTriviaVisible(true);
  };

  // ── Saving completion ─────────────────────────────────────────────────
  // An effect rather than part of the tap, because the mission id can arrive
  // AFTER the last model is found: launched from the Home AR picker on a slow
  // connection, the spot's missions may still be loading. Reacting to state
  // means the save goes through whenever both halves are finally present.
  //
  // The server only counts an AR mission done at the spot, so the save sends
  // where the phone is — and waits for a first GPS fix to have one to send.
  const allFound = totalAnchors > 0 && tappedIndices.size >= totalAnchors;
  const hasFix = !!userLocation;

  // "Are you sure?" before leaving — the top-bar arrow, Android's back button
  // and the back gesture all come through here. Leaving mid-trail loses what
  // this run has found (completion is saved only once all are found), so the
  // prompt says how far they got. No prompt where there's nothing to lose:
  // the no-model / no-ARCore screens, a location error, or a finished trail.
  const exitRef = useRef({});
  exitRef.current = {
    ask: !!spot.AR3DModelURL && arSupport !== "unsupported" && !allFound && !(locationError && !userLocation),
    found: tappedIndices.size,
    total: totalAnchors,
  };
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      const { ask, found, total } = exitRef.current;
      if (!ask) return;
      e.preventDefault();
      showAlert(
        "Leave the AR activity?",
        found > 0
          ? `You've found ${found} of ${total}. If you leave now, you'll start from the first one next time.`
          : "You can come back to it any time from the spot's page.",
        [
          { text: "Stay", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        ],
        { tone: "warning", icon: "log-out" }
      );
    });
    return unsubscribe;
  }, [navigation]);
  useEffect(() => {
    if (!allFound || !arMissionId || alreadyDone || !hasFix || missionJustCompletedRef.current) return;

    const here = userLocationRef.current;
    missionJustCompletedRef.current = true;
    setMissionJustCompleted(true);
    completeMission(arMissionId, {
      lat: here.latitude, lng: here.longitude, accuracy: here.rawAccuracy ?? here.accuracy,
    }).then((data) => {
      const saved = data?.success && !data.tooFar && !data.noLocation;
      if (saved) return;
      // Not saved (away from the spot, offline, server error): don't claim it
      // was, and let the next full run retry instead of it being lost.
      missionJustCompletedRef.current = false;
      setMissionJustCompleted(false);
      if (data?.tooFar) {
        showAlert(
          `You're not at ${spot?.name ?? "the spot"}`,
          "You found them all, but the AR mission only counts when you're at the spot itself. Finish it there to earn its points.",
          undefined,
          { tone: "warning", icon: "map-pin" }
        );
      }
    });
  }, [allFound, arMissionId, alreadyDone, hasFix, completeMission, spot?.name]);

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

  // Walk the trail again without leaving AR. Progress is already saved, so
  // this only resets what this session has collected.
  const restartTrail = () => {
    const empty = new Set();
    tappedIndicesRef.current = empty;
    setTappedIndices(empty);
    setMissionJustCompleted(false);
    announcedRef.current = null;
    buzz.tap();
  };

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
              <PrimaryButton
                title="Open Settings"
                icon="settings"
                onPress={() => Linking.openSettings().catch(() => {})}
                accessibilityLabel="Open app settings to allow location access"
                style={hud.compactBtn}
              />
            )}
            <PrimaryButton
              title="Go back"
              variant="secondary"
              onPress={() => navigation.goBack()}
              style={hud.compactBtn}
            />
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
    const allCollected = allFound;
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
          {alreadyDone && (
            <View style={step.doneChip} accessibilityLabel="You have completed this AR activity">
              <Icon name="check" size={10} color={TOKEN.success} />
              <Text style={step.doneChipText}>Completed</Text>
            </View>
          )}
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
              {alreadyDone ? " It's saved to your progress — you can walk the trail again any time." : ""}
            </Text>
            <PrimaryButton
              title="Explore again"
              icon="refresh-cw"
              onPress={restartTrail}
              accessibilityLabel="Explore this spot again"
              style={step.replayBtn}
            />
          </View>

        // ── Step 1: walk there ──────────────────────────────────────────
        ) : stepIndex === 0 ? (
          <View style={step.body}>
            {targetPending ? (
              <>
                <LiveRadar
                  distance={targetPending.distance}
                  bearing={bearingDegrees(
                    userLocation.latitude, userLocation.longitude,
                    targetPending.lat, targetPending.lng
                  )}
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
            <View style={[step.iconWrap, { backgroundColor: TOKEN.infoDim }]}>
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
              <Icon name="aperture" size={22} color={TOKEN.goldLight} />
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
  // No camera on these two, so they're ordinary app screens: the shared
  // header, empty state and button, exactly as any other screen shows a
  // "nothing here" message.
  const renderNoAR = ({ icon, title, text }) => (
    <View style={main.root}>
      <StatusBar barStyle={TOKEN.statusBar} backgroundColor={TOKEN.bg} />
      <ScreenHeader title="AR View" onBack={() => navigation.goBack()} />
      <View style={main.noArBody}>
        <EmptyState
          icon={icon}
          title={title}
          text={text}
          action={
            <PrimaryButton
              title={`Back to ${spot.name}`}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back to the spot"
              style={main.noArBtn}
            />
          }
        />
      </View>
    </View>
  );

  if (!spot.AR3DModelURL) {
    return renderNoAR({
      icon: "box",
      title: "No 3D model here yet",
      text: `${spot.name} doesn't have its AR model set up yet, so there's nothing to find here for now. The other missions at this spot still work.`,
    });
  }

  // Device can't do AR — say so plainly instead of mounting the navigator and
  // leaving the user on a black screen wondering what broke.
  if (arSupport === "unsupported") {
    return renderNoAR({
      icon: "camera-off",
      title: "AR isn't available on this phone",
      text: `This mission needs ARCore, which this device doesn't support. You can still visit ${spot.name} and complete the other missions there.`,
    });
  }

  return (
    <View style={main.root}>
      <StatusBar barStyle={TOKEN.statusBar} backgroundColor="transparent" translucent />

      {/* Watches taps on the camera view (see onArTouchStart). The HUD and
          buttons are siblings drawn on top, so their taps never land here. */}
      <View
        style={main.arView}
        onLayout={(e) => { arViewRef.current = e.nativeEvent.layout; }}
        onTouchStart={onArTouchStart}
        onTouchEnd={onArTouchEnd}
        onTouchCancel={() => { touchRef.current = null; }}
      >
      <ViroARSceneNavigator
        initialScene={{ scene: ARScene }}
        // Viro turns all of these on by default, at full-screen size, 30
        // times a second, on top of the camera and ARCore — the AR screen's
        // heat. HDR rendered every frame into 16-bit float buffers, copied
        // depth and ran a tone-mapping pass (the lights in ModelOnPlane make
        // up its look); bloom added two more float attachments; shadows were
        // a shadow map nothing received; and 4× multisampling only ever
        // applied to the tone-mapping pass, not the model, so it smoothed
        // nothing.
        hdrEnabled={false}
        bloomEnabled={false}
        shadowsEnabled={false}
        multisamplingEnabled={false}
        // ARCore's default is FIXED focus, set near the hyperfocal distance for
        // tracking far surfaces, so anything within a couple of metres (a
        // plaque, a statue, the ground the model stands on) is soft. `autofocus`
        // switches the session to continuous AUTO focus; Viro wires it through
        // to ArConfig_setFocusMode on Android and the ARKit session on iOS.
        // It's only ever false for a moment, during a tap-to-refocus.
        autofocus={autofocusOn}
        viroAppProps={{
          spot,
          modelUri:         arModel.uri,
          focusAnchor,
          onModelClick:     handleModelClick,
          onTrackingChange: setArTracking,
          onModelError:     () => { if (!arModel.onLocalError()) setModelFailed(true); },
          onPlacedChange:   setModelPlaced,
          tapBridge,
        }}
        style={{ flex: 1 }}
      />
      </View>

      {/* Tap anywhere that isn't the model → the camera refocuses. */}
      <FocusRing pulse={focusPulse} />

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
          <Icon name="chevron-left" size={22} color={TOKEN.textPrimary} />
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
        alreadyDone={alreadyDone}
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
const makeStep = (TOKEN) => StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", gap: 8 },
  spotName:    { ...typography.title, fontSize: 14.5, fontFamily: fonts.sansBold, flex: 1, color: TOKEN.textPrimary },
  count:       { ...typography.label, fontSize: 12.5, color: TOKEN.textSecond },
  doneChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: TOKEN.successDim,
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3,
  },
  doneChipText: { ...typography.caption, fontFamily: fonts.sansBold, color: TOKEN.success },
  // The app's yellow button (components/ui.js PrimaryButton), sized down a
  // little to sit inside the card.
  replayBtn: { minHeight: 46, alignSelf: "center", marginTop: 6 },
  // Plain words where three unlabeled bars used to be.
  stepLine:    { ...typography.caption, fontFamily: fonts.sansSemi, color: TOKEN.textMuted, textAlign: "center" },

  body:     { alignItems: "center", gap: 6, paddingTop: 6, paddingBottom: 2 },
  iconWrap: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  title: { ...typography.h3, fontSize: 18, lineHeight: 23, color: TOKEN.textPrimary, textAlign: "center" },
  sub:   { ...typography.body, fontSize: 13.5, lineHeight: 20, color: TOKEN.textSecond, textAlign: "center", paddingHorizontal: 4 },


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
    borderWidth: 1.5, borderColor: TOKEN.infoDash,
    borderStyle: "dashed",
  },
  reticleArrowWrap: { position: "absolute" },
});

// ─────────────────────────────────────────────
// HUD STYLES
// ─────────────────────────────────────────────
const makeHud = (TOKEN) => StyleSheet.create({
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
    ...floatShadow,
  },
  errorContainer:  { borderColor: TOKEN.danger, backgroundColor: TOKEN.errorSurface },
  errorRow:        { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  errorIconWrap:   {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: TOKEN.dangerDim,
    alignItems:      "center",
    justifyContent:  "center",
  },
  errorTitle:   { ...typography.title, fontFamily: fonts.sansBold, color: TOKEN.textPrimary, marginBottom: 3 },
  errorMsg:     { ...typography.body, fontSize: 13.5, lineHeight: 20, color: TOKEN.textSecond },
  errorActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  // The app's buttons (PrimaryButton, primary and secondary), side by side.
  compactBtn:   { flex: 1, minHeight: 46, paddingHorizontal: 12 },
  loadingRow:   { flexDirection: "row", alignItems: "center" },
  loadingText:  { ...typography.bodyStrong, color: TOKEN.textSecond },
  loadingHint:  { ...typography.caption, fontFamily: fonts.sans, color: TOKEN.textMuted, marginTop: 2 },
});

// ─────────────────────────────────────────────
// MAIN STYLES
// ─────────────────────────────────────────────
const makeMain = (TOKEN) => StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKEN.bg },
  // Not opaque — the camera stays visible so the phone doesn't feel broken,
  // just clearly backgrounded while walking is the job.
  arView:      { flex: 1 },
  travelScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: TOKEN.travelScrim },
  topBar: {
    position:       "absolute",
    top:            Platform.OS === "ios" ? 54 : 36,
    left: 16, right: 16,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    zIndex:         100,
  },
  // The round back button the spot page has (InformationScreen CircleBtn).
  iconBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: TOKEN.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     TOKEN.borderAccent,
    ...floatShadow,
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  // ── No model / no AR on this phone ──
  noArBody: { flex: 1, justifyContent: "center", paddingHorizontal: H_PAD, paddingBottom: 60 },
  noArBtn:  { alignSelf: "stretch", marginTop: 8 },
  // A labelled button, not a bare "?" glyph — the one control on this
  // screen a first-time user most needs to find is the explanation.
  helpBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: TOKEN.surface,
    borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 40,
    borderWidth: 1, borderColor: TOKEN.borderAccent,
    ...floatShadow,
  },
  helpBtnText: { ...typography.label, fontSize: 13, color: TOKEN.textPrimary },
});