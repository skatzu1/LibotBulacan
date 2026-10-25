import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

/*
 * The card grid of the Badges screen, shared with the Bakit List, AR View and
 * Navigate spot lists (user, 2026-10-20: "make it like the badge screen").
 */

export const GRID_GAP = 16;
export const H_GUTTER = 40; // total horizontal screen padding

// Columns scale with the viewport instead of being pinned at 3 — on a tablet or
// in split-screen the old fixed grid produced either giant cells or clipping.
// Under 340 (a 320-wide phone, or one with a large display size) three cards
// are narrower than a badge's ring, so it's two.
export const columnsFor = (w) => (w >= 900 ? 6 : w >= 600 ? 4 : w >= 340 ? 3 : 2);
export const cardSizeFor = (w) => (w - H_GUTTER - GRID_GAP * (columnsFor(w) - 1)) / columnsFor(w);

// Self-contained fade-in wrapper — safe with FlatList recycling since each
// mounted cell owns its own Animated.Value instead of indexing into a shared
// array (which would replay stale values onto recycled/filtered cells).
export function AnimatedCell({ children, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1, duration: 300, delay, useNativeDriver: true,
    }).start();
  }, []);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
