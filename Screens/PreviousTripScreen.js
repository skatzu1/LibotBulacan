// screens/PreviousTripsScreen.js
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useTheme, fonts } from "../context/ThemeContext";
import {
  ScreenHeader, EmptyState, ErrorState, LoadingState, PrimaryButton, FeatureCard, PhotoChip, SearchField, H_PAD,
} from "../components/ui";
// Was a hardcoded "https://libotbackend.onrender.com".
import { BASE_URL } from "../api";
import { useArrival } from "../context/ArrivalContext";
import { useReviews } from "../context/ReviewContext";

// Home's Featured card, a little shorter so three still show at a time.
const CARD_H = 220;

export default function PreviousTripsScreen() {
  const navigation   = useNavigation();
  const insets       = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { colors }   = useTheme();
  const { allSpots } = useArrival();
  const { getAverageRating } = useReviews();

  const [visited, setVisited]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [query, setQuery]           = useState("");

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

  const formatShortDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
    });
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("en-PH", {
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  // Each trip with the spot as shown. Trips aren't numbered (2026-10-20): the
  // "#N" on each card was dropped.
  const trips = useMemo(() => visited.map((item) => {
    const spot = item.spot;
    if (!spot) return null;
    // The visit log only populates a handful of fields. Open the detail page
    // with the full spot (description, 3D model…) when we have it.
    const fullSpot = allSpots.find((s) => s._id === spot._id) || spot;
    // The visit log only began carrying `city` on 2026-10-04, so fall back to
    // the full spot list for older trips.
    const shown = { ...fullSpot, name: spot.name, image: spot.image || fullSpot.image, city: spot.city || fullSpot.city };
    return { item, spot, fullSpot, shown };
  }).filter(Boolean), [visited, allSpots]);

  // Search by spot name, town, or the date ("October", "2026") — QA 2026-10-16.
  const q = query.trim().toLowerCase();
  const shownTrips = useMemo(() => (q
    ? trips.filter(({ shown, item }) =>
        [shown.name, shown.city, formatDate(item.visitedAt)]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q)))
    : trips), [trips, q]);

  const renderItem = useCallback(({ item: entry }) => {
    const { item, spot, fullSpot, shown } = entry;

    // Home's Featured card, like the spot lists behind the other quick
    // actions, with when you were there top-right.
    return (
      <FeatureCard
        spot={shown}
        height={CARD_H}
        rating={getAverageRating(fullSpot._id, fullSpot.ratingAvg)}
        right={<PhotoChip>{formatShortDate(item.visitedAt)} · {formatTime(item.visitedAt)}</PhotoChip>}
        onPress={() => navigation.navigate("InformationScreen", { spot: fullSpot })}
        accessibilityLabel={`${spot.name}, ${formatDate(item.visitedAt)}`}
        style={styles.card}
      />
    );
  }, [navigation, getAverageRating]);

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
        data={shownTrips}
        keyExtractor={(entry, index) => entry.item._id?.toString() ?? `trip-${index}`}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={
          <>
            {error ? (
              <ErrorState text={error} onRetry={() => loadVisited(true)} style={styles.errorBox} />
            ) : null}
            {trips.length > 0 && (
              <SearchField
                value={query}
                onChangeText={setQuery}
                onClear={() => setQuery("")}
                placeholder="Search trips by spot, municipality or month"
                style={styles.search}
              />
            )}
          </>
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
          !error && q && trips.length > 0 ? (
            <EmptyState icon="search" text="No trip matches that. Try a spot, a municipality or a month." />
          ) : !error ? (
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
  search:      { marginBottom: 14 },
  emptyAction: { marginTop: 8, alignSelf: "stretch" },

  listContent: { paddingHorizontal: H_PAD, paddingTop: 8, flexGrow: 1 },

  // The same 14 apart as the spot lists behind the other quick actions.
  card: { marginBottom: 14 },
});