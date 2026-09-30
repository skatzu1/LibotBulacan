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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useTheme, fonts, typography, radius } from "../context/ThemeContext";
import { ScreenHeader, EmptyState, ErrorState, LoadingState, PrimaryButton, H_PAD } from "../components/ui";
// Was a hardcoded "https://libotbackend.onrender.com".
import { BASE_URL } from "../api";
import { spotImage } from "../utils/image";
import { useArrival } from "../context/ArrivalContext";
import Icon from "../components/Icon";

export default function PreviousTripsScreen() {
  const navigation   = useNavigation();
  const insets       = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { colors }   = useTheme();
  const { allSpots } = useArrival();

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
      setError("Couldn't load your trips. Check your connection.");
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
    // Spot.category is an array in the schema; rendering it raw ran the names
    // together ("ReligiousHistorical").
    const category = Array.isArray(spot.category) ? spot.category.join(" · ") : spot.category;
    // The visit log only populates a handful of fields. Open the detail page
    // with the full spot (description, 3D model…) when we have it.
    const fullSpot = allSpots.find((s) => s._id === spot._id) || spot;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        activeOpacity={0.88}
        onPress={() => navigation.navigate("InformationScreen", { spot: fullSpot })}
        accessibilityRole="button"
        accessibilityLabel={`Trip ${visited.length - index}: ${spot.name}, ${formatDate(item.visitedAt)}`}
        accessibilityHint="Opens the spot details"
      >
        <View style={styles.imageWrapper}>
          {spot.image ? (
            <Image source={{ uri: spotImage(spot.image, 400, 170) }} style={styles.spotImage} />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.brandLight }]}>
              <Icon name="map-pin" size={28} color={colors.textMuted} />
            </View>
          )}
          {/* Was a hardcoded brown rgba(107,75,69) — the last of the old
              terracotta palette. Now the same dark photo chip as the category. */}
          <View style={styles.photoChip}>
            <Text style={styles.photoChipText}>#{visited.length - index}</Text>
          </View>
          {category ? (
            <View style={[styles.photoChip, styles.photoChipRight]}>
              <Text style={styles.photoChipText} numberOfLines={1}>{category}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.spotName, { color: colors.textPrimary }]} numberOfLines={1}>{spot.name}</Text>

          <View style={styles.infoRow}>
            <Icon name="map-pin" size={13} color={colors.brand} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>{spot.location}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Icon name="calendar" size={12} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDate(item.visitedAt)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Icon name="clock" size={12} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatTime(item.visitedAt)}</Text>
            </View>
          </View>

          <View style={styles.detailsRow}>
            {spot.visitingHours ? (
              <View style={[styles.detailChip, { backgroundColor: colors.brandLight }]}>
                <Icon name="clock" size={11} color={colors.brand} />
                <Text style={[styles.detailChipText, { color: colors.brand }]}>{spot.visitingHours}</Text>
              </View>
            ) : null}
            {spot.entranceFee ? (
              <View style={[styles.detailChip, { backgroundColor: colors.brandLight }]}>
                <Icon name="tag" size={11} color={colors.brand} />
                <Text style={[styles.detailChipText, { color: colors.brand }]}>{spot.entranceFee}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [visited.length, colors, allSpots, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* The header stays mounted through the load so the back button is always
          available — the loading branch used to replace the whole screen with a
          bare spinner, stranding the user on a cold backend. */}
      <ScreenHeader
        title="Previous Trips"
        onBack={() => navigation.goBack()}
        right={
          visited.length ? (
            <View style={[styles.countPill, { backgroundColor: colors.brandLight }]}>
              <Text style={[styles.countText, { color: colors.brandDark }]}>{visited.length}</Text>
            </View>
          ) : null
        }
      />

      {loading ? (
        <LoadingState label="Loading your trips…" />
      ) : (
      <FlatList
        data={visited}
        keyExtractor={(item, index) => item._id?.toString() ?? String(index)}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={
          error ? (
            <ErrorState text={error} onRetry={() => loadVisited(true)} style={styles.errorBox} />
          ) : null
        }
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
            <EmptyState
              icon="map"
              title="No trips yet"
              text="Navigate to a spot — arriving there logs it here as a trip."
              action={
                <PrimaryButton
                  title="Find a spot"
                  icon="navigation"
                  variant="secondary"
                  onPress={() => navigation.navigate("TrackSpotSelect")}
                  style={styles.emptyAction}
                />
              }
            />
          ) : null
        }
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  countPill: {
    borderRadius: 20,
    minWidth: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: "center",
  },
  countText: { fontFamily: fonts.sansBold, fontSize: 13 },

  errorBox:    { marginBottom: 16 },
  emptyAction: { marginTop: 8, alignSelf: "stretch" },

  listContent: { paddingHorizontal: H_PAD, paddingTop: 8, flexGrow: 1 },

  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  imageWrapper:     { width: "100%", height: 170, position: "relative" },
  spotImage:        { width: "100%", height: "100%", resizeMode: "cover" },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  photoChip: {
    position: "absolute",
    top: 10,
    left: 10,
    maxWidth: "60%",
    backgroundColor: "rgba(6,20,22,0.62)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoChipRight: { left: undefined, right: 10 },
  photoChipText:  { color: "#fff", fontSize: 11.5, fontFamily: fonts.sansBold },

  cardBody:  { padding: 16 },
  spotName:  { ...typography.h3, fontSize: 18, lineHeight: 23, marginBottom: 6 },
  infoRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  infoText:  { ...typography.body, fontSize: 13.5, lineHeight: 19, flex: 1 },
  divider:   { height: 1, marginBottom: 10 },
  metaRow:   { flexDirection: "row", gap: 16, marginBottom: 10 },
  metaItem:  { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText:  { fontSize: 12.5, fontFamily: fonts.sansMedium },
  detailsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detailChipText: { fontSize: 11.5, fontFamily: fonts.sansSemi },
});