import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";

const AnimatedView = Animated.View;

export function Skeleton({ width, height, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <AnimatedView
      style={[
        {
          width: width || "100%",
          height: height || 20,
          borderRadius,
          backgroundColor: "#e0d0ce",
          opacity,
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={s.card}>
      <Skeleton height={160} borderRadius={16} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
      <View style={s.body}>
        <Skeleton width="70%" height={18} style={{ marginBottom: 8 }} />
        <Skeleton width="50%" height={14} style={{ marginBottom: 4 }} />
        <Skeleton width="40%" height={14} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 3 }) {
  return (
    <View style={{ gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

export function HeroSkeleton() {
  return (
    <View style={s.hero}>
      <Skeleton width="100%" height="100%" borderRadius={0} />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#faf5f4",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f0e0de",
  },
  body: { padding: 14 },
  hero: { width: "100%", height: 280, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: "hidden" },
});

export default Skeleton;
