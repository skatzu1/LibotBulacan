/**
 * InformationSkeleton.js — mirrors the modern InformationScreen layout:
 *   • Header (circular back + title + circular actions)
 *   • Inset rounded hero card
 *   • Sticky segmented tab track
 *   • Title + About text + grouped info card
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, radius } from "../context/ThemeContext";
import Skeleton, { SkeletonRow } from "./Skeleton";

export default function InformationSkeleton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.divider }]}>
        <Skeleton width={38} height={38} radius={19} />
        <Skeleton width={150} height={16} radius={6} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Skeleton width={38} height={38} radius={19} />
        </View>
      </View>

      {/* Hero card */}
      <View style={styles.heroWrap}>
        <Skeleton width="100%" height={288} radius={radius.xl} />
      </View>

      {/* Segmented tabs */}
      <View style={styles.segmentWrap}>
        <Skeleton width="100%" height={44} radius={999} />
      </View>

      {/* Body */}
      <View style={styles.bodyPad}>
        <Skeleton width={200} height={22} radius={6} style={{ marginBottom: 16 }} />
        <Skeleton width={60} height={14} radius={6} style={{ marginBottom: 10 }} />
        <Skeleton width="100%" height={13} radius={6} style={{ marginBottom: 6 }} />
        <Skeleton width="100%" height={13} radius={6} style={{ marginBottom: 6 }} />
        <Skeleton width="72%"  height={13} radius={6} style={{ marginBottom: 18 }} />

        <View style={[styles.infoCard, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
          {[1, 2, 3, 4].map((_, i) => (
            <View key={i}>
              <SkeletonRow labelWidth={90} valueWidth={130} height={13} style={{ paddingVertical: 12 }} />
              {i < 3 && <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  heroWrap:    { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  segmentWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  bodyPad:     { paddingHorizontal: 22, paddingTop: 10 },
  infoCard:    { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: 16 },
  divider:     { height: 1 },
});
