import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import {
  useTheme, typography, radius, TAB_BAR_CLEARANCE, MAX_FONT_SCALE,
} from "../context/ThemeContext";
import { ScreenHeader, SectionTitle, ErrorState, useGrid, H_PAD } from "../components/ui";
import CategoriesSkeleton from "../components/CategoriesSkeleton";
import { categoryAPI } from "../api";
import Icon from "../components/Icon";

// Fallback only. The categories are served from /api/categories now, so an
// admin can add or rename one without an app release — but a browse screen
// that renders nothing when the network is down (or while the backend is
// waking from a cold start) is worse than one showing the four we know exist.
// These match the seeded rows exactly; see backend scripts/seedCategories.js.
const FALLBACK_CATEGORIES = [
  { name: "Religious",  icon: "users" },
  { name: "Historical", icon: "book"  },
  { name: "Nature",     icon: "globe" },
  { name: "Festivals",  icon: "award" },
];

// Categories are CONCEPTS, not places — photographing them is what forced every
// tile into the same "photo + dark scrim + white bold name" shape the app
// already uses for the hero, the most-visited grid and every SpotCard. These are
// typographic instead: a material tint drawn from Bulacan's own palette
// (terracotta roof tile, Katipunan indigo, narra, capiz gold) with the icon
// blown up as a watermark bleeding off the corner.
const TILE_TINTS = [
  { light: "#F2D9CC", dark: "#2E2019" }, // terracotta
  { light: "#D9DFF0", dark: "#1B2030" }, // indigo
  { light: "#D9E6D2", dark: "#1A241A" }, // narra / river green
  { light: "#F6E6BE", dark: "#2A2416" }, // capiz gold
  { light: "#D3EEF1", dark: "#123236" }, // brand cyan
];

export default function Categories() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { cardW, gap } = useGrid();

  const [categories, setCategories] = useState(null);
  const [error,      setError]      = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return categoryAPI.getAll()
      .then((rows) => {
        // An empty collection is not a reason to show an empty screen.
        setCategories(rows.length ? rows : FALLBACK_CATEGORIES);
        setError(false);
      })
      .catch(() => {
        // Still render the four we know exist, but say so rather than silently
        // presenting a stale fallback as the live set.
        setCategories(FALLBACK_CATEGORIES);
        setError(true);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {/* The header renders immediately, even while loading. It used to sit
          inside the `if (!categories)` early return, so the entire screen was
          replaced by a skeleton and the title visibly popped in afterwards. */}
      <ScreenHeader
        title="Explore"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      {!categories ? (
        <CategoriesSkeleton count={4} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
        >
          <View style={styles.intro}>
            <Text
              style={[styles.introTitle, { color: colors.textPrimary }]}
              accessibilityRole="header"
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            >
              Browse by category
            </Text>
            <Text style={[styles.introSub, { color: colors.textSecondary }]}>
              Pick a theme and discover destinations across Bulacan
            </Text>
          </View>

          {error && (
            <View style={{ paddingHorizontal: H_PAD, marginTop: 20 }}>
              <ErrorState
                text="Showing the default categories — we couldn't reach the server."
                onRetry={onRefresh}
              />
            </View>
          )}

          <SectionTitle>Categories</SectionTitle>

          <View style={[styles.grid, { gap }]}>
            {categories.map((cat, i) => {
              const tint = TILE_TINTS[i % TILE_TINTS.length];
              const bg   = isDark ? tint.dark : tint.light;
              return (
                <Animated.View
                  key={cat._id || cat.name}
                  entering={FadeInDown.delay(60 + i * 70).duration(400).reduceMotion(ReduceMotion.System)}
                >
                  <TouchableOpacity
                    style={[styles.card, { width: cardW, backgroundColor: bg, borderColor: colors.cardBorder }]}
                    // `name` is the key Spot.category is filed under, so it's what
                    // the Lists screen filters on.
                    onPress={() => navigation.navigate("Lists", { category: cat.name, displayName: cat.name })}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`${cat.name} spots`}
                  >
                    {/* Oversized icon watermark, bleeding off the bottom-right */}
                    <Icon
                      name={cat.icon || "map-pin"}
                      size={112}
                      color={colors.textPrimary}
                      style={styles.watermark}
                    />

                    <View style={styles.cardTop}>
                      <Icon name={cat.icon || "map-pin"} size={18} color={colors.textPrimary} />
                    </View>

                    <View style={styles.cardFooter}>
                      <Text
                        style={[styles.cardLabel, { color: colors.textPrimary }]}
                        numberOfLines={2}
                        maxFontSizeMultiplier={MAX_FONT_SCALE}
                      >
                        {cat.name}
                      </Text>
                      <Icon name="arrow-up-right" size={18} color={colors.textPrimary} />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  intro: { paddingHorizontal: H_PAD, paddingTop: 6 },
  introTitle: { ...typography.h1, fontSize: 28, lineHeight: 34 },
  introSub: { ...typography.body, marginTop: 6 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: H_PAD,
  },
  card: {
    height: 168,
    borderRadius: radius.card,
    overflow: "hidden",
    padding: 14,
    justifyContent: "space-between",
    borderWidth: 1,
  },
  watermark: {
    position: "absolute",
    right: -26,
    bottom: -30,
    opacity: 0.09,
  },
  cardTop: { flexDirection: "row" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  // The serif is what makes these read as a masthead rather than a photo caption.
  cardLabel: { ...typography.display, fontSize: 21, lineHeight: 25, flex: 1 },
});
