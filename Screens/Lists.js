import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import Icon from "../components/Icon";

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
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const searchInputRef = useRef(null);

  // There used to be a hardcoded "offline" list here, shown whenever a
  // category came back empty. It held Paoay Church, Vigan and Pahiyas — none of
  // them in Bulacan — with fake ids that opened a broken detail page. An empty
  // category now says it's empty; a failed load says so and offers a retry.
  const destinations = useMemo(
    () => allSpots.filter((s) => inCategory(s, category)),
    [allSpots, category]
  );

  // ── Search handlers ───────────────────────────────────────────────────────
  const openSearch = () => {
    setSearchActive(true);
    // wait for the input to mount before focusing
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchActive(false);
    setSearchQuery("");
  };

  // Spots visible after applying the in-category search filter
  const q = searchQuery.trim().toLowerCase();
  const visibleDestinations = q
    ? destinations.filter((item) => item.name?.toLowerCase().includes(q))
    : destinations;

  const loading = allSpots.length === 0 && spotsStatus === "loading";
  const failed  = allSpots.length === 0 && spotsStatus === "error";

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {/* The header stays put whether searching or loading — it used to be
          swapped for a bespoke search bar (with its own hardcoded paddingTop:52
          that disagreed with every other screen), and replaced entirely by the
          skeleton while loading. */}
      <ScreenHeader
        title={displayName}
        onBack={searchActive ? closeSearch : () => navigation.goBack()}
        right={
          searchActive ? null : (
            <TouchableOpacity
              onPress={openSearch}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Search in ${displayName}`}
            >
              <Icon name="search" size={21} color={colors.textPrimary} />
            </TouchableOpacity>
          )
        }
      />

      {searchActive && (
        <View style={styles.searchWrap}>
          <SearchField
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder={`Search in ${displayName}`}
          />
        </View>
      )}

      {loading ? <ListsSkeleton cardCount={4} /> : (
      <ScrollView
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
