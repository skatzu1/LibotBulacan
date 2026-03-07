// screens/BadgeScreen.js
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - 60) / 3;
const BASE_URL  = "https://libotbackend.onrender.com";

export default function BadgeScreen() {
  const navigation   = useNavigation();
  const { getToken } = useAuth();

  const [badges, setBadges]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);

  const fadeAnims = useRef([]).current;

  /* ── Fetch badges ── */
  const loadBadges = async () => {
    setError(null);
    try {
      const token = await getToken();
      const res   = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch profile");

      const data     = await res.json();
      const dbBadges = data?.user?.badges ?? [];

      setBadges(dbBadges);

      while (fadeAnims.length < dbBadges.length) {
        fadeAnims.push(new Animated.Value(0));
      }
      dbBadges.forEach((_, i) => {
        fadeAnims[i].setValue(0);
        Animated.timing(fadeAnims[i], {
          toValue: 1, duration: 350, delay: i * 70, useNativeDriver: true,
        }).start();
      });
    } catch (e) {
      console.warn("BadgeScreen load error:", e);
      setError("Could not load badges. Pull down to retry.");
    }
  };

  const initialLoad = async () => {
    setLoading(true);
    await loadBadges();
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBadges();
    setRefreshing(false);
  };

  useEffect(() => {
    initialLoad();
    const unsub = navigation.addListener("focus", initialLoad);
    return unsub;
  }, [navigation]);

  /* ── Loading ── */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6b4b45" />
        <Text style={styles.loadingText}>Loading badges...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#4a2e2c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Badges</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{badges.length} earned</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6b4b45"
            colors={["#6b4b45"]}
          />
        }
      >
        {error && (
          <TouchableOpacity onPress={onRefresh} style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* Empty state */}
        {!error && badges.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏅</Text>
            <Text style={styles.emptyTitle}>No badges yet</Text>
            <Text style={styles.emptySubtitle}>
              Navigate to a historical spot and arrive to earn your first badge!
            </Text>
          </View>
        )}

        {/* Badge grid */}
        {badges.length > 0 && (
          <View style={styles.grid}>
            {badges.map((badge, index) => (
              <Animated.View
                key={badge.spotId}
                style={[styles.badgeWrapper, { opacity: fadeAnims[index] ?? 1 }]}
              >
                <View style={styles.badgeCard}>
                  <View style={styles.iconCircle}>
                    {badge.image ? (
                      <Image source={{ uri: badge.image }} style={styles.badgeImage} />
                    ) : (
                      <Feather name="award" size={26} color="#6b4b45" />
                    )}
                    <View style={styles.checkOverlay}>
                      <Feather name="check-circle" size={16} color="#6b4b45" />
                    </View>
                  </View>

                  <Text style={styles.badgeName} numberOfLines={3}>
                    {badge.name}
                  </Text>

                  {badge.claimedAt && (
                    <Text style={styles.claimedDate}>
                      {new Date(badge.claimedAt).toLocaleDateString("en-PH", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </Text>
                  )}
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f7cfc9", paddingTop: 50 },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f7cfc9" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#7a5a58", fontWeight: "500" },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#4a2e2c" },
  countBadge:  {
    backgroundColor: "#6b4b45",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 15 },

  // ── Error ──
  errorBanner: {
    backgroundColor: "#fde8e6",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f4c0bc",
  },
  errorText: { fontSize: 13, color: "#c0392b", fontWeight: "600", textAlign: "center" },
  retryText: { fontSize: 12, color: "#c0392b", marginTop: 4 },

  // ── Empty state ──
  emptyState:    { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyEmoji:    { fontSize: 56, marginBottom: 14 },
  emptyTitle:    { fontSize: 18, fontWeight: "700", color: "#4a2e2c", marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: "#7a5a58", textAlign: "center", lineHeight: 19 },

  // ── Badge grid ──
  grid:         { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  badgeWrapper: { width: CARD_SIZE, marginBottom: 16 },
  badgeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    shadowColor: "#4a2e2c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 120,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#faf5f4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#f0e0de",
    position: "relative",
  },
  badgeImage:   { width: 44, height: 44, borderRadius: 22, resizeMode: "cover" },
  checkOverlay: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  badgeName: {
    fontSize: 10,
    fontWeight: "600",
    color: "#4a2e2c",
    textAlign: "center",
    lineHeight: 13,
  },
  claimedDate: {
    fontSize: 9,
    color: "#b0908c",
    marginTop: 4,
    textAlign: "center",
  },
});