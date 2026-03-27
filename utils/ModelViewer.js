import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import {
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";

import {
  Viro3DSceneNavigator,
  ViroScene,
  ViroAmbientLight,
  ViroDirectionalLight,
  Viro3DObject,
  ViroSphere,
  ViroMaterials,
} from "@reactvision/react-viro";

import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

const VIEW_DISTANCE     = -20;
const SENSITIVITY       = 0.3;
const INERTIA           = 0.92;
const INERTIA_MIN       = 0.05;
const AUTO_ROTATE_SPEED = 0.35;
const RESET_STEPS       = 40;

const DEFAULT_BASE_ROT_X  = -0;
const DEFAULT_BASE_ROT_Y  =  -55;
const DEFAULT_BASE_SCALE  = 0.25;

let materialsCreated = false;
if (!materialsCreated) {
  ViroMaterials.createMaterials({
    whiteBackground: { diffuseColor: "#ffffff" },
  });
  materialsCreated = true;
}

const sharedRef = { objectRef: null };

// ─────────────────────────────────────────────
// 3D Scene
// ─────────────────────────────────────────────
const ModelScene = ({ sceneNavigator }) => {
  const {
    modelUrl,
    onModelReady,
    onModelError,
    baseRotX,
    baseRotY,
    baseScale,
  } = sceneNavigator.viroAppProps;

  const objectRef = useRef(null);

  useEffect(() => {
    sharedRef.objectRef = objectRef;
    return () => { sharedRef.objectRef = null; };
  }, []);

  return (
    <ViroScene>
      {/* White background sphere */}
      <ViroSphere
        position={[0, 0, 0]}
        radius={100}
        facesOutward={false}
        materials={["whiteBackground"]}
      />

      {/* Bright neutral lighting to suit a white background */}
      <ViroDirectionalLight color="#ffffff" direction={[-0.5, -0.8, -0.5]} intensity={700} />
      <ViroDirectionalLight color="#e8eeff" direction={[1, -0.3, -0.5]}   intensity={400} />
      <ViroDirectionalLight color="#ffffff" direction={[0, 0.5, 1]}       intensity={350} />
      <ViroAmbientLight     color="#ffffff" intensity={300} />

      <Viro3DObject
        ref={objectRef}
        source={{ uri: modelUrl }}
        position={[0, -1.5, VIEW_DISTANCE]}
        scale={[baseScale, baseScale, baseScale]}
        rotation={[baseRotX, baseRotY, 0]}
        type="GLB"
        onLoadEnd={() => onModelReady?.()}
        onError={() => onModelError?.()}
      />
    </ViroScene>
  );
};

// ─────────────────────────────────────────────
// Model Viewer
//
// Props:
//   url        {string}  — GLB model URI (required)
//   style      {object}  — extra container styles
//   baseRotX   {number}  — base X rotation in degrees (default: -15)
//   baseRotY   {number}  — base Y rotation in degrees (default:  15)
//   baseScale  {number}  — base uniform scale         (default: 0.18)
// ─────────────────────────────────────────────
export default function ModelViewer({
  url,
  style,
  baseRotX  = DEFAULT_BASE_ROT_X,
  baseRotY  = DEFAULT_BASE_ROT_Y,
  baseScale = DEFAULT_BASE_SCALE,
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState(false);

  const rotX      = useRef(baseRotX);
  const rotY      = useRef(baseRotY);
  const lastRotX  = useRef(baseRotX);
  const lastRotY  = useRef(baseRotY);
  const scaleVal  = useRef(baseScale);
  const lastScale = useRef(baseScale);
  const velX      = useRef(0);
  const velY      = useRef(0);

  const inertiaFrame = useRef(null);
  const autoFrame    = useRef(null);
  const isDragging   = useRef(false);

  useEffect(() => {
    rotX.current      = baseRotX;
    rotY.current      = baseRotY;
    lastRotX.current  = baseRotX;
    lastRotY.current  = baseRotY;
    scaleVal.current  = baseScale;
    lastScale.current = baseScale;
  }, [baseRotX, baseRotY, baseScale]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(inertiaFrame.current);
      cancelAnimationFrame(autoFrame.current);
      sharedRef.objectRef = null;
    };
  }, []);

  const applyTransform = (x, y, s) => {
    try {
      sharedRef.objectRef?.current?.setNativeProps({
        rotation: [-x, y, 0],
        scale: [s, s, s],
      });
    } catch (_) {}
  };

  const stopInertia = () => cancelAnimationFrame(inertiaFrame.current);
  const stopAuto    = () => cancelAnimationFrame(autoFrame.current);

  const startAutoRotate = () => {
    stopAuto();
    const loop = () => {
      if (isDragging.current) return;
      rotY.current += AUTO_ROTATE_SPEED;
      lastRotY.current = rotY.current;
      applyTransform(rotX.current, rotY.current, scaleVal.current);
      autoFrame.current = requestAnimationFrame(loop);
    };
    autoFrame.current = requestAnimationFrame(loop);
  };

  const startResetAnimation = () => {
    stopInertia();
    stopAuto();
    let step = 0;
    const fromX = rotX.current;
    const fromY = rotY.current;
    const fromS = scaleVal.current;

    const loop = () => {
      step++;
      const t    = step / RESET_STEPS;
      const ease = 1 - Math.pow(1 - t, 3);

      rotX.current     = fromX + (baseRotX - fromX) * ease;
      rotY.current     = fromY + (baseRotY - fromY) * ease;
      scaleVal.current = fromS + (baseScale - fromS) * ease;

      applyTransform(rotX.current, rotY.current, scaleVal.current);

      if (step < RESET_STEPS) {
        inertiaFrame.current = requestAnimationFrame(loop);
      } else {
        rotX.current      = baseRotX;
        rotY.current      = baseRotY;
        lastRotX.current  = baseRotX;
        lastRotY.current  = baseRotY;
        scaleVal.current  = baseScale;
        lastScale.current = baseScale;
        applyTransform(baseRotX, baseRotY, baseScale);
        startAutoRotate();
      }
    };
    inertiaFrame.current = requestAnimationFrame(loop);
  };

  const startInertia = () => {
    stopInertia();
    const loop = () => {
      velX.current *= INERTIA;
      velY.current *= INERTIA;
      if (Math.abs(velX.current) < INERTIA_MIN && Math.abs(velY.current) < INERTIA_MIN) {
        startResetAnimation();
        return;
      }
      rotX.current = Math.min(Math.max(rotX.current + velX.current, -70), 70);
      rotY.current += velY.current;
      lastRotX.current = rotX.current;
      lastRotY.current = rotY.current;
      applyTransform(rotX.current, rotY.current, scaleVal.current);
      inertiaFrame.current = requestAnimationFrame(loop);
    };
    inertiaFrame.current = requestAnimationFrame(loop);
  };

  const onModelReady = () => {
    setLoaded(true);
    startAutoRotate();
  };

  const onModelError = () => {
    setError(true);
    setLoaded(true);
  };

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(5)
    .onBegin(() => {
      isDragging.current = true;
      stopInertia();
      stopAuto();
    })
    .onUpdate((e) => {
      rotX.current = Math.min(Math.max(lastRotX.current - e.translationY * SENSITIVITY, -70), 70);
      rotY.current = lastRotY.current + e.translationX * SENSITIVITY;
      velX.current = -e.velocityY * 0.01;
      velY.current = e.velocityX * 0.01;
      applyTransform(rotX.current, rotY.current, scaleVal.current);
    })
    .onEnd(() => {
      isDragging.current = false;
      lastRotX.current = rotX.current;
      lastRotY.current = rotY.current;
      startInertia();
    });

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onUpdate((e) => {
      const next = Math.min(
        Math.max(lastScale.current * e.scale, baseScale * 0.3),
        baseScale * 4
      );
      scaleVal.current = next;
      applyTransform(rotX.current, rotY.current, next);
    })
    .onEnd(() => {
      lastScale.current = scaleVal.current;
      startResetAnimation();
    });

  const gesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const zoomIn = () => {
    const s = Math.min(scaleVal.current * 1.3, baseScale * 4);
    scaleVal.current = s; lastScale.current = s;
    applyTransform(rotX.current, rotY.current, s);
  };

  const zoomOut = () => {
    const s = Math.max(scaleVal.current * 0.8, baseScale * 0.3);
    scaleVal.current = s; lastScale.current = s;
    applyTransform(rotX.current, rotY.current, s);
  };

  const reset = () => {
    isDragging.current = false;
    startResetAnimation();
  };

  if (!url || error) {
    return (
      <View style={[styles.wrapper, style, styles.center]}>
        <Text style={{ color: "#999" }}>
          {error ? "Failed to load 3D model" : "No model URL provided"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      <Viro3DSceneNavigator
        initialScene={{ scene: ModelScene }}
        viroAppProps={{ modelUrl: url, onModelReady, onModelError, baseRotX, baseRotY, baseScale }}
        style={StyleSheet.absoluteFill}
        onError={() => setError(true)}
      />

      {!loaded && (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.loadingOverlay]}>
          <Text style={{ color: "#999" }}>Loading 3D Model...</Text>
        </View>
      )}

      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      <View style={styles.zoomButtons}>
        <TouchableOpacity style={styles.iconBtn} onPress={zoomIn}>
          <Feather name="plus" size={18} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={zoomOut}>
          <Feather name="minus" size={18} color="#555" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.resetBtn} onPress={reset}>
        <MaterialCommunityIcons name="rotate-3d-variant" size={18} color="#555" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#ffffff",   // ← white container
    borderRadius: 20,
    overflow: "hidden",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    backgroundColor: "#ffffff",   // ← white loading overlay
  },
  zoomButtons: {
    position: "absolute",
    right: 12,
    top: "50%",
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00000010",  // subtle dark tint on white bg
    borderWidth: 1,
    borderColor: "#00000018",
    justifyContent: "center",
    alignItems: "center",
  },
  resetBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00000010",
    borderWidth: 1,
    borderColor: "#00000018",
    justifyContent: "center",
    alignItems: "center",
  },
});