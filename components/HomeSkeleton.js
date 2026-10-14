/**
 * HomeSkeleton.js — mirrors the current HomeContent layout in Home.js:
 *   header (greeting · points · avatar) · search field · quick actions ·
 *   Featured carousel · Most-visited grid
 */
import React from "react";
import { View, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Skeleton from "./Skeleton";
import { useTheme, TAB_BAR_CLEARANCE } from "../context/ThemeContext";
import { useGrid, H_PAD } from "./ui";

export default function HomeSkeleton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { cardW, gap } = useGrid();
  const HERO_H = Math.round(Math.min(width * 0.82, 340));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
      accessibilityLabel="Loading home"
    >
      {/* Top bar — matches the real one's safe-area padding so nothing jumps:
          logo on the left, points and avatar on the right, all 36 high. */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 12 }]}>
        <Skeleton width={36} height={36} radius={9} />
        <View style={styles.headerRight}>
          <Skeleton width={60} height={36} radius={18} />
          <Skeleton width={36} height={36} radius={18} />
        </View>
      </View>

      {/* Greeting: a 20-high line and a 40-high name line */}
      <View style={[styles.pad, { paddingTop: 10 }]}>
        <Skeleton width={110} height={13} radius={5} style={{ marginVertical: 3.5 }} />
        <Skeleton width={150} height={28} radius={7} style={{ marginVertical: 6 }} />
      </View>

      {/* Search */}
      <View style={[styles.pad, { marginTop: 16 }]}>
        <Skeleton width="100%" height={46} radius={999} />
      </View>

      {/* Quick actions */}
      <Skeleton width={150} height={22} radius={6} style={styles.title} />
      <View style={styles.quickRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ alignItems: "center" }}>
            <Skeleton width={58} height={58} radius={20} />
            <Skeleton width={44} height={11} radius={4} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      {/* Featured */}
      <Skeleton width={100} height={22} radius={6} style={styles.title} />
      <Skeleton width={width - H_PAD * 2} height={HERO_H} radius={22} style={{ marginHorizontal: H_PAD }} />
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={i === 0 ? 18 : 6} height={6} radius={3} />
        ))}
      </View>

      {/* Most visited */}
      <Skeleton width={120} height={22} radius={6} style={styles.title} />
      <View style={styles.pad}>
        <Skeleton width="100%" height={200} radius={22} style={{ marginBottom: 12 }} />
        <View style={[styles.gridRow, { gap }]}>
          <Skeleton width={cardW} height={150} radius={22} />
          <Skeleton width={cardW} height={150} radius={22} />
        </View>
      </View>

      <View style={{ height: TAB_BAR_CLEARANCE + insets.bottom }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingBottom: 10,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  pad:      { paddingHorizontal: H_PAD },
  // A section heading (SectionTitle: 28 above, 14 below, on the gutter).
  // Margin, not padding: padding on a fixed-width bone doesn't move it, so
  // these used to sit flush against the left edge of the screen.
  title:    { marginLeft: H_PAD, marginTop: 28, marginBottom: 14 },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
  },
  dots:    { flexDirection: "row", gap: 5, alignSelf: "center", marginTop: 14 },
  gridRow: { flexDirection: "row" },
});
