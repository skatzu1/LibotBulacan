import React, { useEffect, useMemo, useRef } from "react";
import { View, Animated, Easing, StyleSheet, PanResponder } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import useReduceMotion from "../hooks/useReduceMotion";

/*
 * What makes an earned badge look earned (user, 2026-10-21: "I want the badges
 * to have effects"). Locked badges get none — they stay flat and grey, so the
 * difference is the reward.
 *
 *   <BadgeShine>     a streak of light that sweeps across the badge now and then
 *   <Sparkles>       little four-point stars twinkling round it
 *   <GlowPulse>      a soft gold glow breathing behind it
 *   <HoloTilt>       the badge opened up close: tilt it with a finger and a
 *                    holographic foil and the shine follow the tilt; left alone
 *                    it sways a little
 *
 * The tiers: a spot badge shines and twinkles; a town badge also glows; the
 * badge opened in its detail card is holographic. All transform/opacity on the
 * native driver, and under Reduce Motion everything stands still (the badge is
 * still drawn, just without the movement).
 */

const GOLD = "#F2CE1B";

// A four-point twinkle, drawn in a 24-unit box.
const TWINKLE = "M12 0 C12.9 8.1 15.9 11.1 24 12 C15.9 12.9 12.9 15.9 12 24 C11.1 15.9 8.1 12.9 0 12 C8.1 11.1 11.1 8.1 12 0 Z";

