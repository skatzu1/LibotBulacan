/**
 * ListsSkeleton.js
 * Body-only skeleton for Lists.js. Like CategoriesSkeleton it draws NO header —
 * Lists keeps the real <ScreenHeader> mounted while loading so the back button
 * stays available and the title doesn't pop in.
 *
 * Mirrors the live layout: count line, then a stack of full-bleed SpotCards.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import Skeleton from "./Skeleton";
import { useTheme } from "../context/ThemeContext";
import { H_PAD } from "./ui";

export default function ListsSkeleton({ cardCount = 4 }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityLabel="Loading destinations"
    >
      <View style={styles.scrollContent}>
        {/* ── Count line ── */}
        <Skeleton width={130} height={14} radius={6} style={{ marginBottom: 16 }} />

        {/* ── Cards — same 180h full-width shape as the real SpotCard ── */}
        <View style={styles.cardsContainer}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <Skeleton key={i} width="100%" height={180} radius={22} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scrollContent:  { paddingHorizontal: H_PAD, paddingTop: 8 },
  cardsContainer: { gap: 14 },
});
