import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import {
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";

import Icon from "../components/Icon";
import { useTheme, lightColors, darkColors, fonts } from "../context/ThemeContext";
import { usePreferredFrameRate } from "../modules/frame-rate";
import { fetchModelBounds, fitBounds } from "./modelFit";
import {
  Viro3DSceneNavigator,
  ViroScene,
  ViroCamera,
  ViroAmbientLight,
  ViroDirectionalLight,
  Viro3DObject,
  ViroSphere,
  ViroMaterials,
} from "@reactvision/react-viro";


const VIEW_DISTANCE     = -20;
// Set explicitly: Viro's own default is an unexposed renderer value, and the
// framing below is worked out against this. Degrees, across the card's width.
const FIELD_OF_VIEW     = 60;
// Every model is scaled so its bounding sphere has this radius: at 20 units
// with a 60° view that spans ~60% of the card's width, leaving the zoom
// buttons clear at any angle.
const MODEL_RADIUS      = 6.7;
// Only used when a model's bounds can't be read: the old fixed transform
// (scale 0.25, lowered 1.5, tuned for a radius of 4.6), resized to match.
const FALLBACK_FIT      = { scale: 0.25 * (MODEL_RADIUS / 4.6), offset: [0, -1.5 * (MODEL_RADIUS / 4.6), 0] };

const SENSITIVITY       = 0.3;        // degrees per pixel dragged
const INERTIA           = 0.92;       // share of fling velocity kept per 60 Hz frame
const INERTIA_MIN       = 0.05;
const FRAME_MS          = 1000 / 60;
const APPLY_INTERVAL_MS = FRAME_MS - 2;   // ~60 native updates a second, at most
const AUTO_ROTATE_DEG_S = 30;         // what the old 0.5°-per-frame gave at 60 Hz
const AUTO_RESUME_MS    = 2500;       // idle time after a gesture before spinning again
const RESET_MS          = 650;
const ZOOM_MIN          = 0.3;
const ZOOM_MAX          = 2.5;        // 6.7 × 2.5 stays short of the camera at 20
const TILT_LIMIT        = 70;

// The camera looks down on the model from 15° above, so the model itself only
// ever spins about its own vertical axis — one Viro3DObject, one rotation.
const CAMERA_PITCH  = 15;
const CAMERA_HEIGHT = -VIEW_DISTANCE * Math.tan((CAMERA_PITCH * Math.PI) / 180);

// The spot models all have their facade on +Z (see modelFit.js), so one pose
// fits them all: facade turned 35° to the right.
const DEFAULT_ROT_X = 0;
const DEFAULT_ROT_Y = 35;

// Viro draws a frame on every display refresh, moving or not; this phone class
// refreshes at up to 144 Hz. 60 is smooth for a turning model.
const FRAME_RATE = 60;

// Ambient light. Viro's HDR pipeline is off (see the navigator below), and its
// tone curve used to lift shadows and mid-tones; this much more ambient gives
// back the same look (≈6/255 RMS against the old tone-mapped output, fitted
// over the four lights and typical facade colours).
const AMBIENT = 408;

// The backdrop is the theme's card colour, so the viewer sits in the hero card
// the way the photo does instead of as a white box in dark mode.
ViroMaterials.createMaterials({
  viewerBackdropLight: { diffuseColor: lightColors.card, lightingModel: "Constant" },
  viewerBackdropDark:  { diffuseColor: darkColors.card,  lightingModel: "Constant" },
});

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
// Signed difference folded into [-180, 180).
const wrap180 = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

// Where the model goes at a given zoom: scaled by fit × zoom, and moved so its
// centre stays on the same spot as it grows or shrinks.
const placement = (fit, zoom) => {
  const s = fit.scale * zoom;
  const [x, y, z] = fit.offset;
  return { scale: [s, s, s], position: [x * zoom, y * zoom, VIEW_DISTANCE + z * zoom] };
};

// ─────────────────────────────────────────────
// 3D Scene
//
// The camera and the model are only added once the scene reports the platform
// is up (onPlatformUpdate). Anything that has child nodes — a ViroCamera makes
// one internally — runs a native bounds update when it's created, and that
// needs the JavaVM handle Viro only gets when its renderer is created. React
// builds the scene's first render *before* the navigator (children first), so
// a camera there crashes the app (SIGSEGV, "sVM != nullptr" in Viro's
// VROPlatformUtil). The navigator calls onPlatformUpdate from its own
// addView, i.e. once it — and the handle — exists; after that it's safe.
// ─────────────────────────────────────────────
const ModelScene = ({ sceneNavigator }) => {
  const {
    modelUrl,
    fit,
    sceneReady,
    objectRef,
    isDark,
    baseRotX,
    baseRotY,
    onSceneReady,
    onModelReady,
    onModelError,
  } = sceneNavigator.viroAppProps;
  const showModel = sceneReady && !!fit;
  const { scale, position } = showModel ? placement(fit, 1) : {};

  return (
    <ViroScene onPlatformUpdate={() => onSceneReady?.()}>
      {sceneReady && (
        <ViroCamera
          position={[0, CAMERA_HEIGHT, 0]}
          rotation={[-CAMERA_PITCH, 0, 0]}
          active
          fieldOfView={FIELD_OF_VIEW}
        />
      )}

      <ViroSphere
        position={[0, 0, 0]}
        radius={100}
        facesOutward={false}
        materials={[isDark ? "viewerBackdropDark" : "viewerBackdropLight"]}
      />

      <ViroDirectionalLight color="#ffffff" direction={[-0.5, -0.8, -0.5]} intensity={700} />
      <ViroDirectionalLight color="#e8eeff" direction={[1, -0.3, -0.5]}   intensity={400} />
      <ViroDirectionalLight color="#ffffff" direction={[0, 0.5, 1]}       intensity={350} />
      <ViroAmbientLight     color="#ffffff" intensity={AMBIENT} />

      {showModel && (
        <Viro3DObject
          ref={objectRef}
          source={{ uri: modelUrl }}
          position={position}
          scale={scale}
          rotation={[baseRotX, baseRotY, 0]}
          type="GLB"
          onLoadEnd={() => onModelReady?.()}
          onError={() => onModelError?.()}
        />
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
//   baseRotX  {number}  — resting X rotation, degrees (default: 0; the camera
//                          already looks down 15°)
//   baseRotY  {number}  — resting turn, degrees (default: 35)
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
  // True once the Viro scene is running; see ModelScene for why it matters.
  const [sceneReady, setSceneReady] = useState(false);

  const objectRef  = useRef(null);
  const fitRef     = useRef(null);
  const rotX       = useRef(baseRotX);
  const rotY       = useRef(baseRotY);
  const zoom       = useRef(1);
  const velX       = useRef(0);
  const velY       = useRef(0);
  const panStart   = useRef([0, 0]);
  const pinchStart = useRef(1);

  // One animation runs at a time: the spin, a fling's inertia, or a reset.
  const frame       = useRef(null);
  const resumeTimer = useRef(null);

  // What's waiting to be pushed to Viro, and when it last was (see flush).
  const pending    = useRef({ rotation: false, zoom: false });
  const applyFrame = useRef(null);
  const lastApply  = useRef(-Infinity);

  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    cancelAnimationFrame(frame.current);
    clearTimeout(resumeTimer.current);
    setFit(null);
    fitRef.current = null;
    setSceneReady(false);
    setLoaded(false);
    setError(false);
    rotX.current = baseRotX;
    rotY.current = baseRotY;
    zoom.current = 1;
    fetchModelBounds(url).then((bounds) => {
      if (!live) return;
      fitRef.current = fitBounds(bounds, MODEL_RADIUS) || FALLBACK_FIT;
      setFit(fitRef.current);
    });
    return () => { live = false; };
  }, [url, attempt, baseRotX, baseRotY]);

  // Backstop for onPlatformUpdate: well after the navigator has mounted, the
  // renderer exists whether or not the event arrived.
  useEffect(() => {
    if (!url || sceneReady) return undefined;
    const t = setTimeout(() => setSceneReady(true), 1500);
    return () => clearTimeout(t);
  }, [url, attempt, sceneReady]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    cancelAnimationFrame(applyFrame.current);
    clearTimeout(resumeTimer.current);
  }, []);

  usePreferredFrameRate(FRAME_RATE, !!url && !error);

  // Pushing a transform to Viro is the expensive part: each prop makes it walk
  // every node in the scene with a native call per node, on the UI thread —
  // three props a frame at 120/144 Hz made the whole screen stutter. So only
  // what changed is sent, and at most ~60 times a second, however often the
  // animation ticks or touch events arrive.
  const flush = (now) => {
    applyFrame.current = null;
    if (now - lastApply.current < APPLY_INTERVAL_MS) {
      applyFrame.current = requestAnimationFrame(flush);
      return;
    }
    const obj = objectRef.current;
    if (!obj || !fitRef.current) return;
    const props = {};
    if (pending.current.rotation) props.rotation = [rotX.current, rotY.current, 0];
    if (pending.current.zoom) Object.assign(props, placement(fitRef.current, zoom.current));
    pending.current = { rotation: false, zoom: false };
    lastApply.current = now;
    try { obj.setNativeProps(props); } catch (_) {}
  };

  const requestApply = ({ rotation = false, zoom: zoomed = false }) => {
    if (rotation) pending.current.rotation = true;
    if (zoomed) pending.current.zoom = true;
    if (applyFrame.current == null) applyFrame.current = requestAnimationFrame(flush);
  };

  const stopMotion = () => {
    cancelAnimationFrame(frame.current);
    clearTimeout(resumeTimer.current);
  };

  // Calls step(frames) every animation frame, where `frames` is the time since
  // the last one counted in 60 Hz frames, so speeds match on 60/90/120 Hz
  // screens. `changes` says what step moves. When step returns false the loop
  // ends and onDone runs.
  const animate = (step, onDone, changes = { rotation: true }) => {
    stopMotion();
    let prev = null;
    const tick = (now) => {
      const frames = prev == null ? 1 : clamp((now - prev) / FRAME_MS, 0, 4);
      prev = now;
      const more = step(frames);
      requestApply(changes);
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
    }, startSpin, { rotation: true, zoom: from[2] !== 1 });
  };

  const zoomBy = (factor) => {
    zoom.current = clamp(zoom.current * factor, ZOOM_MIN, ZOOM_MAX);
    requestApply({ zoom: true });
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
      requestApply({ rotation: true });
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
      requestApply({ zoom: true });
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
      {/* Viro turns all of these on by default; this scene uses none of them,
          and they cost every frame. HDR renders into 16-bit float buffers,
          copies depth and runs a full-screen tone-mapping pass (AMBIENT
          makes up its look); bloom adds two more float attachments; no light
          here casts shadows. Multisampling stays on: with HDR off it now
          actually smooths the model's edges. */}
      <Viro3DSceneNavigator
        key={attempt}
        hdrEnabled={false}
        bloomEnabled={false}
        shadowsEnabled={false}
        initialScene={{ scene: ModelScene }}
        viroAppProps={{
          modelUrl: url, fit, sceneReady, objectRef, isDark, baseRotX, baseRotY,
          onSceneReady: () => setSceneReady(true), onModelReady, onModelError,
        }}
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
