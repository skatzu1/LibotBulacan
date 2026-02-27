import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MISSION_CONFIGS } from './Mission';

// ─── MissionsScreen ───────────────────────────────────────────────────────────
// Hub screen that lists all missions as tappable cards.
// Tapping a card navigates to the Mission screen for that mission.
//
// 1. Register both screens in your navigator:
//      <Stack.Screen name="Missions" component={MissionsScreen} />
//      <Stack.Screen name="Mission"  component={Mission} />
//
// 2. Navigate to the hub (instead of directly to Mission):
//      navigation.navigate('Missions', { spot })
//
export default function MissionsScreen({ navigation, route }) {
  const { spot } = route.params ?? {};
  const missions = Object.values(MISSION_CONFIGS);

  // One animated value per card for staggered entrance
  const anims = useRef(missions.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      120,
      anims.map(a =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 })
      )
    ).start();
  }, []);

  const launchMission = (missionId) => {
    navigation.navigate('Mission', { spot, missionId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="chevron-left" size={26} color="#4a4a4a" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Daily Missions</Text>
            <Text style={styles.headerSub}>Complete tasks to earn rewards</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Spot Badge ── */}
        {spot?.name && (
          <View style={styles.spotBadge}>
            <Feather name="map-pin" size={13} color="#6b4b45" />
            <Text style={styles.spotBadgeText}>{spot.name}</Text>
          </View>
        )}

        {/* ── Progress Summary ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{missions.length}</Text>
            <Text style={styles.summaryLabel}>Available</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>0</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>🏆</Text>
            <Text style={styles.summaryLabel}>Rewards</Text>
          </View>
        </View>

        {/* ── Section Label ── */}
        <Text style={styles.sectionLabel}>AVAILABLE TODAY</Text>

        {/* ── Mission Cards ── */}
        {missions.map((config, i) => (
          <Animated.View
            key={config.id}
            style={{
              opacity: anims[i],
              transform: [
                {
                  translateY: anims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
              width: '100%',
            }}
          >
            <TouchableOpacity
              style={styles.missionCard}
              onPress={() => launchMission(config.id)}
              activeOpacity={0.85}
            >
              {/* Top colored accent strip */}
              <View style={[styles.cardAccent, { backgroundColor: config.accentColor }]} />

              <View style={styles.cardBody}>
                {/* Left: emoji + info */}
                <View style={styles.cardLeft}>
                  <View style={[styles.emojiCircle, { backgroundColor: config.accentColor + '20' }]}>
                    <Text style={styles.cardEmoji}>{config.emoji}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{config.title}</Text>
                    <Text style={styles.cardProduct}>{config.product}</Text>
                    <View style={styles.tagRow}>
                      <View style={[styles.tag, { backgroundColor: config.accentColor + '18' }]}>
                        <Text style={[styles.tagText, { color: config.accentColor }]}>
                          Scan to verify
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Right: arrow button */}
                <View style={[styles.arrowCircle, { backgroundColor: config.accentColor }]}>
                  <Feather name="chevron-right" size={20} color="white" />
                </View>
              </View>

              {/* Bottom hint strip */}
              <View style={styles.hintStrip}>
                <Feather name="info" size={12} color="#999" style={{ marginRight: 5 }} />
                <Text style={styles.hintStripText} numberOfLines={1}>{config.hint}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7cfc9' },
  scroll: { padding: 20, alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#3a2a28', textAlign: 'center' },
  headerSub: { fontSize: 13, color: '#a07060', textAlign: 'center', marginTop: 2 },

  spotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
    gap: 5,
  },
  spotBadgeText: { fontSize: 13, color: '#6b4b45', fontWeight: '600' },

  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#6b4b45',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    marginBottom: 22,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center' },
  summaryNum: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  summaryLabel: { fontSize: 12, color: '#f7cfc9', marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)' },

  sectionLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: '#a07060',
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  missionCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    width: '100%',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#6b4b45',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardAccent: { height: 4, width: '100%' },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  emojiCircle: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardEmoji: { fontSize: 28 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#3a2a28', marginBottom: 2 },
  cardProduct: { fontSize: 13, color: '#888', marginBottom: 6 },
  tagRow: { flexDirection: 'row', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagText: { fontSize: 11, fontWeight: '600' },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  hintStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf6f5',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#f0e8e6',
  },
  hintStripText: { fontSize: 12, color: '#aaa', flex: 1 },
});