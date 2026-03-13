import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

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

import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

const INITIAL_SCALE = 0.3;
const VIEW_DISTANCE = -20;

const SENSITIVITY = 0.3;
const INERTIA = 0.92;
const INERTIA_MIN = 0.05;
const AUTO_ROTATE_SPEED = 0.35;

ViroMaterials.createMaterials({
  darkBackground: { diffuseColor: "#0d0d1a" },
});

const sharedRef = { objectRef: null };


// ─────────────────────────────────────────────
// 3D Scene
// ─────────────────────────────────────────────
const ModelScene = ({ sceneNavigator }) => {

  const { modelUrl, onModelReady } = sceneNavigator.viroAppProps;
  const objectRef = useRef(null);

  useEffect(() => {
    sharedRef.objectRef = objectRef;
    return () => (sharedRef.objectRef = null);
  }, []);

  return (
    <ViroScene>

      {/* Camera slightly above */}
      <ViroCamera
        position={[0, 2.5, 1]}
        rotation={[-15, 0, 0]}
      />

      {/* Background */}
      <ViroSphere
        position={[0, 0, 0]}
        radius={100}
        facesOutward={false}
        materials={["darkBackground"]}
      />

      {/* Lighting */}
      <ViroDirectionalLight
        color="#fff5e0"
        direction={[-0.5, -0.8, -0.5]}
        intensity={600}
      />

      <ViroDirectionalLight
        color="#c8d8ff"
        direction={[1, -0.3, -0.5]}
        intensity={250}
      />

      <ViroDirectionalLight
        color="#ffffff"
        direction={[0, 0.5, 1]}
        intensity={300}
      />

      <ViroAmbientLight
        color="#334466"
        intensity={120}
      />

      {/* Model */}
      <Viro3DObject
        ref={objectRef}
        source={{ uri: modelUrl }}
        position={[0, 0, VIEW_DISTANCE]}
        scale={[INITIAL_SCALE, INITIAL_SCALE, INITIAL_SCALE]}
        rotation={[15, 30, 0]}
        type="GLB"
        onLoadEnd={() => onModelReady?.()}
      />

    </ViroScene>
  );
};


// ─────────────────────────────────────────────
// Model Viewer
// ─────────────────────────────────────────────
export default function ModelViewer({ url, style }) {

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const rotX = useRef(15);
  const rotY = useRef(30);

  const lastRotX = useRef(15);
  const lastRotY = useRef(30);

  const scaleVal = useRef(INITIAL_SCALE);
  const lastScale = useRef(INITIAL_SCALE);

  const velX = useRef(0);
  const velY = useRef(0);

  const inertiaFrame = useRef(null);
  const autoFrame = useRef(null);

  const isDragging = useRef(false);


  const applyTransform = (x, y, s) => {

    sharedRef.objectRef?.current?.setNativeProps({
      rotation: [-x, y, 0], // invert vertical axis
      scale: [s, s, s],
    });

  };


  const stopInertia = () => {
    cancelAnimationFrame(inertiaFrame.current);
  };

  const stopAuto = () => {
    cancelAnimationFrame(autoFrame.current);
  };


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


  const startInertia = () => {

    stopInertia();

    const loop = () => {

      velX.current *= INERTIA;
      velY.current *= INERTIA;

      if (
        Math.abs(velX.current) < INERTIA_MIN &&
        Math.abs(velY.current) < INERTIA_MIN
      ) {
        startAutoRotate();
        return;
      }

      rotX.current = Math.min(
        Math.max(rotX.current + velX.current, -70),
        70
      );

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


  // ───────────── Gestures ─────────────

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {

      isDragging.current = true;
      stopInertia();
      stopAuto();

    })
    .onUpdate((e) => {

      rotX.current = Math.min(
        Math.max(lastRotX.current - e.translationY * SENSITIVITY, -70),
        70
      );

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
        Math.max(lastScale.current * e.scale, INITIAL_SCALE * 0.3),
        INITIAL_SCALE * 4
      );

      scaleVal.current = next;

      applyTransform(rotX.current, rotY.current, next);

    })
    .onEnd(() => {

      lastScale.current = scaleVal.current;

    });


  const gesture = Gesture.Simultaneous(panGesture, pinchGesture);


  const zoomIn = () => {

    const s = Math.min(scaleVal.current * 1.3, INITIAL_SCALE * 4);

    scaleVal.current = s;
    lastScale.current = s;

    applyTransform(rotX.current, rotY.current, s);
  };


  const zoomOut = () => {

    const s = Math.max(scaleVal.current * 0.8, INITIAL_SCALE * 0.3);

    scaleVal.current = s;
    lastScale.current = s;

    applyTransform(rotX.current, rotY.current, s);
  };


  const reset = () => {

    stopInertia();
    stopAuto();

    rotX.current = 15;
    rotY.current = 30;

    lastRotX.current = 15;
    lastRotY.current = 30;

    scaleVal.current = INITIAL_SCALE;
    lastScale.current = INITIAL_SCALE;

    applyTransform(15, 30, INITIAL_SCALE);

    setTimeout(startAutoRotate, 800);
  };


  if (!url || error) {
    return (
      <View style={[styles.wrapper, style]}>
        <Text style={{ color: "#aaa" }}>
          Failed to load model
        </Text>
      </View>
    );
  }


  return (
    <GestureHandlerRootView style={[styles.wrapper, style]}>

      <Viro3DSceneNavigator
        initialScene={{ scene: ModelScene }}
        viroAppProps={{ modelUrl: url, onModelReady }}
        style={StyleSheet.absoluteFill}
        onError={() => setError(true)}
      />

      {!loaded && (
        <View style={styles.loading}>
          <Text style={{ color: "#aaa" }}>Loading 3D Model...</Text>
        </View>
      )}

      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>

      <View style={styles.zoomButtons}>
        <TouchableOpacity style={styles.iconBtn} onPress={zoomIn}>
          <Feather name="plus" size={18} color="#fff"/>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={zoomOut}>
          <Feather name="minus" size={18} color="#fff"/>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.resetBtn} onPress={reset}>
        <MaterialCommunityIcons name="rotate-3d-variant" size={18} color="#fff"/>
      </TouchableOpacity>

    </GestureHandlerRootView>
  );
}


const styles = StyleSheet.create({

  wrapper: {
    backgroundColor: "#0d0d1a",
    borderRadius: 20,
    overflow: "hidden",
  },

  loading: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
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
    backgroundColor: "#ffffff18",
    borderWidth: 1,
    borderColor: "#ffffff22",
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
    backgroundColor: "#ffffff18",
    borderWidth: 1,
    borderColor: "#ffffff22",
    justifyContent: "center",
    alignItems: "center",
  },

});