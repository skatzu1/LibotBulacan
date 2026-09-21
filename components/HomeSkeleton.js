/**
 * HomeSkeleton.js — mirrors the current HomeContent layout in Home.js:
 *   slim header · greeting · search field · quick-action row · Featured carousel
 *   · Most-visited grid
 */
import React from "react";
import { View, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Skeleton from "./Skeleton";
import { useTheme, TAB_BAR_CLEARANCE } from "../context/ThemeContext";
import { useGrid, H_PAD, TAP } from "./ui";

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
      {/* Header — matches the real one's safe-area padding so nothing jumps */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <Skeleton width={32} height={32} radius={9} />
        <View style={styles.headerActions}>
          <Skeleton width={22} height={22} radius={6} />
          <Skeleton width={36} height={36} radius={18} />
        </View>
      </View>

      {/* Greeting */}
      <View style={styles.pad}>
        <Skeleton width={90} height={13} radius={5} style={{ marginTop: 8 }} />
        <Skeleton width={190} height={30} radius={7} style={{ marginTop: 8 }} />
      </View>

      {/* Search */}
      <Skeleton width="100%" height={46} radius={999} style={[styles.pad, { marginTop: 16 }]} />

      {/* Quick actions */}
      <View style={styles.quickRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ alignItems: "center" }}>
            <Skeleton width={58} height={58} radius={20} />
            <Skeleton width={44} height={11} radius={4} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      {/* Featured */}
      <Skeleton width={100} height={22} radius={6} style={[styles.pad, { marginTop: 30, marginBottom: 14 }]} />
      <Skeleton width={width - H_PAD * 2} height={HERO_H} radius={22} style={{ marginHorizontal: H_PAD }} />
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={i === 0 ? 18 : 6} height={6} radius={3} />
        ))}
      </View>

      {/* Most visited */}
      <Skeleton width={120} height={22} radius={6} style={[styles.pad, { marginTop: 30, marginBottom: 14 }]} />
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: H_PAD,
    paddingBottom: 10,
    height: TAP + 22,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  pad:      { paddingHorizontal: H_PAD },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    marginTop: 24,
  },
  dots:    { flexDirection: "row", gap: 5, alignSelf: "center", marginTop: 14 },
  gridRow: { flexDirection: "row" },
});
