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
  Modal,
  Share,
  StatusBar,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const { width, height } = Dimensions.get("window");
const CARD_SIZE = (width - 60) / 3;
const BASE_URL  = "https://libotbackend.onrender.com";

export default function BadgeScreen() {
  const navigation   = useNavigation();
  const { getToken } = useAuth();

  const [badges, setBadges]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState(null);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [modalVisible, setModalVisible]   = useState(false);

  // Modal animation values
  const modalOpacity   = useRef(new Animated.Value(0)).current;
  const modalScale     = useRef(new Animated.Value(0.85)).current;
  const modalTranslate = useRef(new Animated.Value(40)).current;

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

  /* ── Modal helpers ── */
  const openBadge = (badge) => {
    setSelectedBadge(badge);
    setModalVisible(true);
    modalOpacity.setValue(0);
    modalScale.setValue(0.85);
    modalTranslate.setValue(40);

    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 1, duration: 300, useNativeDriver: true,
      }),
      Animated.spring(modalScale, {
        toValue: 1, tension: 120, friction: 9, useNativeDriver: true,
      }),
      Animated.timing(modalTranslate, {
        toValue: 0, duration: 300, useNativeDriver: true,
      }),
    ]).start();
  };

  const closeBadge = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }),
      Animated.timing(modalScale, {
        toValue: 0.9, duration: 200, useNativeDriver: true,
      }),
      Animated.timing(modalTranslate, {
        toValue: 30, duration: 200, useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      setSelectedBadge(null);
    });
  };

  const handleShare = async () => {
    if (!selectedBadge) return;
    try {
      if (selectedBadge.image) {
        const cleanUrl = selectedBadge.image.split("?")[0];
        const rawExt   = cleanUrl.split(".").pop()?.toLowerCase();
        const ext      = ["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt) ? rawExt : "jpg";
        const mimeType = ext === "png" ? "image/png" : "image/jpeg";
        const localUri = `${FileSystem.cacheDirectory}badge_${selectedBadge.spotId}.${ext}`;

        console.log("[Share] Downloading image from:", selectedBadge.image);
        const download = await FileSystem.downloadAsync(selectedBadge.image, localUri);
        console.log("[Share] Download result:", download);

        console.log("[Share] Sharing file at:", download.uri);
        await Sharing.shareAsync(download.uri, {
          mimeType,
          dialogTitle: `Share "${selectedBadge.name}" badge`,
          UTI: ext === "png" ? "public.png" : "public.jpeg",
        });
        return;
      }
    } catch (e) {
      console.warn("[Share] Image share failed:", e);
    }

    // Fallback: text-only
    const message = selectedBadge.description
      ? `🏅 I just earned the "${selectedBadge.name}" badge!\n\n${selectedBadge.description}\n\nDiscover history with Libot!`
      : `🏅 I just earned the "${selectedBadge.name}" badge on Libot! Discover history around you!`;

    await Share.share({ title: `Badge: ${selectedBadge.name}`, message });
  };

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
      <StatusBar barStyle="dark-content" />

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
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => openBadge(badge)}
                  style={styles.badgeTouchable}
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
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Badge Detail Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeBadge}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
          <Pressable style={styles.modalBackdrop} onPress={closeBadge} />

          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: modalOpacity,
                transform: [
                  { scale: modalScale },
                  { translateY: modalTranslate },
                ],
              },
            ]}
          >
            {/* Close button */}
            <TouchableOpacity style={styles.modalClose} onPress={closeBadge}>
              <Feather name="x" size={20} color="#7a5a58" />
            </TouchableOpacity>

            {/* Badge image / icon */}
            <View style={styles.modalIconRing}>
              <View style={styles.modalIconInner}>
                {selectedBadge?.image ? (
                  <Image
                    source={{ uri: selectedBadge.image }}
                    style={styles.modalBadgeImage}
                  />
                ) : (
                  <Feather name="award" size={52} color="#6b4b45" />
                )}
              </View>

              {/* Sparkle dots */}
              {[...Array(6)].map((_, i) => {
                const angle = (i / 6) * 2 * Math.PI;
                const r = 68;
                return (
                  <View
                    key={i}
                    style={[
                      styles.sparkleDot,
                      {
                        left: 70 + r * Math.cos(angle) - 4,
                        top:  70 + r * Math.sin(angle) - 4,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* Earned label */}
            <View style={styles.earnedPill}>
              <Feather name="check-circle" size={11} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.earnedPillText}>Badge Earned</Text>
            </View>

            {/* Badge name */}
            <Text style={styles.modalBadgeName}>{selectedBadge?.name}</Text>

            {/* Description */}
            {selectedBadge?.description ? (
              <Text style={styles.modalDescription}>{selectedBadge.description}</Text>
            ) : (
              <Text style={styles.modalDescriptionFallback}>
                You visited this historical spot and claimed your badge. Keep exploring to discover more!
              </Text>
            )}

            {/* Claimed date */}
            {selectedBadge?.claimedAt && (
              <View style={styles.modalDateRow}>
                <Feather name="calendar" size={12} color="#b0908c" />
                <Text style={styles.modalDate}>
                  {" "}Claimed on{" "}
                  {new Date(selectedBadge.claimedAt).toLocaleDateString("en-PH", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </Text>
              </View>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Share button */}
            <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.82}>
              <Feather name="share-2" size={17} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.shareButtonText}>Share This Badge</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
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
  grid:           { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  badgeWrapper:   { width: CARD_SIZE, marginBottom: 16 },
  badgeTouchable: { flex: 1 },
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

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(40, 20, 18, 0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: width - 48,
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 28,
    alignItems: "center",
    shadowColor: "#2c1210",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 18,
  },
  modalClose: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f5eeee",
    justifyContent: "center",
    alignItems: "center",
  },

  // Sparkle ring
  modalIconRing: {
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
  },
  modalIconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#faf0ef",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#f0d8d5",
    shadowColor: "#6b4b45",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalBadgeImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    resizeMode: "cover",
  },
  sparkleDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e8b4ae",
    opacity: 0.7,
  },

  // Earned pill
  earnedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6b4b45",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  earnedPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  modalBadgeName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#3a1f1d",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  modalDescription: {
    fontSize: 13,
    color: "#6b5250",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 10,
  },
  modalDescriptionFallback: {
    fontSize: 13,
    color: "#9a7a78",
    textAlign: "center",
    lineHeight: 20,
    fontStyle: "italic",
    marginBottom: 10,
  },

  modalDateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 4,
  },
  modalDate: {
    fontSize: 11,
    color: "#b0908c",
    fontWeight: "500",
  },

  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#f0e0de",
    marginVertical: 20,
  },

  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6b4b45",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    shadowColor: "#6b4b45",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});