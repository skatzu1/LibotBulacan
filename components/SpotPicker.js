import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, StatusBar, FlatList, SectionList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useArrival } from "../context/ArrivalContext";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import { ScreenHeader, EmptyState, ErrorState, SearchField, H_PAD } from "./ui";
import ListsSkeleton from "./ListsSkeleton";
import usePullToRefresh from "../hooks/usePullToRefresh";

// About the height of a SpotStatusCard (components/SpotProgress.js), for the
// loading placeholders.
const CARD_H = 78;

// A spot matches when the search is in its name or its town.
const matches = (spot, q) =>
  [spot.name, spot.city].filter(Boolean).some((f) => String(f).toLowerCase().includes(q));

/**
 * Shared "pick a spot" list screen used by the AR / Bakit List / Navigate
 * quick actions. Props: title, subtitle, onPick(spot, navigation),
 *   renderCard(spot, onPress) -> the spot's card (a SpotStatusCard),
 *   filter(spot) -> optional; only spots it returns true for are listed,
 *   header -> optional node above the search field,
 *   sections(spots) -> optional; divides the list under headings:
 *     [{ key, title, data: spots }], empty ones left out.
 *
 * The cards used to be Home's big Featured photo cards with a chip in the
 * corner; each list now says where the traveler stands (user, 2026-10-20).
 * Every list has a search field (QA 2026-10-16).
 */
export default function SpotPicker({ title, subtitle, onPick, renderCard, filter, header, sections }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { allSpots, spotsStatus, reloadSpots } = useArrival();
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
  const listProps = {
    keyExtractor: (item) => String(item._id),
    refreshControl,
    showsVerticalScrollIndicator: false,
    keyboardShouldPersistTaps: "handled",
    keyboardDismissMode: "on-drag",
    contentContainerStyle: [styles.list, { paddingBottom: insets.bottom + 40 }],
    ListHeaderComponent: listHeader,
    ListEmptyComponent: q
      ? <EmptyState icon="search" text="Nothing matched that. Try a town or a landmark name." />
      : <EmptyState icon="map-pin" text="No spots available yet." />,
    renderItem: ({ item }) => (
      <View style={styles.card}>{renderCard(item, () => onPick(item, navigation))}</View>
    ),
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      <ScreenHeader title={title} onBack={() => navigation.goBack()} />

      {loading ? (
        <ListsSkeleton cardCount={7} cardHeight={CARD_H} />
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
  card:        { marginBottom: 10 },
  section:      { marginTop: 8, marginBottom: 10 },
  sectionTitle: { ...typography.title },
  sectionCount: { fontFamily: fonts.sansBold, fontSize: 14 },
});
