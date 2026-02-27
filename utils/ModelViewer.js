import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Text } from "react-native";
import { GLView } from "expo-gl";
import * as THREE from "three";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { GestureDetector, Gesture, GestureHandlerRootView } from "react-native-gesture-handler";
import { GLTFLoader } from "three-stdlib";

export default function ModelViewer({ url, style }) {
  const rafRef = useRef(null);
  const mountedRef = useRef(true);
  const modelRef = useRef(null);
  const rotationRef = useRef({ x: 0.3, y: 0 });
  const lastRotationRef = useRef({ x: 0.3, y: 0 });
  const scaleRef = useRef(1);
  const lastScaleRef = useRef(1);
  const baseScaleRef = useRef(1);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Gesture handlers
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      if (!modelRef.current) return;
      rotationRef.current = {
        x: lastRotationRef.current.x + e.translationY * 0.005,
        y: lastRotationRef.current.y + e.translationX * 0.005,
      };
      modelRef.current.rotation.x = rotationRef.current.x;
      modelRef.current.rotation.y = rotationRef.current.y;
    })
    .onEnd(() => {
      lastRotationRef.current = { ...rotationRef.current };
    });

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onUpdate((e) => {
      if (!modelRef.current) return;
      const newScale = lastScaleRef.current * e.scale;
      const clamped = Math.min(Math.max(newScale, baseScaleRef.current * 0.3), baseScaleRef.current * 4);
      scaleRef.current = clamped;
      modelRef.current.scale.setScalar(clamped);
    })
    .onEnd(() => {
      lastScaleRef.current = scaleRef.current;
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  // Load model
  const onContextCreate = async (gl) => {
    console.log("🟢 GL context created, url:", url);

    // Setup Three renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: {
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        clientHeight: gl.drawingBufferHeight,
        getContext: () => gl,
      },
      context: gl,
    });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x87ceeb);

    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.01,
      1000
    );
    camera.position.set(0, 1, 4);
    camera.lookAt(0, 0, 0);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(5, 10, 5);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-5, 2, -5);
    scene.add(fill);

    // Render loop
    const animate = () => {
      if (!mountedRef.current) return;
      rafRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();

    if (!url) {
      console.error("❌ No URL provided");
      return;
    }

    try {
      // Download GLB file
      const localUri = FileSystem.cacheDirectory + "model_cached.glb";
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists) await FileSystem.deleteAsync(localUri);
      await FileSystem.downloadAsync(url, localUri);
      console.log("✅ GLB downloaded");

      // Read as array buffer
      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = decode(base64);

      // Parse GLB
      const loader = new GLTFLoader();
      loader.parse(
        arrayBuffer,
        "",
        (gltf) => {
          if (!mountedRef.current) return;

          const model = gltf.scene;

          // Assign a default color or texture if needed
          model.traverse((child) => {
            if (!child.isMesh) return;

            const mat = child.material;
            if (mat) {
              // Temporary fix: assign solid color to ensure visibility
              mat.color = new THREE.Color(0x808080);
              mat.side = THREE.DoubleSide;
              mat.needsUpdate = true;

              // Optional: apply texture using TextureLoader if available
              // const texLoader = new THREE.TextureLoader();
              // texLoader.load(textureUri, (tex) => {
              //   mat.map = tex;
              //   mat.needsUpdate = true;
              // });
            }
          });

          // Auto-fit model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const baseScale = 10 / maxDim;

          model.scale.setScalar(baseScale);
          model.position.sub(center.multiplyScalar(baseScale));
          model.rotation.x = 0.3;

          baseScaleRef.current = baseScale;
          scaleRef.current = baseScale;
          lastScaleRef.current = baseScale;

          scene.add(model);
          modelRef.current = model;

          console.log("✅ Model added, meshes:", model.children.length);
        },
        (err) => console.error("❌ GLTF parse error:", err)
      );
    } catch (e) {
      console.error("❌ Error loading model:", e);
    }
  };

  return (
    <GestureHandlerRootView style={[styles.wrapper, style]}>
      <GestureDetector gesture={composed}>
        <View style={StyleSheet.absoluteFill}>
          <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        </View>
      </GestureDetector>
      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>Drag to rotate • Pinch to zoom</Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#87ceeb",
    borderRadius: 20,
    overflow: "hidden",
  },
  hint: {
    position: "absolute",
    bottom: 10,
    right: 14,
  },
  hintText: {
    color: "#ffffff90",
    fontSize: 11,
  },
});