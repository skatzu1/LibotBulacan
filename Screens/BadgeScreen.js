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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - 60) / 3;
const BASE_URL  = "https://libotbackend.onrender.com";

/* ─────────────────────────────────────────────
   BadgeScreen
   Fetches the user's claimed badges from MongoDB.
   Each badge is { spotId, name, image, claimedAt }.
   No local ALL_BADGES list needed — everything comes from the DB.
───────────────────────────────────────────── */
export default function BadgeScreen() {
  const navigation = useNavigation();
  const { getToken } = useAuth();

  const [badges, setBadges]     = useState([]);   // array of { spotId, name, image, claimedAt }
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const fadeAnims = useRef([]).current;

  /* ── Fetch badges from DB ── */
  const loadBadges = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res   = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch profile");

      const data   = await res.json();
      const dbBadges = data?.user?.badges ?? [];

      setBadges(dbBadges);

      // Build fade-in animations for however many badges came back
      while (fadeAnims.length < dbBadges.length) {
        fadeAnims.push(new Animated.Value(0));
      }

      dbBadges.forEach((_, i) => {
        fadeAnims[i].setValue(0);
        Animated.timing(fadeAnims[i], {
          toValue: 1,
          duration: 350,
          delay: i * 70,
          useNativeDriver: true,
        }).start();
      });
    } catch (e) {
      console.warn("BadgeScreen load error:", e);
      setError("Could not load badges. Pull down to retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBadges();
    const unsub = navigation.addListener("focus", loadBadges);
    return unsub;
  }, [navigation]);

  /* ── Render states ── */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8b4440" />
        <Text style={styles.loadingText}>Loading badges...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#5a3a38" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Badges</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{badges.length} earned</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onRefresh={loadBadges}
      >
        {error && (
          <TouchableOpacity onPress={loadBadges} style={styles.errorBanner}>
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
                      <Image
                        source={{ uri: badge.image }}
                        style={styles.badgeImage}
                      />
                    ) : (
                      <Feather name="award" size={26} color="#8b4440" />
                    )}
                    <View style={styles.checkOverlay}>
                      <Feather name="check-circle" size={16} color="#8b4440" />
                    </View>
                  </View>

                  <Text style={styles.badgeName} numberOfLines={3}>
                    {badge.name}
                  </Text>

                  {badge.claimedAt && (
                    <Text style={styles.claimedDate}>
                      {new Date(badge.claimedAt).toLocaleDateString("en-PH", {
                        month: "short",
                        day:   "numeric",
                        year:  "numeric",
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

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f5c4c1", paddingTop: 50 },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5c4c1" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6a5a5a", fontWeight: "500" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#4a2e2c" },
  countBadge:  { backgroundColor: "#8b4440", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  countText:   { color: "#fff", fontWeight: "700", fontSize: 13 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 15 },

  errorBanner: {
    backgroundColor: "#fce8e6",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e8b8b4",
  },
  errorText: { fontSize: 13, color: "#8b4440", fontWeight: "600", textAlign: "center" },
  retryText: { fontSize: 12, color: "#8b4440", marginTop: 4 },

  emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyEmoji: { fontSize: 56, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#4a2e2c", marginBottom: 6 },
  emptySubtitle: {
    fontSize: 13,
    color: "#6a5a5a",
    textAlign: "center",
    lineHeight: 19,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

  badgeWrapper: { width: CARD_SIZE, marginBottom: 16 },

  badgeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    shadowColor: "#8b4440",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 120,
  },

  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fce8e6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#e8b8b4",
    position: "relative",
  },

  badgeImage: { width: 44, height: 44, borderRadius: 22, resizeMode: "cover" },

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
    color: "#aaa",
    marginTop: 4,
    textAlign: "center",
  },
});