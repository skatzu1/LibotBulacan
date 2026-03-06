// screens/PreviousTripsScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";

const { width } = Dimensions.get("window");
const BASE_URL  = "https://libotbackend.onrender.com";

export default function PreviousTripsScreen() {
  const navigation   = useNavigation();
  const { getToken } = useAuth();

  const [visited, setVisited]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);

  /* ── Fetch visited spots ── */
  const loadVisited = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const res   = await fetch(`${BASE_URL}/api/users/me/visited`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      setVisited(Array.isArray(data.visited) ? data.visited : []);
    } catch (e) {
      console.warn("PreviousTrips load error:", e);
      setError("Could not load trips. Pull down to retry.");
      setVisited([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadVisited();
    const unsub = navigation.addListener("focus", () => loadVisited());
    return unsub;
  }, [navigation, loadVisited]);

  /* ── Format date ── */
  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-PH", {
      month: "long",
      day:   "numeric",
      year:  "numeric",
    });
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("en-PH", {
      hour:   "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  /* ── Card ── */
  const renderItem = ({ item, index }) => {
    const spot = item.spot;
    if (!spot) return null;

    return (
      <View style={styles.card}>
        {/* Spot image */}
        <View style={styles.imageWrapper}>
          {spot.image ? (
            <Image source={{ uri: spot.image }} style={styles.spotImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Feather name="map-pin" size={28} color="#c4a4a0" />
            </View>
          )}
          {/* Trip number badge */}
          <View style={styles.tripNumberBadge}>
            <Text style={styles.tripNumberText}>#{visited.length - index}</Text>
          </View>
          {/* Category pill */}
          {spot.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{spot.category}</Text>
            </View>
          ) : null}
        </View>

        {/* Info */}
        <View style={styles.cardBody}>
          <Text style={styles.spotName} numberOfLines={1}>{spot.name}</Text>

          <View style={styles.infoRow}>
            <Feather name="map-pin" size={13} color="#8b4440" />
            <Text style={styles.infoText} numberOfLines={1}>{spot.location}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={12} color="#6a5a5a" />
              <Text style={styles.metaText}>{formatDate(item.visitedAt)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color="#6a5a5a" />
              <Text style={styles.metaText}>{formatTime(item.visitedAt)}</Text>
            </View>
          </View>

          {/* Extra details row */}
          <View style={styles.detailsRow}>
            {spot.visitingHours ? (
              <View style={styles.detailChip}>
                <Feather name="sun" size={11} color="#8b4440" />
                <Text style={styles.detailChipText}>{spot.visitingHours}</Text>
              </View>
            ) : null}
            {spot.entranceFee ? (
              <View style={styles.detailChip}>
                <Feather name="tag" size={11} color="#8b4440" />
                <Text style={styles.detailChipText}>{spot.entranceFee}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8b4440" />
        <Text style={styles.loadingText}>Loading your trips...</Text>
      </View>
    );
  }

  /* ── Main render ── */
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#5a3a38" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Previous Trips</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{visited.length}</Text>
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <TouchableOpacity onPress={() => loadVisited()} style={styles.errorBanner}>
          <Feather name="alert-circle" size={14} color="#8b4440" />
          <Text style={styles.errorText}>{error}</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={visited}
        keyExtractor={(item) => item._id?.toString() ?? Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadVisited(true)}
            tintColor="#8b4440"
            colors={["#8b4440"]}
          />
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🗺️</Text>
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptySubtitle}>
                Start navigating to a spot — arriving there will log it as a trip!
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
    </View>
  );
}

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5c4c1", paddingTop: 50 },
  centered:  { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5c4c1" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6a5a5a", fontWeight: "500" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#4a2e2c" },
  countPill: {
    backgroundColor: "#8b4440",
    borderRadius: 20,
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: "center",
  },
  countText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fce8e6",
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e8b8b4",
  },
  errorText: { fontSize: 13, color: "#8b4440", fontWeight: "500", flex: 1 },

  listContent: { paddingHorizontal: 20 },

  /* Card */
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#8b4440",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  imageWrapper: {
    width: "100%",
    height: 170,
    position: "relative",
  },
  spotImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0e0de",
    justifyContent: "center",
    alignItems: "center",
  },
  tripNumberBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(139,68,64,0.9)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tripNumberText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  categoryPill: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { color: "#fff", fontSize: 11, fontWeight: "600" },

  cardBody: { padding: 14 },

  spotName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#4a2e2c",
    marginBottom: 6,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  infoText: { fontSize: 13, color: "#6a5a5a", flex: 1 },

  divider: { height: 1, backgroundColor: "#f0e0de", marginBottom: 10 },

  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, color: "#6a5a5a" },

  detailsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fce8e6",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailChipText: { fontSize: 11, color: "#8b4440", fontWeight: "500" },

  /* Empty */
  emptyState: { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#4a2e2c", marginBottom: 6 },
  emptySubtitle: {
    fontSize: 13,
    color: "#6a5a5a",
    textAlign: "center",
    lineHeight: 19,
  },
});