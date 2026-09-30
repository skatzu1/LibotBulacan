import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, StatusBar } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBookmark } from "../context/BookmarkContext";
import { useTheme, fonts, TAB_BAR_CLEARANCE } from "../context/ThemeContext";
import { ScreenHeader, SpotCard, EmptyState, PhotoBookmark, H_PAD } from "../components/ui";
import ListsSkeleton from "../components/ListsSkeleton";

export default function Bookmark() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { bookmarks, toggleBookmark, loading } = useBookmark();
  const { colors, isDark } = useTheme();

  const bookmarkedSpots = useMemo(
    () =>
      bookmarks
        .map((b) => (typeof b.spotId === "object" && b.spotId?._id ? b.spotId : null))
        .filter(Boolean),
    [bookmarks]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      <ScreenHeader
        title="Saved spots"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      {/* Same skeleton as a category list — the loaded screen is the same
          stack of cards, so the two shouldn't load differently. */}
      {loading && bookmarks.length === 0 ? (
        <ListsSkeleton cardCount={3} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }]}
        >
          <Text style={[styles.count, { color: colors.textSecondary }]}>
            {bookmarkedSpots.length
              ? `${bookmarkedSpots.length} place${bookmarkedSpots.length === 1 ? "" : "s"} to visit`
              : "Your reading list for Bulacan"}
          </Text>

          {bookmarkedSpots.length === 0 ? (
            <EmptyState
              icon="bookmark"
              title="Nothing saved yet"
              text="Tap the bookmark on any place to keep it here."
            />
          ) : (
            <View style={styles.list}>
              {bookmarkedSpots.map((spot) => (
                <SpotCard
                  key={spot._id || spot.id}
                  spot={spot}
                  wide
                  height={180}
                  onPress={() => navigation.navigate("InformationScreen", { spot })}
                  right={<PhotoBookmark saved onPress={() => toggleBookmark(spot)} />}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: H_PAD, paddingTop: 8 },
  count:     { fontSize: 13.5, fontFamily: fonts.sansMedium, marginBottom: 16 },
  list:      { gap: 14 },
});
