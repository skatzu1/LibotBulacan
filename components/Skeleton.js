/**
 * Skeleton.js
 * Reusable shimmer primitive built on react-native-reanimated (already in your project).
 * Usage:
 *   <Skeleton width={200} height={16} radius={8} />
 *   <Skeleton width="100%" height={160} radius={12} />
 */
import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";

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
  const resolvedBase  = baseColor  ?? colors.card;
  const resolvedShine = shineColor ?? (isDark ? colors.cardBorder : colors.backgroundSoft);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100 }),
      -1,   // infinite
      true  // reverse
    );
  }, []);

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