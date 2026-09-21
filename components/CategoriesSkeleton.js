/**
 * CategoriesSkeleton.js
 * Body-only skeleton for Categories.js. It deliberately does NOT draw a header:
 * Categories now renders the real <ScreenHeader> above this while loading, so a
 * fake one here would double up and then visibly swap.
 *
 * Mirrors the live layout: left-aligned intro block, then a 2-column flex-wrap
 * grid of 168h tiles.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import Skeleton from "./Skeleton";
import { useTheme } from "../context/ThemeContext";
import { useGrid, H_PAD } from "./ui";

export default function CategoriesSkeleton({ count = 4 }) {
  const { colors } = useTheme();
  const { cardW, gap } = useGrid();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityLabel="Loading categories"
    >
      {/* ── Intro block ── */}
      <View style={styles.intro}>
        <Skeleton width={230} height={28} radius={8} style={{ marginBottom: 10 }} />
        <Skeleton width={260} height={14} radius={6} />
      </View>

      {/* ── Section title ── */}
      <Skeleton width={110} height={22} radius={6} style={styles.sectionTitle} />

      {/* ── Grid ── */}
      <View style={[styles.grid, { gap }]}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} width={cardW} height={168} radius={22} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  intro:        { paddingHorizontal: H_PAD, paddingTop: 6 },
  sectionTitle: { marginHorizontal: H_PAD, marginTop: 28, marginBottom: 14 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: H_PAD,
  },
});
