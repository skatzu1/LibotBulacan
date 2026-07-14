/**
 * HomeSkeleton.js
 * Matches HomeContent layout in Home.js:
 *   • Hero block (carousel height)
 *   • Spot info card (name + visits badge + location + stars)
 *   • "Top Cities" section heading
 *   • Grid — 1 wide card + N half-width cards
 */
import React from "react";
import { View, StyleSheet, Dimensions, ScrollView } from "react-native";
import Skeleton from "./Skeleton";

const { width, height } = Dimensions.get("window");
const HERO_H   = height * 0.40;
const CARD_W   = (width - 54) / 2;   // matches h.gridCard in Home.js

export default function HomeSkeleton() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {/* ── Hero ── */}
      <Skeleton
        width={width}
        height={HERO_H}
        radius={0}
        style={styles.hero}
      />

      {/* Floating header placeholder sits on top */}
      <View style={styles.heroHeaderOverlay}>
        <Skeleton width={22} height={14} radius={3} />
        <Skeleton width={40} height={40} radius={8} />
        <Skeleton width={42} height={42} radius={21} />
      </View>

      {/* Explore button placeholder */}
      <View style={styles.heroExplorePlaceholder}>
        <Skeleton width={130} height={38} radius={24} />
      </View>

      {/* ── Spot info card ── */}
      <View style={styles.infoCard}>
        {/* Row 1: spot name + visits badge */}
        <View style={styles.infoRow}>
          <Skeleton width={180} height={22} radius={6} />
          <Skeleton width={80}  height={24} radius={20} />
        </View>
        {/* Row 2: location + stars */}
        <View style={styles.infoRow}>
          <Skeleton width={120} height={13} radius={6} />
          <Skeleton width={72}  height={13} radius={6} />
        </View>
      </View>

      {/* ── Top Cities ── */}
      <View style={styles.section}>
        {/* Section heading */}
        <Skeleton width={110} height={17} radius={6} style={{ marginBottom: 14 }} />

        {/* Grid: wide card first */}
        <Skeleton width="100%" height={175} radius={18} style={{ marginBottom: 10 }} />

        {/* Two half-width cards */}
        <View style={styles.gridRow}>
          <Skeleton width={CARD_W} height={140} radius={18} />
          <Skeleton width={CARD_W} height={140} radius={18} />
        </View>

        {/* Another two */}
        <View style={[styles.gridRow, { marginTop: 10 }]}>
          <Skeleton width={CARD_W} height={140} radius={18} />
          <Skeleton width={CARD_W} height={140} radius={18} />
        </View>
      </View>

      <View style={{ height: 160 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderBottomLeftRadius:  30,
    borderBottomRightRadius: 30,
  },

  // Floats over the hero — mirrors h.heroHeader position
  heroHeaderOverlay: {
    position:       "absolute",
    top:            50,
    left:           0,
    right:          0,
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    paddingHorizontal: 20,
  },

  heroExplorePlaceholder: {
    position: "absolute",
    bottom:   HERO_H - (HERO_H - 10),   // mirrors heroExploreBtn bottom:10
    right:    22,
  },

  infoCard: {
    paddingHorizontal: 22,
    paddingTop:        18,
    paddingBottom:     6,
    gap:               10,
  },
  infoRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },

  section:  { paddingHorizontal: 22, marginTop: 20 },
  gridRow:  { flexDirection: "row", gap: 10 },
});
