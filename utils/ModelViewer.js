import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import {
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";

import Icon from "../components/Icon";
import { useTheme, lightColors, darkColors, fonts } from "../context/ThemeContext";
import { fetchModelBounds, fitBounds } from "./modelFit";
import {
  Viro3DSceneNavigator,
  ViroScene,
  ViroAmbientLight,
  ViroDirectionalLight,
  Viro3DObject,
  ViroNode,
  ViroSphere,
  ViroMaterials,
} from "@reactvision/react-viro";


const VIEW_DISTANCE     = -20;
// Every model is scaled so its bounding sphere has this radius. 4.6 is what the
// typical (~24-unit) spot model measured at the old fixed 0.25 scale, so those
// look as they did and the outliers are brought in line with them.
const MODEL_RADIUS      = 4.6;
// Only used when a model's bounds can't be read: the old fixed transform.
const FALLBACK_FIT      = { scale: 0.25, offset: [0, -1.5, 0] };

const SENSITIVITY       = 0.3;        // degrees per pixel dragged
const INERTIA           = 0.92;       // share of fling velocity kept per 60 Hz frame
const INERTIA_MIN       = 0.05;
const FRAME_MS          = 1000 / 60;
const AUTO_ROTATE_DEG_S = 30;         // what the old 0.5°-per-frame gave at 60 Hz
const AUTO_RESUME_MS    = 2500;       // idle time after a gesture before spinning again
const RESET_MS          = 650;
const ZOOM_MIN          = 0.3;
const ZOOM_MAX          = 4;
const TILT_LIMIT        = 70;

const DEFAULT_ROT_X = 0;
const DEFAULT_ROT_Y = -55;

// The backdrop is the theme's card colour, so the viewer sits in the hero card
// the way the photo does instead of as a white box in dark mode.
ViroMaterials.createMaterials({
  viewerBackdropLight: { diffuseColor: lightColors.card, lightingModel: "Constant" },
  viewerBackdropDark:  { diffuseColor: darkColors.card,  lightingModel: "Constant" },
});

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
// Signed difference folded into [-180, 180).
const wrap180 = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

// ─────────────────────────────────────────────
// 3D Scene
// ─────────────────────────────────────────────
const ModelScene = ({ sceneNavigator }) => {
  const {
    modelUrl,
    fit,
    pivotRef,
    isDark,
    baseRotX,
    baseRotY,
    onModelReady,
    onModelError,
  } = sceneNavigator.viroAppProps;

  return (
    <ViroScene>
      <ViroSphere
        position={[0, 0, 0]}
        radius={100}
        facesOutward={false}
        materials={[isDark ? "viewerBackdropDark" : "viewerBackdropLight"]}
      />

      <ViroDirectionalLight color="#ffffff" direction={[-0.5, -0.8, -0.5]} intensity={700} />
      <ViroDirectionalLight color="#e8eeff" direction={[1, -0.3, -0.5]}   intensity={400} />
      <ViroDirectionalLight color="#ffffff" direction={[0, 0.5, 1]}       intensity={350} />
      <ViroAmbientLight     color="#ffffff" intensity={300} />

      {/* The node is the turntable — drag, spin and zoom all act on it, about
          the model's centre. The object inside only carries its own fit, so
          it mounts once that's known (the scene itself starts up meanwhile). */}
      {fit && (
        <ViroNode ref={pivotRef} position={[0, 0, VIEW_DISTANCE]} rotation={[baseRotX, baseRotY, 0]}>
          <Viro3DObject
            source={{ uri: modelUrl }}
            position={fit.offset}
            scale={[fit.scale, fit.scale, fit.scale]}
            type="GLB"
            onLoadEnd={() => onModelReady?.()}
            onError={() => onModelError?.()}
          />
        </ViroNode>
      )}
    </ViroScene>
  );
};

// ─────────────────────────────────────────────
// Model Viewer
//
// Props:
//   url       {string}  — GLB model URI (required)
//   style     {object}  — extra container styles
//   baseRotX  {number}  — resting X tilt in degrees (default: 0)
//   baseRotY  {number}  — resting Y turn in degrees (default: -55)
// ─────────────────────────────────────────────
export default function ModelViewer({
  url,
  style,
  baseRotX = DEFAULT_ROT_X,
  baseRotY = DEFAULT_ROT_Y,
}) {
  const { colors, isDark } = useTheme();
  const [fit, setFit]         = useState(null);   // null until the model's bounds are read
  const [loaded, setLoaded]   = useState(false);
  const [error, setError]     = useState(false);
  const [attempt, setAttempt] = useState(0);

  const pivotRef = useRef(null);
  const rotX     = useRef(baseRotX);
  const rotY     = useRef(baseRotY);
  const zoom     = useRef(1);
  const velX     = useRef(0);
  const velY     = useRef(0);
  const panStart   = useRef([0, 0]);
  const pinchStart = useRef(1);

  // One animation runs at a time: the spin, a fling's inertia, or a reset.
  const frame       = useRef(null);
  const resumeTimer = useRef(null);

  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    cancelAnimationFrame(frame.current);
    clearTimeout(resumeTimer.current);
    setFit(null);
    setLoaded(false);
    setError(false);
    rotX.current = baseRotX;
    rotY.current = baseRotY;
    zoom.current = 1;
    fetchModelBounds(url).then((bounds) => {
      if (live) setFit(fitBounds(bounds, MODEL_RADIUS) || FALLBACK_FIT);
    });
    return () => { live = false; };
  }, [url, attempt, baseRotX, baseRotY]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    clearTimeout(resumeTimer.current);
  }, []);

  const applyTransform = () => {
    try {
      pivotRef.current?.setNativeProps({
        rotation: [rotX.current, rotY.current, 0],
        scale: [zoom.current, zoom.current, zoom.current],
      });
    } catch (_) {}
  };

  const stopMotion = () => {
    cancelAnimationFrame(frame.current);
    clearTimeout(resumeTimer.current);
  };

  // Calls step(frames) every animation frame, where `frames` is the time since
  // the last one counted in 60 Hz frames, so speeds match on 60/90/120 Hz
  // screens. When step returns false the loop ends and onDone runs.
  const animate = (step, onDone) => {
    stopMotion();
    let prev = null;
    const tick = (now) => {
      const frames = prev == null ? 1 : clamp((now - prev) / FRAME_MS, 0, 4);
      prev = now;
      const more = step(frames);
      applyTransform();
      if (more) frame.current = requestAnimationFrame(tick);
      else onDone?.();
    };
    frame.current = requestAnimationFrame(tick);
  };

  const startSpin = () => animate((frames) => {
    rotY.current += (AUTO_ROTATE_DEG_S / 60) * frames;
    return true;
  });

  const resumeSpinLater = () => {
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(startSpin, AUTO_RESUME_MS);
  };

  const startInertia = () => animate((frames) => {
    const keep = Math.pow(INERTIA, frames);
    velX.current *= keep;
    velY.current *= keep;
    rotX.current = clamp(rotX.current + velX.current * frames, -TILT_LIMIT, TILT_LIMIT);
    rotY.current += velY.current * frames;
    return Math.abs(velX.current) >= INERTIA_MIN || Math.abs(velY.current) >= INERTIA_MIN;
  }, resumeSpinLater);

  const reset = () => {
    // Unwind the spin the short way round, not every lap it has made.
    rotY.current = baseRotY + wrap180(rotY.current - baseRotY);
    const from = [rotX.current, rotY.current, zoom.current];
    let elapsed = 0;
    animate((frames) => {
      elapsed += frames * FRAME_MS;
      const t = Math.min(elapsed / RESET_MS, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      rotX.current = from[0] + (baseRotX - from[0]) * ease;
      rotY.current = from[1] + (baseRotY - from[1]) * ease;
      zoom.current = from[2] + (1 - from[2]) * ease;
      return t < 1;
    }, startSpin);
  };

  const zoomBy = (factor) => {
    zoom.current = clamp(zoom.current * factor, ZOOM_MIN, ZOOM_MAX);
    applyTransform();
  };

  const onModelReady = () => {
    setLoaded(true);
    startSpin();
  };

  const onModelError = () => {
    stopMotion();
    setError(true);
  };

  // onStart (not onBegin) so a plain tap doesn't stop the spin for good.
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(5)
    .onStart(() => {
      stopMotion();
      panStart.current = [rotX.current, rotY.current];
    })
    .onUpdate((e) => {
      rotX.current = clamp(panStart.current[0] + e.translationY * SENSITIVITY, -TILT_LIMIT, TILT_LIMIT);
      rotY.current = panStart.current[1] + e.translationX * SENSITIVITY;
      velX.current = e.velocityY * 0.01;
      velY.current = e.velocityX * 0.01;
      applyTransform();
    })
    .onEnd(() => startInertia());

  // Pinch zoom stays where the user leaves it, like the +/- buttons; only the
  // reset button returns to the default size.
  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      stopMotion();
      pinchStart.current = zoom.current;
    })
    .onUpdate((e) => {
      zoom.current = clamp(pinchStart.current * e.scale, ZOOM_MIN, ZOOM_MAX);
      applyTransform();
    })
    .onEnd(() => resumeSpinLater());

  const gesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const surface = { backgroundColor: colors.card };
  const buttonTone = { backgroundColor: colors.background, borderColor: colors.cardBorder };

  if (!url || error) {
    return (
      <View style={[styles.wrapper, surface, style, styles.center]}>
        <Icon name="cube-scan" size={26} color={colors.textMuted} />
        <Text style={[styles.message, { color: colors.textMuted }]}>
          {url ? "Couldn't load the 3D model" : "No 3D model for this spot"}
        </Text>
        {!!url && (
          <TouchableOpacity
            style={[styles.retryBtn, buttonTone]}
            onPress={() => setAttempt((n) => n + 1)}
            accessibilityRole="button"
          >
            <Text style={[styles.retryText, { color: colors.brandDark }]}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, surface, style]}>
      <Viro3DSceneNavigator
        key={attempt}
        initialScene={{ scene: ModelScene }}
        viroAppProps={{ modelUrl: url, fit, pivotRef, isDark, baseRotX, baseRotY, onModelReady, onModelError }}
        style={StyleSheet.absoluteFill}
        onError={onModelError}
      />

      {!loaded && (
        <View style={[StyleSheet.absoluteFill, styles.center, surface]}>
          <ActivityIndicator color={colors.brand} />
          <Text style={[styles.message, { color: colors.textMuted }]}>Loading 3D model…</Text>
        </View>
      )}

      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      <View style={styles.zoomButtons} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.iconBtn, buttonTone]}
          onPress={() => zoomBy(1.3)}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          hitSlop={4}
        >
          <Icon name="plus" size={18} color={colors.brandDark} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, buttonTone]}
          onPress={() => zoomBy(1 / 1.3)}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          hitSlop={4}
        >
          <Icon name="minus" size={18} color={colors.brandDark} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.iconBtn, styles.resetBtn, buttonTone]}
        onPress={reset}
        accessibilityRole="button"
        accessibilityLabel="Reset view"
        hitSlop={4}
      >
        <Icon name="rotate-3d-variant" size={18} color={colors.brandDark} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    overflow: "hidden",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  message: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  retryText: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
  },
  // Vertically centred, and clear of the caption scrim along the bottom.
  zoomButtons: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  resetBtn: {
    position: "absolute",
    top: 12,
    right: 12,
  },
});