/** A light streak sweeping across a round (or `radius`-cornered) badge of `size`. */
export function BadgeShine({ size, radius, delay = 0, every = 3400, intensity = 0.6, style }) {
  const reduce = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(x, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(every),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, delay, every, x]);
  if (reduce) return null;
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-size * 1.15, size * 1.15] });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius ?? size / 2, overflow: "hidden" }, style]}>
      <Animated.View
        style={{
          position: "absolute", top: -size * 0.3, left: size * 0.31,
          width: size * 0.38, height: size * 1.6,
          transform: [{ translateX }, { rotate: "22deg" }],
        }}
      >
        <LinearGradient
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          colors={["rgba(255,255,255,0)", `rgba(255,255,255,${intensity})`, "rgba(255,255,255,0)"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/**
 * `count` twinkles on a ring round a badge of `size`, each in its own time.
 * The box they sit in is centred on the badge and reaches past its edge, so
 * the parent mustn't clip.
 */
export function Sparkles({ size, count = 4, spread = 0.62, color = GOLD, seed = 0 }) {
  const reduce = useReduceMotion();
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => {
    // Spread round the ring, nudged off a perfect pattern so it feels loose.
    const angle = (Math.PI * 2 * i) / count + ((seed * 7 + i * 13) % 10) / 20 - 0.6;
    const r = size * (spread + (((seed + i) * 17) % 10) / 100);
    return {
      x: Math.cos(angle) * r, y: Math.sin(angle) * r,
      s: Math.max(9, size * 0.1) + ((seed + i * 5) % 5) * 1.8,
      delay: (i * 620 + seed * 230) % 2400,
      v: new Animated.Value(0),
    };
  }), [count, size, spread, seed]);
  useEffect(() => {
    if (reduce) return undefined;
    const loops = stars.map((st) => Animated.loop(Animated.sequence([
      Animated.delay(st.delay),
      Animated.timing(st.v, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(st.v, { toValue: 0, duration: 620, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(2400 - st.delay),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [stars, reduce]);
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={s.center}>
      {stars.map((st, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute", width: st.s, height: st.s,
            opacity: st.v,
            transform: [
              { translateX: st.x }, { translateY: st.y },
              { scale: st.v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              { rotate: st.v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) },
            ],
          }}
        >
          <Svg width={st.s} height={st.s} viewBox="0 0 24 24"><Path d={TWINKLE} fill={color} /></Svg>
        </Animated.View>
      ))}
    </View>
  );
}

/** A soft glow breathing behind a badge of `size` (a plain circle — no shadow, which Android draws square). */
export function GlowPulse({ size, color = GOLD, strength = 0.32 }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  const d = size * 1.22;
  return (
    <View pointerEvents="none" style={s.center}>
      <Animated.View
        style={{
          position: "absolute", width: d, height: d, borderRadius: d / 2,
          backgroundColor: color,
          opacity: reduce ? strength * 0.6 : v.interpolate({ inputRange: [0, 1], outputRange: [strength * 0.45, strength] }),
          transform: [{ scale: reduce ? 1 : v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.05] }) }],
        }}
      />
    </View>
  );
}

/**
 * A badge you can tilt: a finger on it leans it toward the finger, a
 * holographic foil and the shine slide with the tilt, and it springs back on
 * release. Left alone it sways gently. Wrap the round badge image (`size`).
 */
export function HoloTilt({ size, children, active = true }) {
  const reduce = useReduceMotion();
  const tilt = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current; // x: left/right lean, y: up/down
  const sway = useRef(new Animated.Value(0)).current;
  const swayLoop = useRef(null);

  useEffect(() => {
    if (reduce || !active) return undefined;
    swayLoop.current = Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(sway, { toValue: -1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    swayLoop.current.start();
    return () => swayLoop.current?.stop();
  }, [reduce, active, sway]);

  const clamp = (n) => Math.max(-1, Math.min(1, n));
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => active && !reduce,
    onMoveShouldSetPanResponder: () => active && !reduce,
    // Keep the drag once it starts: the detail card around it scrolls, and
    // would otherwise take it over halfway (true also blocks Android's native
    // scroll from intercepting).
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { swayLoop.current?.stop(); return true; },
    onPanResponderMove: (_, g) => tilt.setValue({ x: clamp(g.dx / (size * 0.6)), y: clamp(g.dy / (size * 0.6)) }),
    onPanResponderRelease: () => {
      Animated.spring(tilt, { toValue: { x: 0, y: 0 }, friction: 4, tension: 60, useNativeDriver: true }).start(() => swayLoop.current?.start());
    },
    onPanResponderTerminate: () => {
      Animated.spring(tilt, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: true }).start();
    },
  }), [active, reduce, size, tilt]);

  if (!active || reduce) return <View style={{ width: size, height: size }}>{children}</View>;

  // The lean: the finger's side comes toward you; the idle sway adds a little.
  const lean = Animated.add(tilt.x, Animated.multiply(sway, 0.25));
  const rotateY = lean.interpolate({ inputRange: [-1, 1], outputRange: ["-20deg", "20deg"] });
  const rotateX = tilt.y.interpolate({ inputRange: [-1, 1], outputRange: ["18deg", "-18deg"] });
  const foilX = lean.interpolate({ inputRange: [-1, 1], outputRange: [size * 0.55, -size * 0.55] });
  const shineX = lean.interpolate({ inputRange: [-1, 1], outputRange: [-size * 0.7, size * 0.7] });

  return (
    <Animated.View
      {...responder.panHandlers}
      accessibilityHint="Drag to tilt the badge"
      style={{ width: size, height: size, transform: [{ perspective: 700 }, { rotateX }, { rotateY }] }}
    >
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: size / 2, overflow: "hidden" }]}>
        {/* Holographic foil: a band of colour that slides as the badge leans. */}
        <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -size * 0.6, width: size * 2.2, transform: [{ translateX: foilX }] }}>
          <LinearGradient
            start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }}
            colors={["rgba(255,80,160,0)", "rgba(255,80,160,0.13)", "rgba(255,215,64,0.15)", "rgba(64,230,200,0.15)", "rgba(120,110,255,0.13)", "rgba(120,110,255,0)"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        {/* The light catching it. */}
        <Animated.View style={{ position: "absolute", top: -size * 0.3, left: size * 0.31, width: size * 0.34, height: size * 1.6, transform: [{ translateX: shineX }, { rotate: "22deg" }] }}>
          <LinearGradient
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.5)", "rgba(255,255,255,0)"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// Glow and sparkles sit in a layer the size of the badge's wrapper and centre
// on it with flex — not a 0×0 box pinned at left/top 50%, which Android
// (new architecture) drew off the badge's centre.
const s = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
