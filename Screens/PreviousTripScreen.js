// screens/PreviousTripsScreen.js
import React, { useEffect, useState, useCallback, useRef } from "react";
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
import { useTheme } from "../context/ThemeContext";

const { width } = Dimensions.get("window");
const BASE_URL  = "https://libotbackend.onrender.com";

export default function PreviousTripsScreen() {
  const navigation   = useNavigation();
  const { getToken } = useAuth();
  const { colors }   = useTheme();

  const [visited, setVisited]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);

  const isFetching = useRef(false);
  const hasLoaded  = useRef(false);

  const loadVisited = useCallback(async (isRefresh = false) => {
    if (isFetching.current) return;
    isFetching.current = true;

    if (!hasLoaded.current) {
      setLoading(true);
    } else if (isRefresh) {
      setRefreshing(true);
    }

    setError(null);

    try {
      const token = await getToken();
      const res   = await fetch(`${BASE_URL}/api/visitlogs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setVisited(Array.isArray(data?.visited) ? data.visited : []);
      hasLoaded.current = true;
    } catch (e) {
      console.warn("PreviousTrips load error:", e);
      setError("Could not load trips. Pull down to retry.");
      if (!hasLoaded.current) setVisited([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => { loadVisited(); }, []);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      if (hasLoaded.current) loadVisited(false);
    });
    return unsub;
  }, [navigation]);

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-PH", {
      month: "long", day: "numeric", year: "numeric",
    });
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("en-PH", {
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  const renderItem = useCallback(({ item, index }) => {
    const spot = item.spot;
    if (!spot) return null;

    return (
      <View style={[styles.card, { backgroundColor: colors.background }]}>
        <View style={styles.imageWrapper}>
          {spot.image ? (
            <Image source={{ uri: spot.image }} style={styles.spotImage} />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.brandLight }]}>
              <Feather name="map-pin" size={28} color={colors.textMuted} />
            </View>
          )}
          <View style={[styles.tripNumberBadge, { backgroundColor: "rgba(107,75,69,0.9)" }]}>
            <Text style={styles.tripNumberText}>#{visited.length - index}</Text>
          </View>
          {spot.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{spot.category}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.spotName, { color: colors.textPrimary }]} numberOfLines={1}>{spot.name}</Text>

          <View style={styles.infoRow}>
            <Feather name="map-pin" size={13} color={colors.brand} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>{spot.location}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={12} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDate(item.visitedAt)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatTime(item.visitedAt)}</Text>
            </View>
          </View>

          <View style={styles.detailsRow}>
            {spot.visitingHours ? (
              <View style={[styles.detailChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Feather name="sun" size={11} color={colors.brand} />
                <Text style={[styles.detailChipText, { color: colors.brand }]}>{spot.visitingHours}</Text>
              </View>
            ) : null}
            {spot.entranceFee ? (
              <View style={[styles.detailChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Feather name="tag" size={11} color={colors.brand} />
                <Text style={[styles.detailChipText, { color: colors.brand }]}>{spot.entranceFee}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  }, [visited.length, colors]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.backgroundHero }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your trips...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundHero }]}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color={colors.brandDark} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.brandDark }]}>Previous Trips</Text>
        <View style={[styles.countPill, { backgroundColor: colors.brand }]}>
          <Text style={[styles.countText, { color: colors.textInverse }]}>{visited.length}</Text>
        </View>
      </View>

      {error ? (
        <TouchableOpacity onPress={() => loadVisited(true)} style={[styles.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
          <Feather name="alert-circle" size={14} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </TouchableOpacity>
      ) : null}

      <FlatList
        data={visited}
        keyExtractor={(item, index) => item._id?.toString() ?? String(index)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        maxToRenderPerBatch={5}
        initialNumToRender={6}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadVisited(true)}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🗺️</Text>
              <Text style={[styles.emptyTitle, { color: colors.brandDark }]}>No trips yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
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

const styles = StyleSheet.create({
  container:   { flex: 1, paddingTop: 50 },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: "500" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  countPill: {
    borderRadius: 20,
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: "center",
  },
  countText: { fontWeight: "700", fontSize: 13 },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, fontWeight: "500", flex: 1 },

  listContent: { paddingHorizontal: 20 },

  card: {
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#4a2e2c",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageWrapper:     { width: "100%", height: 170, position: "relative" },
  spotImage:        { width: "100%", height: "100%", resizeMode: "cover" },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  tripNumberBadge: {
    position: "absolute",
    top: 10,
    left: 10,
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

  cardBody:  { padding: 14 },
  spotName:  { fontSize: 17, fontWeight: "700", marginBottom: 6 },
  infoRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  infoText:  { fontSize: 13, flex: 1 },
  divider:   { height: 1, marginBottom: 10 },
  metaRow:   { flexDirection: "row", gap: 16, marginBottom: 10 },
  metaItem:  { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText:  { fontSize: 12 },
  detailsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  detailChipText: { fontSize: 11, fontWeight: "500" },

  emptyState:    { alignItems: "center", marginTop: 80, paddingHorizontal: 40 },
  emptyEmoji:    { fontSize: 56, marginBottom: 14 },
  emptyTitle:    { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});