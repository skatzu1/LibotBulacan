import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useArrival } from "../context/ArrivalContext";
import { useBookmark } from "../context/BookmarkContext";
import { useTheme, fonts } from "../context/ThemeContext";
import {
  ScreenHeader, SpotCard, EmptyState, ErrorState, SearchField, PhotoBookmark, H_PAD,
} from "../components/ui";

// ── Skeleton import ───────────────────────────────────────────────────────────
import ListsSkeleton from "../components/ListsSkeleton";
import usePullToRefresh from "../hooks/usePullToRefresh";

// Spot.category is stored as an array (e.g. ["Festivals"]) per the Mongoose
// schema. Some legacy docs might still have it as a plain string.
const inCategory = (spot, category) =>
  Array.isArray(spot.category) ? spot.category.includes(category) : spot.category === category;

export default function Lists() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { isBookmarked, toggleBookmark } = useBookmark();
  const { allSpots, spotsStatus, reloadSpots } = useArrival();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const category    = route.params?.category    || "Religious";
  const displayName = route.params?.displayName || category;

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  // There used to be a hardcoded "offline" list here, shown whenever a
  // category came back empty. It held Paoay Church, Vigan and Pahiyas — none of
  // them in Bulacan — with fake ids that opened a broken detail page. An empty
  // category now says it's empty; a failed load says so and offers a retry.
  const destinations = useMemo(
    () => allSpots.filter((s) => inCategory(s, category)),
    [allSpots, category]
  );

  // Spots visible after applying the in-category search filter
  const q = searchQuery.trim().toLowerCase();
  const visibleDestinations = q
    ? destinations.filter((item) => item.name?.toLowerCase().includes(q))
    : destinations;

  const { refreshing, refreshControl } = usePullToRefresh(reloadSpots);
  const loading = allSpots.length === 0 && spotsStatus === "loading" && !refreshing;
  const failed  = allSpots.length === 0 && spotsStatus === "error";

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {/* The header and search bar stay put while loading — the header used to
          be replaced entirely by the skeleton. */}
      <ScreenHeader title={displayName} onBack={() => navigation.goBack()} />

      <View style={styles.searchWrap}>
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery("")}
          placeholder={`Search in ${displayName}`}
        />
      </View>

      {loading ? <ListsSkeleton cardCount={4} /> : (
      <ScrollView
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {failed ? (
          <ErrorState text="Couldn't load the spots. Check your connection." onRetry={reloadSpots} />
        ) : (
          <>
            <Text style={styles.infoText}>
              {visibleDestinations.length} destination{visibleDestinations.length !== 1 ? "s" : ""}
            </Text>

            {visibleDestinations.length > 0 ? (
              <View style={styles.cardsContainer}>
                {visibleDestinations.map((item) => (
                  <SpotCard
                    key={item._id}
                    spot={item}
                    wide
                    height={180}
                    onPress={() => navigation.navigate("InformationScreen", { spot: item })}
                    right={
                      <PhotoBookmark
                        saved={isBookmarked(item._id)}
                        onPress={() => toggleBookmark(item)}
                      />
                    }
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                icon={q ? "search" : "map"}
                text={q
                  ? "No matching spots — try a different search"
                  : "No destinations in this category yet"}
              />
            )}
          </>
        )}
      </ScrollView>
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  searchWrap: { paddingHorizontal: H_PAD, paddingBottom: 6 },

  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 8 },
  infoText: { fontSize: 13.5, color: colors.textSecondary, fontFamily: fonts.sansMedium, marginBottom: 16 },

  cardsContainer: { gap: 14 },
});
