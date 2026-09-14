/**
 * HomeSkeleton.js — mirrors the current HomeContent layout in Home.js:
 *   slim header · greeting · quick-action row · Featured carousel · Most-visited grid
 */
import React from "react";
import { View, StyleSheet, Dimensions, ScrollView } from "react-native";
import Skeleton from "./Skeleton";
import { useTheme } from "../context/ThemeContext";

const { width, height } = Dimensions.get("window");
const HERO_H = Math.round(height * 0.36);
const H_PAD  = 20;
const CARD_W = (width - H_PAD * 2 - 12) / 2;

export default function HomeSkeleton() {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Skeleton width={24} height={18} radius={4} />
        <Skeleton width={32} height={32} radius={9} />
        <Skeleton width={36} height={36} radius={18} />
      </View>

      {/* Greeting */}
      <View style={styles.pad}>
        <Skeleton width={90} height={13} radius={5} style={{ marginTop: 8 }} />
        <Skeleton width={190} height={28} radius={7} style={{ marginTop: 8 }} />
        <Skeleton width={210} height={13} radius={5} style={{ marginTop: 10 }} />
      </View>

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
      <Skeleton width={100} height={20} radius={6} style={[styles.pad, { marginTop: 30, marginBottom: 14 }]} />
      <Skeleton width={width - H_PAD * 2} height={HERO_H} radius={24} style={{ marginHorizontal: H_PAD }} />
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={i === 0 ? 18 : 6} height={6} radius={3} />
        ))}
      </View>

      {/* Most visited */}
      <Skeleton width={120} height={20} radius={6} style={[styles.pad, { marginTop: 30, marginBottom: 14 }]} />
      <View style={styles.pad}>
        <Skeleton width="100%" height={185} radius={22} style={{ marginBottom: 12 }} />
        <View style={styles.gridRow}>
          <Skeleton width={CARD_W} height={150} radius={22} />
          <Skeleton width={CARD_W} height={150} radius={22} />
        </View>
      </View>

      <View style={{ height: 150 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 52,
    paddingHorizontal: H_PAD,
    paddingBottom: 10,
  },
  pad:      { paddingHorizontal: H_PAD },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    marginTop: 20,
  },
  dots:    { flexDirection: "row", gap: 5, alignSelf: "center", marginTop: 14 },
  gridRow: { flexDirection: "row", gap: 12 },
});
