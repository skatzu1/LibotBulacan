/**
 * InformationSkeleton.js
 * Matches InformationScreen layout:
 *   • Top header (back btn + title + icons)
 *   • Three tabs
 *   • Hero image
 *   • Title
 *   • Overview tab body (About text + 4 info rows)
 */
import React from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Skeleton, { SkeletonRow } from "./Skeleton";

const { width } = Dimensions.get("window");

export default function InformationSkeleton() {
  return (
    <View style={styles.container}>
      {/* ── Top header ── */}
      <View style={styles.topHeader}>
        <Skeleton width={38} height={38} radius={19} />
        <Skeleton width={160} height={17} radius={6} />
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Skeleton width={38} height={38} radius={19} />
          <Skeleton width={38} height={38} radius={19} />
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabsContainer}>
        {[80, 90, 76].map((w, i) => (
          <Skeleton key={i} width={w} height={38} radius={20} style={{ flex: 1 }} />
        ))}
      </View>

      {/* ── Hero image ── */}
      <Skeleton width={width} height={350} radius={0} />

      {/* ── Body ── */}
      <View style={styles.bodyPad}>
        {/* Title */}
        <Skeleton width={200} height={22} radius={6} style={{ marginBottom: 18 }} />

        {/* "About" heading */}
        <Skeleton width={55} height={14} radius={6} style={{ marginBottom: 10 }} />

        {/* Description lines */}
        <Skeleton width="100%" height={13} radius={6} style={{ marginBottom: 6 }} />
        <Skeleton width="100%" height={13} radius={6} style={{ marginBottom: 6 }} />
        <Skeleton width="75%"  height={13} radius={6} style={{ marginBottom: 16 }} />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Info rows — clock / tag / map-pin / phone */}
        {[1, 2, 3, 4].map((_, i) => (
          <View key={i}>
            <SkeletonRow
              labelWidth={90}
              valueWidth={140}
              height={13}
              style={{ paddingVertical: 9 }}
            />
            {i < 3 && <View style={styles.divider} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: "#fff",
    paddingTop:      50,
  },
  topHeader: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom:  10,
  },
  tabsContainer: {
    flexDirection:    "row",
    paddingHorizontal: 16,
    gap:              8,
    marginBottom:     4,
  },
  bodyPad: {
    paddingHorizontal: 20,
    paddingTop:        18,
  },
  divider: {
    height:          1,
    backgroundColor: "#f0e0de",
    marginVertical:  2,
  },
});
