/**
 * LeaderboardSkeleton.js
 * Loading bones for Screens/Leaderboard.js, in its shape: the podium (a face
 * on each step, the middle one tallest), then the Rankings header and the
 * rows. The real hero bar stays mounted above it.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import Skeleton from "./Skeleton";
import { useTheme, radius } from "../context/ThemeContext";

// On the cyan hero the theme's bone colour disappears; a white veil reads.
const ON_HERO = { baseColor: "rgba(255,255,255,0.38)", shineColor: "rgba(255,255,255,0.7)" };

// `sizes` is the screen's PODIUM table: { place: { blockH, avatarSz } }.
export function PodiumSkeleton({ sizes }) {
  return (
    <View style={styles.podium} accessibilityLabel="Loading leaderboard">
      {[2, 1, 3].map((place) => {
        const { blockH, avatarSz } = sizes[place];
        const face = avatarSz + 10;
        return (
          <View key={place} style={styles.col}>
            <Skeleton width={face} height={face} radius={face / 2} {...ON_HERO} />
            <Skeleton width={64} height={11} radius={4} style={{ marginTop: 8 }} {...ON_HERO} />
            <Skeleton width={52} height={18} radius={9} style={{ marginTop: 6, marginBottom: 8 }} {...ON_HERO} />
            <Skeleton width="82%" height={blockH} radius={14} style={styles.block} {...ON_HERO} />
          </View>
        );
      })}
    </View>
  );
}

export default function LeaderboardSkeleton() {
  const { colors } = useTheme();
  return (
    <View>
      <View style={styles.header}>
        <Skeleton width={96} height={18} radius={6} />
        <Skeleton width={84} height={11} radius={4} />
      </View>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.row, { borderColor: colors.divider }]}>
          <Skeleton width={30} height={30} radius={15} />
          <Skeleton width={42} height={42} radius={21} />
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton width="75%" height={13} radius={5} />
            <Skeleton width="45%" height={10} radius={4} />
          </View>
          <Skeleton width={64} height={26} radius={13} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-evenly", paddingHorizontal: 14, marginTop: 26 },
  col:    { flex: 1, alignItems: "center" },
  block:  { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, marginBottom: 12 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, height: 56, paddingHorizontal: 10,
    borderWidth: 1, borderRadius: radius.md, marginBottom: 8,
  },
});
