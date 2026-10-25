/**
 * AchievementsSkeleton.js
 * Body-only skeleton for BadgeScreen.js (Achievements). Like ListsSkeleton it
 * draws NO header: the real <ScreenHeader> stays mounted while loading.
 *
 * Mirrors the live layout: the summary card (title, next title, bar, counts),
 * the four tabs, the search field, then the open tab — spot badge cards, the
 * bigger municipality / district cards (Districts: under the wide Bulacan
 * card), or title rows.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import Skeleton from "./Skeleton";
import { useTheme, radius } from "../context/ThemeContext";
import { GRID_GAP, H_GUTTER } from "./Grid";

export default function AchievementsSkeleton({ tab = "spots", columns, cardSize, cardHeight, townCols, townSize }) {
  const { colors } = useTheme();
  const grid = tab === "towns" || tab === "districts";
  const perRow = tab === "spots" ? columns : townCols;
  const rows = tab === "spots" ? 3 : 2;

  return (
    <View style={styles.container} accessibilityLabel="Loading achievements">
      {/* ── Summary card ── */}
      <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.summaryTop}>
          <View style={{ flex: 1 }}>
            <Skeleton width={96} height={20} radius={10} />
            <Skeleton width="80%" height={24} radius={7} style={{ marginTop: 9 }} />
            <Skeleton width="62%" height={13} radius={5} style={{ marginTop: 8 }} />
          </View>
          <Skeleton width={64} height={64} radius={32} />
        </View>
        <Skeleton width="100%" height={6} radius={3} style={{ marginTop: 16 }} />
        <View style={styles.stats}>
          <Skeleton width={84} height={13} radius={5} />
          <Skeleton width={96} height={13} radius={5} />
          <Skeleton width={70} height={13} radius={5} />
        </View>
      </View>

      {/* ── Tabs and search ── */}
      <Skeleton width="100%" height={50} radius={radius.pill} style={{ marginBottom: 12 }} />
      {tab !== "titles" && <Skeleton width="100%" height={46} radius={radius.pill} style={{ marginBottom: 14 }} />}

      {/* ── The open tab ── */}
      {tab === "districts" && <Skeleton width="100%" height={132} radius={20} style={{ marginBottom: 14 }} />}
      {tab === "titles" ? (
        Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={[styles.titleRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Skeleton width={56} height={56} radius={28} />
            <View style={{ flex: 1 }}>
              <Skeleton width={48} height={10} radius={4} />
              <Skeleton width="70%" height={20} radius={6} style={{ marginTop: 6 }} />
              <Skeleton width="90%" height={12} radius={5} style={{ marginTop: 7 }} />
            </View>
          </View>
        ))
      ) : (
        Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: perRow }).map((__, c) => (
              grid
                ? <Skeleton key={c} width={townSize} height={186} radius={20} />
                : <Skeleton key={c} width={cardSize} height={cardHeight} radius={16} />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { paddingHorizontal: H_GUTTER / 2, paddingTop: 8 },
  summary:    { borderRadius: radius.card, borderWidth: 1, padding: 16, marginBottom: 16 },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  stats:      { flexDirection: "row", gap: 18, marginTop: 14 },
  row:        { flexDirection: "row", gap: GRID_GAP, marginBottom: GRID_GAP },
  titleRow:   { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radius.card, borderWidth: 1, marginBottom: 12 },
});
