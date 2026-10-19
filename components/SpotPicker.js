import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, StatusBar, FlatList, SectionList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useArrival } from "../context/ArrivalContext";
import { useReviews } from "../context/ReviewContext";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import { ScreenHeader, FeatureCard, EmptyState, ErrorState, SearchField, H_PAD } from "./ui";
import ListsSkeleton from "./ListsSkeleton";
import usePullToRefresh from "../hooks/usePullToRefresh";

// The card is Home's Featured card (FeatureCard), a little shorter so a list
// of them still shows three at a time.
const CARD_H = 220;

// A spot matches when the search is in its name or its town.
const matches = (spot, q) =>
  [spot.name, spot.city].filter(Boolean).some((f) => String(f).toLowerCase().includes(q));

/**
 * Shared "pick a spot" list screen used by the AR / Missions / Navigate flows.
 * Props: title, subtitle, onPick(spot) -> navigation action,
 *        cta -> the card's yellow pill ("Explore" by default),
 *        renderRight(spot) -> optional node for the card's top-right corner,
 *        filter(spot) -> optional; only spots it returns true for are listed,
 *        header -> optional node above the search field (e.g. a summary),
 *        sections(spots) -> optional; divides the list under headings:
 *          [{ key, title, sub?, data: spots }], empty ones left out,
 *        renderCard(spot, onPress) -> optional; replaces the photo card.
 *
 * Every one of these lists has a search field (QA 2026-10-16): with 20-odd
 * spots, scrolling for one by photo was slow.
 */
export default function SpotPicker({ title, subtitle, onPick, cta, renderRight, filter, header, sections, renderCard }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { allSpots, spotsStatus, reloadSpots } = useArrival();
  const { getAverageRating } = useReviews();
  const { colors, isDark } = useTheme();
  const [query, setQuery] = useState("");
  const listed = useMemo(() => (filter ? allSpots.filter(filter) : allSpots), [allSpots, filter]);
  const q = query.trim().toLowerCase();
  const spots = useMemo(() => (q ? listed.filter((s) => matches(s, q)) : listed), [listed, q]);
  const { refreshing, refreshControl } = usePullToRefresh(reloadSpots);
  // Empty spots used to mean "spinner forever" — including when the request
  // had failed and nothing was ever going to arrive. (Checked on the full
  // list: a filter that matches nothing is "no spots", not "still loading".)
  const loading = allSpots.length === 0 && spotsStatus === "loading" && !refreshing;
  const failed  = allSpots.length === 0 && spotsStatus === "error";
  const grouped = useMemo(
    () => (sections ? sections(spots).filter((sec) => sec.data.length > 0) : null),
    [sections, spots],
  );

  const renderItem = ({ item }) => {
    const onPress = () => onPick(item, navigation);
    return renderCard ? (
      <View style={styles.card}>{renderCard(item, onPress)}</View>
    ) : (
      <FeatureCard
        spot={item}
        height={CARD_H}
        rating={getAverageRating(item._id, item.ratingAvg)}
        cta={cta}
        onPress={onPress}
        right={renderRight?.(item)}
        style={styles.card}
      />
    );
  };

  const listHeader = (
    <>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {header}
      <SearchField
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery("")}
        placeholder="Search by spot or town"
        style={styles.search}
      />
      {!!q && (
        <Text style={[styles.resultCount, { color: colors.textMuted }]}>
          {spots.length} {spots.length === 1 ? "spot" : "spots"} for “{query.trim()}”
        </Text>
      )}
    </>
  );
  const listEmpty = q
    ? <EmptyState icon="search" text="Nothing matched that. Try a town or a landmark name." />
    : <EmptyState icon="map-pin" text="No spots available yet." />;
  const listProps = {
    keyExtractor: (item) => String(item._id),
    refreshControl,
    showsVerticalScrollIndicator: false,
    keyboardShouldPersistTaps: "handled",
    keyboardDismissMode: "on-drag",
    contentContainerStyle: [styles.list, { paddingBottom: insets.bottom + 40 }],
    ListHeaderComponent: listHeader,
    ListEmptyComponent: listEmpty,
    renderItem,
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      <ScreenHeader title={title} onBack={() => navigation.goBack()} />

      {loading ? (
        <ListsSkeleton cardCount={4} cardHeight={CARD_H} />
      ) : failed ? (
        <View style={styles.pad}>
          <ErrorState text="Couldn't load the spots. Check your connection." onRetry={reloadSpots} />
        </View>
      ) : grouped ? (
        <SectionList
          {...listProps}
          sections={grouped}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.section} accessibilityRole="header">
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {section.title}
                <Text style={[styles.sectionCount, { color: colors.textMuted }]}>  {section.data.length}</Text>
              </Text>
              {!!section.sub && <Text style={[styles.sectionSub, { color: colors.textMuted }]}>{section.sub}</Text>}
            </View>
          )}
        />
      ) : (
        <FlatList {...listProps} data={spots} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1 },
  pad:         { paddingHorizontal: H_PAD, paddingTop: 8 },
  list:        { paddingHorizontal: H_PAD, paddingTop: 8 },
  subtitle:    { fontSize: 13.5, fontFamily: fonts.sansMedium, marginBottom: 14 },
  search:      { marginBottom: 14 },
  resultCount: { fontSize: 12.5, fontFamily: fonts.sansMedium, marginTop: -4, marginBottom: 12 },
  card:        { marginBottom: 14 },
  section:      { marginTop: 10, marginBottom: 12 },
  sectionTitle: { ...typography.h3 },
  sectionCount: { fontFamily: fonts.sansBold, fontSize: 14 },
  sectionSub:   { fontSize: 12.5, fontFamily: fonts.sansMedium, marginTop: 2 },
});
