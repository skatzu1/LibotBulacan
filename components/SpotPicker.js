import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, StatusBar, FlatList, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useArrival } from "../context/ArrivalContext";
import { useTheme, fonts } from "../context/ThemeContext";
import { ScreenHeader, Segmented, EmptyState, ErrorState, LoadingState, SearchField } from "./ui";
import { GRID_GAP, H_GUTTER, columnsFor, cardSizeFor, AnimatedCell } from "./Grid";
import { SpotGridCard, spotCardHeightFor } from "./SpotProgress";
import usePullToRefresh from "../hooks/usePullToRefresh";

// A spot matches when the search is in its name or its town.
const matches = (spot, q) =>
  [spot.name, spot.city].filter(Boolean).some((f) => String(f).toLowerCase().includes(q));

/**
 * The Bakit List, AR View and Navigate spot lists, laid out like the Badges
 * screen (user, 2026-10-20): a done/total count in the header, a search
 * field, an All / to-do / done filter with counts, and a grid of cards
 * (SpotGridCard) — done ones first, like claimed badges.
 *
 * Props: title, subtitle (optional, one line), onPick(spot, navigation),
 *   filter(spot)  -> optional; only spots it returns true for are listed,
 *   isDone(spot)  -> whether the spot is done (finished / AR done / visited),
 *   rank(spot)    -> optional; orders the spots not done (lower first),
 *   labels        -> { todo, done }: the filter's names for the two groups,
 *   footer(spot)  -> the card's footer ({ text, icon? }),
 *   a11y(spot)    -> the card's accessibility label; a11yHint: what a tap does.
 */
export default function SpotPicker({
  title, subtitle, onPick, filter, isDone, rank, labels, footer, a11y, a11yHint,
}) {
  const navigation = useNavigation();
  const { allSpots, spotsStatus, reloadSpots } = useArrival();
  const { colors, isDark } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const columns    = columnsFor(width);
  const cardSize   = cardSizeFor(width);
  const cardHeight = spotCardHeightFor(fontScale);
  const [query, setQuery] = useState("");
  const [show, setShow]   = useState("all");
  const { refreshing, refreshControl } = usePullToRefresh(reloadSpots);

  // Done first, like claimed badges; the rest by `rank`, else the list's order.
  const listed = useMemo(() => {
    const spots = filter ? allSpots.filter(filter) : allSpots;
    const done = spots.filter(isDone);
    const todo = spots.filter((s) => !isDone(s));
    if (rank) todo.sort((a, b) => rank(a) - rank(b));
    return { all: [...done, ...todo], done, todo };
  }, [allSpots, filter, isDone, rank]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const group = listed[show] || listed.all;
    return q ? group.filter((s) => matches(s, q)) : group;
  }, [listed, show, q]);

  // Empty spots used to mean "spinner forever" — including when the request
  // had failed and nothing was ever going to arrive. (Checked on the full
  // list: a filter that matches nothing is "no spots", not "still loading".)
  const loading = allSpots.length === 0 && spotsStatus === "loading" && !refreshing;
  const failed  = allSpots.length === 0 && spotsStatus === "error";

  const header = (
    <ScreenHeader
      title={title}
      onBack={() => navigation.goBack()}
      right={listed.all.length > 0 ? (
        <View
          style={[styles.countPill, { backgroundColor: colors.brandLight }]}
          accessible
          accessibilityLabel={`${listed.done.length} of ${listed.all.length} ${labels.done.toLowerCase()}`}
        >
          <Text style={[styles.countText, { color: colors.brandDark }]}>{listed.done.length}/{listed.all.length}</Text>
        </View>
      ) : null}
    />
  );

  if (loading || failed) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {header}
        {loading ? (
          <LoadingState label="Loading spots…" />
        ) : (
          <View style={styles.pad}>
            <ErrorState text="Couldn't load the spots. Check your connection." onRetry={reloadSpots} />
          </View>
        )}
      </View>
    );
  }

  const options = [
    { key: "all",  label: "All",       n: listed.all.length },
    { key: "todo", label: labels.todo, n: listed.todo.length },
    { key: "done", label: labels.done, n: listed.done.length },
  ].map((o) => ({ key: o.key, label: `${o.label} (${o.n})`, a11y: `${o.label}, ${o.n} spots` }));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      {header}

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item._id)}
        // FlatList cannot change numColumns in place, so the key forces a
        // remount when the viewport crosses a breakpoint.
        key={columns}
        numColumns={columns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        renderItem={({ item, index }) => {
          const done = isDone(item);
          return (
            <AnimatedCell delay={Math.min(index, 12) * 40}>
              <SpotGridCard
                spot={item}
                done={done}
                footer={footer(item)}
                width={cardSize}
                minHeight={cardHeight}
                onPress={() => onPick(item, navigation)}
                accessibilityLabel={a11y(item)}
                accessibilityHint={a11yHint}
              />
            </AnimatedCell>
          );
        }}
        ListHeaderComponent={
          <>
            {!!subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
            {listed.all.length > 0 && (
              <>
                <SearchField
                  value={query}
                  onChangeText={setQuery}
                  onClear={() => setQuery("")}
                  placeholder="Search by spot or municipality"
                  style={styles.search}
                />
                <Segmented style={styles.filterBar} value={show} onChange={setShow} options={options} />
              </>
            )}
          </>
        }
        ListEmptyComponent={
          listed.all.length === 0 ? (
            <EmptyState icon="map-pin" text="No spots available yet." />
          ) : q ? (
            <EmptyState icon="search" text="Nothing matched that. Try a municipality or a landmark name." />
          ) : show === "done" ? (
            <EmptyState icon="target" title={`None ${labels.done.toLowerCase()} yet`} />
          ) : (
            <EmptyState icon="check-circle" title="All done!" />
          )
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1 },
  pad:       { paddingHorizontal: H_GUTTER / 2, paddingTop: 8 },
  content:   { paddingHorizontal: H_GUTTER / 2, paddingTop: 8, flexGrow: 1 },
  row:       { justifyContent: "flex-start", gap: GRID_GAP, marginBottom: GRID_GAP },
  subtitle:  { fontSize: 13.5, fontFamily: fonts.sansMedium, marginBottom: 12 },
  search:    { marginBottom: 12 },
  filterBar: { marginBottom: 16 },
  countPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  countText: { fontFamily: fonts.sansBold, fontSize: 13 },
});
