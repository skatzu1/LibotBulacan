/**
 * Skeleton.js
 * Reusable shimmer primitive built on react-native-reanimated (already in your project).
 * Usage:
 *   <Skeleton width={200} height={16} radius={8} />
 *   <Skeleton width="100%" height={160} radius={12} />
 */
import React, { useEffect, useState } from "react";
import { View, StyleSheet, AccessibilityInfo } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolation,
  cancelAnimation,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";

// Module-level so every bone on screen shares one query and one subscription
// instead of each of the ~20 skeletons on a screen doing its own.
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) setReduce(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduce;
}

// ─── Shimmer Bone ─────────────────────────────────────────────────────────────
// baseColor/shineColor are optional overrides — when omitted, the shimmer
// pulls its colors from the current theme so it looks right in both light
// and dark mode instead of always rendering the light-mode cyan tint.
export default function Skeleton({
  width,
  height,
  radius = 8,
  style,
  baseColor,
  shineColor,
}) {
  const { colors, isDark } = useTheme();
  const reduceMotion  = useReduceMotion();
  const resolvedBase  = baseColor  ?? colors.backgroundSoft;
  const resolvedShine = shineColor ?? (isDark ? colors.cardBorder : colors.card);
  const progress = useSharedValue(0);

  // An indefinitely repeating pulse is a vestibular trigger and a real battery
  // cost on exactly the slow connections where skeletons stay on screen longest.
  // Under Reduce Motion the bone renders as a flat, static block instead.
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 0.35;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 1100 }),
      -1,   // infinite
      true  // reverse
    );
    return () => cancelAnimation(progress);
  }, [reduceMotion]);

  // Base pulse — fades the whole bone
  const boneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 1],
      [1, 0.45],
      Extrapolation.CLAMP
    ),
  }));

  // Shine sweep — runs on the overlay only
  const shineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.5, 1],
      [0, 0.6, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: resolvedBase,
          overflow: "hidden",
        },
        boneStyle,
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: resolvedShine },
          shineStyle,
        ]}
      />
    </Animated.View>
  );
}

// ─── Row helper: label + value side-by-side ───────────────────────────────────
export function SkeletonRow({ labelWidth = 90, valueWidth = 140, height = 13, style }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, style]}>
      <Skeleton width={labelWidth} height={height} radius={6} />
      <Skeleton width={valueWidth} height={height} radius={6} />
    </View>
  );
}

// ─── Avatar circle ────────────────────────────────────────────────────────────
export function SkeletonAvatar({ size = 38 }) {
  return <Skeleton width={size} height={size} radius={size / 2} />;
}