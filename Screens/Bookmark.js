import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useBookmark } from "../context/BookmarkContext";
import { useTheme, fonts } from "../context/ThemeContext";
import { ScreenHeader, SpotCard, EmptyState, H_PAD } from "../components/ui";
import Icon from "../components/Icon";

export default function Bookmark() {
  const navigation = useNavigation();
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {bookmarkedSpots.length
            ? `${bookmarkedSpots.length} place${bookmarkedSpots.length === 1 ? "" : "s"} to visit`
            : "Your reading list for Bulacan"}
        </Text>

        {loading && bookmarks.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : bookmarkedSpots.length === 0 ? (
          <EmptyState
            icon="bookmark"
            text="No saved spots yet. Tap the bookmark on any place to add it here."
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
                right={
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={[styles.bmBtn, { backgroundColor: "rgba(0,0,0,0.4)" }]}
                    onPress={() => toggleBookmark(spot)}
                    activeOpacity={0.8}
                    accessibilityLabel="Remove bookmark"
                  >
                    <Icon name="bookmark" size={17} weight="fill" color={colors.star} />
                  </TouchableOpacity>
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: H_PAD, paddingBottom: 150 },
  count:     { fontSize: 13.5, fontFamily: fonts.sansMedium, marginTop: 4, marginBottom: 16 },
  centered:  { paddingVertical: 80, alignItems: "center" },
  list:      { gap: 14 },
  bmBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
});
