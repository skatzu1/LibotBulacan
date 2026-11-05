import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

export const GRID_GAP = 16;
export const H_GUTTER = 40; 

export const columnsFor = (w) => (w >= 900 ? 6 : w >= 600 ? 4 : w >= 340 ? 3 : 2);
export const cardSizeFor = (w) => (w - H_GUTTER - GRID_GAP * (columnsFor(w) - 1)) / columnsFor(w);

export function AnimatedCell({ children, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1, duration: 300, delay, useNativeDriver: true,
    }).start();
  }, []);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
