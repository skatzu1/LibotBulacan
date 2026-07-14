/**
 * ListsSkeleton.js
 * Matches Lists.js layout:
 *   • Header (back + title + search icon)
 *   • Info bar (count text)
 *   • Vertical stack of destination cards (image + content block)
 */
import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Skeleton from "./Skeleton";

const { width } = Dimensions.get("window");
const CARD_W    = width - 40;  // matches scrollContent paddingHorizontal:20

// Single card skeleton — mirrors DestinationCard
function CardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Image area */}
      <Skeleton width={CARD_W} height={160} radius={0} />

      {/* Bookmark button overlay */}
      <View style={styles.bookmarkPlaceholder}>
        <Skeleton width={36} height={36} radius={18} />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <Skeleton width="70%" height={17} radius={6} style={{ marginBottom: 8 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Skeleton width={12} height={12} radius={6} />
          <Skeleton width={120} height={12} radius={6} />
        </View>
      </View>
    </View>
  );
}

export default function ListsSkeleton({ cardCount = 4 }) {
  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Skeleton width={40} height={40} radius={20} />
        <Skeleton width={140} height={20} radius={6} />
        <Skeleton width={40} height={40} radius={20} />
      </View>

      <View style={styles.scrollContent}>
        {/* ── Info bar ── */}
        <View style={styles.infoContainer}>
          <Skeleton width={130} height={14} radius={6} />
        </View>

        {/* ── Cards ── */}
        <View style={styles.cardsContainer}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <CardSkeleton key={i} />
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
    marginBottom:   16,
  },
  scrollContent:  { paddingHorizontal: 20 },
  infoContainer:  { marginBottom: 14 },
  cardsContainer: { gap: 14 },

  card: {
    backgroundColor: "#faf5f4",
    borderRadius:    16,
    overflow:        "hidden",
    position:        "relative",
  },
  bookmarkPlaceholder: {
    position: "absolute",
    top:      12,
    right:    12,
    zIndex:   10,
  },
  cardContent: { padding: 14 },
});
