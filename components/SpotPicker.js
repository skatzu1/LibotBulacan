import React, { useMemo } from "react";
import { View, Text, StyleSheet, StatusBar, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useArrival } from "../context/ArrivalContext";
import { useTheme, fonts } from "../context/ThemeContext";
import { ScreenHeader, SpotCard, EmptyState, ErrorState, H_PAD } from "./ui";
import ListsSkeleton from "./ListsSkeleton";
import usePullToRefresh from "../hooks/usePullToRefresh";

/**
 * Shared "pick a spot" list screen used by the AR / Missions / Navigate flows.
 * Props: title, subtitle, onPick(spot) -> navigation action,
 *        renderRight(spot) -> optional node for the card's top-right corner,
 *        filter(spot) -> optional; only spots it returns true for are listed.
 */
export default function SpotPicker({ title, subtitle, onPick, renderRight, filter }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { allSpots, spotsStatus, reloadSpots } = useArrival();
  const { colors, isDark } = useTheme();
  const spots = useMemo(() => (filter ? allSpots.filter(filter) : allSpots), [allSpots, filter]);
  const { refreshing, refreshControl } = usePullToRefresh(reloadSpots);
  // Empty spots used to mean "spinner forever" — including when the request
  // had failed and nothing was ever going to arrive. (Checked on the full
  // list: a filter that matches nothing is "no spots", not "still loading".)
  const loading = allSpots.length === 0 && spotsStatus === "loading" && !refreshing;
  const failed  = allSpots.length === 0 && spotsStatus === "error";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      <ScreenHeader title={title} onBack={() => navigation.goBack()} />

      {loading ? (
        <ListsSkeleton cardCount={4} />
      ) : failed ? (
        <View style={styles.pad}>
          <ErrorState text="Couldn't load the spots. Check your connection." onRetry={reloadSpots} />
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => String(item._id)}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
          ListHeaderComponent={
            subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            ) : null
          }
          ListEmptyComponent={<EmptyState icon="map-pin" text="No spots available yet." />}
          renderItem={({ item }) => (
            <SpotCard
              spot={item}
              wide
              height={132}
              onPress={() => onPick(item, navigation)}
              right={renderRight?.(item)}
              style={styles.card}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1 },
  pad:      { paddingHorizontal: H_PAD, paddingTop: 8 },
  list:     { paddingHorizontal: H_PAD, paddingTop: 8 },
  subtitle: { fontSize: 13.5, fontFamily: fonts.sansMedium, marginBottom: 16 },
  card:     { marginBottom: 14 },
});
