/**
 * CategoriesSkeleton.js
 * Matches Categories.js layout:
 *   • Header (back + title + avatar)
 *   • Subtitle block (centered text)
 *   • 2-column staggered grid of category cards (48% wide, 220h)
 *     — odd-index cards are offset 20px down, matching the stagger logic
 */
import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Skeleton from "./Skeleton";

const { width } = Dimensions.get("window");
const CARD_W    = (width - 40 - 16) * 0.48;  // 48% of scrollContent width

export default function CategoriesSkeleton({ count = 4 }) {
  const pairs = [];
  for (let i = 0; i < count; i += 2) {
    pairs.push([i, i + 1].filter((n) => n < count));
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Skeleton width={40} height={40} radius={20} />
        <Skeleton width={80} height={20} radius={6} />
        <Skeleton width={42} height={42} radius={21} />
      </View>

      <View style={styles.scrollContent}>
        {/* ── Subtitle block ── */}
        <View style={styles.subtitleContainer}>
          <Skeleton width={200} height={24} radius={6} style={{ marginBottom: 10 }} />
          <Skeleton width={240} height={14} radius={6} style={{ marginBottom: 4 }} />
          <Skeleton width={180} height={14} radius={6} />
        </View>

        {/* ── Grid ── */}
        <View style={styles.gridContainer}>
          {pairs.map((pair, rowIdx) => (
            <View key={rowIdx} style={styles.gridRow}>
              {pair.map((cardIdx) => (
                <Skeleton
                  key={cardIdx}
                  width={CARD_W}
                  height={220}
                  radius={20}
                  style={{
                    marginTop:   cardIdx % 2 !== 0 ? 20 : 0,
                    marginBottom: 20,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
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
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    paddingHorizontal: 20,
    marginBottom:   20,
  },
  scrollContent:    { paddingHorizontal: 20 },
  subtitleContainer: {
    marginBottom: 28,
    alignItems:   "center",
  },
  gridContainer: {
    width: "100%",
  },
  gridRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    width:          "100%",
  },
});
