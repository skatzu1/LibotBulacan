import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "react-native";
import Geolocation from "@react-native-community/geolocation";
import { Feather } from "@expo/vector-icons";
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
const TOKEN = {
  bg:           "#2e1c1a",
  surface:      "#3d2422",
  surfaceHigh:  "#4a2e2c",
  surfaceMid:   "#5a3a38",
  border:       "rgba(196,164,159,0.2)",
  borderAccent: "rgba(196,164,159,0.45)",
  textPrimary:  "#faf5f4",
  textSecond:   "#c4a49f",
  textMuted:    "#8b6f6c",
  gold:         "#c4a49f",
  goldLight:    "#dbbcb7",
  goldDim:      "rgba(107,75,69,0.45)",
  success:      "#6b9e6b",
  successDim:   "rgba(107,158,107,0.2)",
  warn:         "#c8956a",
  danger:       "#c0392b",
  dangerDim:    "rgba(192,57,43,0.2)",
  info:         "#6b4b45",
  infoLight:    "#c4a49f",
  cta:          "#6b4b45",
  ctaLight:     "#8b6560",
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
    if (distTrend === "closer")  return { text: `${dist} m`, icon: "trending-down", color: TOKEN.success  };
    if (distTrend === "farther") return { text: `${dist} m`, icon: "trending-up",   color: TOKEN.danger   };
    return                              { text: `${dist} m`, icon: "navigation",     color: TOKEN.infoLight };
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
    backgroundColor:   "rgba(46,28,26,0.90)",
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
    borderColor:       "rgba(196,164,159,0.4)",
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
    backgroundColor: "rgba(46,28,26,0.90)",
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
    backgroundColor:   "rgba(46,28,26,0.90)",
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
    backgroundColor: "rgba(46,28,26,0.90)",
    borderRadius:    TOKEN.radiusMd,
    padding:         10,
    borderWidth:     1,
    borderColor:     "rgba(107,158,107,0.4)",
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
  const { spot, activeAnchors, tappedIndices, onModelClick } = sceneNavigator.viroAppProps;

  if (!activeAnchors || activeAnchors.length === 0) {
    const anchorCount = spot.modelsCoordinates?.length ?? 0;
    return (
      <ViroARScene>
        <ViroText
          text={
            anchorCount > 1
              ? `Walk closer to one of the\n${anchorCount} AR zones around "${spot.name}"`
              : `Walk closer to\n"${spot.name}"\nto see the AR model`
          }
          position={[0, 0, -2]}
          scale={[0.38, 0.38, 0.38]}
          style={arStyles.outOfRange}
        />
      </ViroARScene>
    );
  }

  return (
    <ViroARScene>
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
  tapHint:     { fontFamily: "Arial", fontSize: 10, color: "#dbbcb7", textAlign: "center", textAlignVertical: "center" },
  tapHintDone: { fontFamily: "Arial", fontSize: 10, color: "#6b9e6b", textAlign: "center", textAlignVertical: "center" },
  scanning:    { fontFamily: "Arial", fontSize: 11, color: "#c8956a", textAlign: "center", textAlignVertical: "center" },
  outOfRange:  { fontFamily: "Arial", fontSize: 12, color: "#c4a49f", textAlign: "center", textAlignVertical: "center" },
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
          <Feather name="arrow-left" size={15} color="#fff" style={{ marginRight: 8 }} />
          <Text style={popup.doneBtnText}>Return to AR View</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const popup = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(30,12,10,0.70)" },
  card: {
    position:             "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor:      "#3d2422",
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
    borderColor:       "rgba(196,164,159,0.3)",
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
    borderColor:       "rgba(107,75,69,0.5)",
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
    borderColor:       "rgba(107,158,107,0.3)",
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
    borderColor:       "rgba(196,164,159,0.25)",
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
    borderColor:     "rgba(196,164,159,0.35)",
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
  doneBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
});

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function ARScreen({ route, navigation }) {
  const { spot, arMissionId } = route.params;
  const { completeMission, completedMissions } = useMissions();

  // Tilt-aware, real-time compass heading
  const compassHeading = useCompassHeading();

  const [anchorProximities, setAnchorProximities] = useState([]);
  const [userLocation, setUserLocation]           = useState(null);
  const [locationError, setLocationError]         = useState(null);

  const [triviaVisible, setTriviaVisible] = useState(false);
  const [tappedAnchor, setTappedAnchor]   = useState(null);

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
    const startWatch = () => {
      watchId.current = Geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          setUserLocation({ latitude, longitude, accuracy });
          setAnchorProximities(computeAnchorProximities(spot, latitude, longitude));
          setLocationError(null);
        },
        (err) => setLocationError(err.message),
        {
          enableHighAccuracy: true,
          distanceFilter:     0,
          interval:           1000,
          fastestInterval:    500,
          maximumAge:         0,
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
      startWatch();
    };

    init();
    return () => { if (watchId.current != null) Geolocation.clearWatch(watchId.current); };
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
      }
    }
    setTappedAnchor(anchor);
    setTriviaVisible(true);
  };

  const activeAnchors  = anchorProximities.filter((a) => a.isInRange);
  const anyActive      = activeAnchors.length > 0;
  const nearestPending = anchorProximities.find((a) => !a.isInRange);

  // ── HUD ──────────────────────────────────────────────────────────────
  const renderHUD = () => {
    if (locationError) {
      return (
        <Animated.View style={[hud.container, hud.errorContainer, { opacity: hudOpacity }]}>
          <View style={hud.errorRow}>
            <View style={hud.errorIconWrap}>
              <Feather name="alert-triangle" size={14} color={TOKEN.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={hud.errorTitle}>Location Error</Text>
              <Text style={hud.errorMsg}>{locationError}</Text>
            </View>
          </View>
        </Animated.View>
      );
    }

    if (!userLocation) {
      return (
        <Animated.View style={[hud.container, { opacity: hudOpacity }]}>
          <View style={hud.loadingRow}>
            <ActivityIndicator size="small" color={TOKEN.goldLight} style={{ marginRight: 10 }} />
            <Text style={hud.loadingText}>Acquiring GPS signal…</Text>
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={[hud.container, { opacity: hudOpacity }]}>
        <View style={hud.spotRow}>
          <View style={[hud.spotDot, anyActive && hud.spotDotActive]} />
          <Text style={hud.spotName} numberOfLines={1}>{spot.name}</Text>
          <View style={hud.gpsChip}>
            <Feather
              name="crosshair"
              size={9}
              color={userLocation.accuracy < 10 ? TOKEN.success : TOKEN.warn}
              style={{ marginRight: 3 }}
            />
            <Text style={[hud.gpsChipText, { color: userLocation.accuracy < 10 ? TOKEN.success : TOKEN.warn }]}>
              ±{Math.round(userLocation.accuracy ?? 0)} m
            </Text>
          </View>
        </View>

        {totalAnchors > 1 && (
          <View style={hud.anchorCountRow}>
            <View style={[hud.anchorCountBadge, anyActive && hud.anchorCountBadgeActive]}>
              <Feather
                name="map-pin"
                size={10}
                color={anyActive ? TOKEN.success : TOKEN.textMuted}
                style={{ marginRight: 5 }}
              />
              <Text style={[hud.anchorCountText, anyActive && hud.anchorCountTextActive]}>
                {activeAnchors.length} / {totalAnchors} zones active
              </Text>
            </View>
            <View style={hud.tapProgressBadge}>
              <Feather
                name="aperture"
                size={10}
                color={tappedIndices.size >= totalAnchors ? TOKEN.success : TOKEN.goldLight}
                style={{ marginRight: 5 }}
              />
              <Text style={[
                hud.anchorCountText,
                tappedIndices.size >= totalAnchors && hud.anchorCountTextActive,
                tappedIndices.size > 0 && tappedIndices.size < totalAnchors && { color: TOKEN.goldLight },
              ]}>
                {tappedIndices.size} / {totalAnchors} tapped
              </Text>
            </View>
          </View>
        )}

        <View style={hud.divider} />

        {anyActive ? (
          <View style={hud.insideRow}>
            <View style={hud.insideBadge}>
              <Feather name="check-circle" size={13} color={TOKEN.success} style={{ marginRight: 6 }} />
              <Text style={hud.insideBadgeText}>AR ZONE ACTIVE</Text>
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

            <View style={hud.instructionRow}>
              <Feather name="aperture" size={11} color={TOKEN.goldLight} style={{ marginRight: 5 }} />
              <Text style={[hud.instruction, hud.instructionActive]}>
                Point camera at a flat surface · tap model to learn more
              </Text>
            </View>
          </View>
        ) : (
          (() => {
            if (!nearestPending) return null;
            const metersToEdge = Math.max(0, Math.round(nearestPending.distance - nearestPending.radius));
            const progressPct  = Math.min(
              100,
              Math.max(0, (1 - metersToEdge / (nearestPending.radius * 5)) * 100)
            );
            return (
              <View style={hud.outsideWrap}>
                {totalAnchors > 1 && (
                  <Text style={hud.nearestLabel}>
                    Nearest:{" "}
                    <Text style={{ color: TOKEN.goldLight }}>{nearestPending.label}</Text>
                  </Text>
                )}
                <View style={hud.distanceRow}>
                  <Feather name="navigation" size={14} color={TOKEN.infoLight} style={{ marginRight: 8 }} />
                  <Text style={hud.distanceBig}>{metersToEdge}</Text>
                  <Text style={hud.distanceUnit}> m to object zone</Text>
                </View>
                <View style={hud.progressTrack}>
                  <View style={[hud.progressFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={hud.distanceHint}>
                  {metersToEdge > nearestPending.radius * 3
                    ? "Walk toward the landmark to activate AR"
                    : metersToEdge > nearestPending.radius
                    ? "Getting closer — keep walking"
                    : "Almost there! You're at the edge of the object zone"}
                </Text>
              </View>
            );
          })()
        )}
      </Animated.View>
    );
  };

  return (
    <View style={main.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ViroARSceneNavigator
        initialScene={{ scene: ARScene }}
        viroAppProps={{ spot, activeAnchors, tappedIndices, onModelClick: handleModelClick }}
        style={{ flex: 1 }}
      />

      {/* ── Top bar ── */}
      <View style={main.topBar}>
        <TouchableOpacity
          style={main.iconBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={18} color={TOKEN.textPrimary} />
        </TouchableOpacity>
        <View style={main.topLabel}>
          <Feather name="layers" size={12} color={TOKEN.goldLight} style={{ marginRight: 5 }} />
          <Text style={main.topLabelText}>AR EXPLORER</Text>
        </View>
        <View style={[main.iconBtn, { backgroundColor: "transparent", borderColor: "transparent" }]} />
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
    backgroundColor: "rgba(46,28,26,0.88)",
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
  errorContainer:  { borderColor: "rgba(192,57,43,0.5)", backgroundColor: "rgba(192,57,43,0.20)" },
  errorRow:        { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  errorIconWrap:   {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: TOKEN.dangerDim,
    alignItems:      "center",
    justifyContent:  "center",
  },
  errorTitle:   { color: TOKEN.danger,    fontSize: 12, fontWeight: "700", marginBottom: 2 },
  errorMsg:     { color: "#e8a0a0",        fontSize: 12, lineHeight: 17 },
  loadingRow:   { flexDirection: "row", alignItems: "center" },
  loadingText:  { color: TOKEN.textSecond, fontSize: 13 },
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
  anchorCountRow:         { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  anchorCountBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.surfaceHigh,
    borderRadius:      TOKEN.radiusSm,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       TOKEN.border,
  },
  anchorCountBadgeActive: { borderColor: "rgba(107,158,107,0.4)", backgroundColor: TOKEN.successDim },
  tapProgressBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   TOKEN.surfaceHigh,
    borderRadius:      TOKEN.radiusSm,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       TOKEN.goldDim,
  },
  anchorCountText:        { color: TOKEN.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  anchorCountTextActive:  { color: TOKEN.success },
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
    borderColor:       "rgba(107,158,107,0.3)",
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
    borderColor:       "rgba(107,158,107,0.3)",
  },
  activeLabelPillDone: { backgroundColor: TOKEN.goldDim, borderColor: "rgba(196,164,159,0.3)" },
  activeLabelText:     { color: TOKEN.success, fontSize: 10, fontWeight: "600" },
  instructionRow:      { flexDirection: "row", alignItems: "center" },
  instruction:         { color: TOKEN.textSecond, fontSize: 11, lineHeight: 16, flex: 1 },
  instructionActive:   { color: TOKEN.goldLight },
  outsideWrap:         { gap: 7 },
  nearestLabel:        { color: TOKEN.textSecond, fontSize: 11, fontWeight: "500" },
  distanceRow:         { flexDirection: "row", alignItems: "baseline" },
  distanceBig:         { color: TOKEN.textPrimary, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  distanceUnit:        { color: TOKEN.textSecond, fontSize: 13, fontWeight: "500" },
  progressTrack:       { height: 3, backgroundColor: TOKEN.border, borderRadius: 2, overflow: "hidden" },
  progressFill:        { height: "100%", backgroundColor: TOKEN.cta, borderRadius: 2 },
  distanceHint:        { color: TOKEN.textMuted, fontSize: 11, fontWeight: "500", letterSpacing: 0.2 },
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
    backgroundColor: "rgba(46,28,26,0.85)",
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
  topLabel: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "rgba(46,28,26,0.85)",
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderWidth:       1,
    borderColor:       TOKEN.borderAccent,
  },
  topLabelText: { color: TOKEN.textSecond, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
});