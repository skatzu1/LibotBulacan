import "react-native-gesture-handler";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  Platform,
  AccessibilityInfo,
  useWindowDimensions,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Carousel from "react-native-reanimated-carousel";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useReviews } from "../context/ReviewContext";
import { useUser } from "@clerk/clerk-expo";
import { useArrival } from "../context/ArrivalContext";
import { useProfileImage } from "../context/ProfileImageContext";
import { usePoints } from "../context/PointsContext";
import {
  useTheme, fonts, typography, radius, TAB_BAR_HEIGHT, TAB_BAR_CLEARANCE, MAX_FONT_SCALE,
} from "../context/ThemeContext";
import { PhotoScrim, SearchField, ErrorState, useGrid, H_PAD, TAP } from "../components/ui";
import Logo from "../components/Logo";
import { BASE_URL } from "../api";
import { spotImage, avatarImage } from "../utils/image";

import Bookmark      from "./Bookmark";
import Leaderboard   from "./Leaderboard";
import Categories    from "./Categories";

// ── Skeleton imports ──────────────────────────────────────────────────────────
import HomeSkeleton from "../components/HomeSkeleton";
import Skeleton     from "../components/Skeleton";
import Icon from "../components/Icon";

// Feature shortcuts surfaced on the home screen (all live in the root stack).
// These are now the ONLY entry point for these features — the drawer that used
// to duplicate every one of them was removed. It had no unique destinations, it
// cost a gesture layer that fought the carousel, and it put ~15 navigation
// targets on a single screen.
const QUICK_ACTIONS = [
  { key: "ar",       label: "AR View",  icon: "compass",    route: "ARSpotSelect" },
  // "Bakit List" is the product name for this feature. Route names, API paths
  // and identifiers stay "mission*" — renaming those would be churn with no
  // user-visible benefit, and the backend collection is Mission.
  { key: "missions", label: "Bakit List", icon: "flag",     route: "MissionsSpotSelect" },
  { key: "navigate", label: "Navigate", icon: "navigation", route: "TrackSpotSelect" },
  { key: "trips",    label: "My Trips", icon: "map",         route: "PreviousTrips" },
];

const greetingFor = (d = new Date()) => {
  const hr = d.getHours();
  return hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
};

// One orchestrated page load beats scattered micro-interactions. Each block
// enters 70ms after the one above it, so the screen assembles top-down.
const stagger = (i) =>
  FadeInDown.delay(60 + i * 70).duration(420).reduceMotion(ReduceMotion.System);

const BottomTab = createBottomTabNavigator();

/* -------------------------------------------------------------------------- */
/*                            CUSTOM BOTTOM TAB                               */
/* -------------------------------------------------------------------------- */
function CustomTabBar({ state, descriptors, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View
      style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.tabBar, borderColor: colors.cardBorder, width: Math.min(width - 32, 440) },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused   = state.index === index;
          const label       = options.tabBarLabel ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              // Always pass `selected` — the previous `isFocused ? {...} : {}`
              // meant screen readers never announced the unselected state.
              accessibilityState={{ selected: isFocused }}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              style={styles.tabItem}
              activeOpacity={0.8}
            >
              <View style={styles.tabIconWrap}>
                {options.tabBarIcon?.({
                  focused: isFocused,
                  color:   isFocused ? colors.brand : colors.tabInactive,
                  size:    21,
                })}
              </View>
              <Text
                style={[styles.tabLabel, { color: isFocused ? colors.brand : colors.tabInactive }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.1}
              >
                {label}
              </Text>
              <View style={[styles.tabIndicator, { backgroundColor: isFocused ? colors.brand : "transparent" }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                            BOTTOM TABS NAV                                 */
/* -------------------------------------------------------------------------- */
export default function HomeBottomTabs() {
  return (
    <BottomTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <BottomTab.Screen name="HomeScreen"  component={HomeTab}     options={{ tabBarLabel: "Home",    tabBarIcon: ({ color, size }) => <Icon name="home"     size={size} color={color} /> }} />
      <BottomTab.Screen name="Categories"  component={Categories}  options={{ tabBarLabel: "Explore", tabBarIcon: ({ color, size }) => <Icon name="grid"     size={size} color={color} /> }} />
      <BottomTab.Screen name="Bookmark"    component={Bookmark}    options={{ tabBarLabel: "Saved",   tabBarIcon: ({ color, size }) => <Icon name="bookmark" size={size} color={color} /> }} />
      <BottomTab.Screen name="Leaderboard" component={Leaderboard} options={{ tabBarLabel: "Ranking", tabBarIcon: ({ color, size }) => <Icon name="award"    size={size} color={color} /> }} />
    </BottomTab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                               HOME TAB                                     */
/* -------------------------------------------------------------------------- */
function HomeTab() {
  const navigation                = useNavigation();
  const { user: clerkUser }       = useUser();
  const { profileImage, loading } = useProfileImage();
  const { colors }                = useTheme();

  if (loading) return <HomeSkeleton />;

  const profilePhoto =
    profileImage ??
    clerkUser?.imageUrl ??
    clerkUser?.profileImageUrl ??
    null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HomeContent profilePhoto={profilePhoto} navigation={navigation} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                              HOME CONTENT                                  */
/* -------------------------------------------------------------------------- */
function HomeContent({ profilePhoto, navigation }) {
  const { allSpots }                  = useArrival();
  const { getAverageRating }          = useReviews();
  const { colors }                    = useTheme();
  const { user: clerkUser }           = useUser();
  const { userPoints, refresh: refreshPoints } = usePoints();
  const insets                        = useSafeAreaInsets();
  const { width, cardW, gap }         = useGrid();

  const [topSpots,    setTopSpots]    = useState([]);
  const [topLoading,  setTopLoading]  = useState(true);
  const [topError,    setTopError]    = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query,       setQuery]       = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);
  // Autoplay is a WCAG 2.2.2 problem and an everyday annoyance: a user reading
  // slide 2 gets yanked to slide 3. It stops permanently once the user shows
  // they are driving the carousel themselves.
  const [autoPlay, setAutoPlay]       = useState(true);
  const searchRef = useRef(null);

  const firstName = (clerkUser?.firstName || "").trim() || "Explorer";
  const HERO_H = Math.round(Math.min(width * 0.82, 340));

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) { setReduceMotion(v); if (v) setAutoPlay(false); } })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
      setReduceMotion(v); if (v) setAutoPlay(false);
    });
    return () => { alive = false; sub?.remove?.(); };
  }, []);

  const handleSpotPress = (spot) => navigation.navigate("InformationScreen", { spot });

  const sliderData = useMemo(() => allSpots.slice(0, 8).map(
    ({ _id, image, name, description, location, city, rating, modelUrl, visitCount }, i) => ({
      id:          _id || String(i),
      image,
      title:       name,
      location:    city || location || "Philippines",
      description: description || "",
      rating:      getAverageRating(_id) || 0,
      visitCount:  visitCount ?? 0,
      spot:        { _id, image, name, description, location, city, rating, modelUrl },
    })
  ), [allSpots, getAverageRating]);

  const activeSpot = sliderData[activeIndex] ?? null;

  // ── Global search ───────────────────────────────────────────────────────
  // Previously search existed only INSIDE a category, so a user who knew they
  // wanted Barasoain Church had to guess "Religious" first.
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (q.length === 0) return [];
    return allSpots.filter((s) =>
      [s.name, s.city, s.location, s.address, s.description]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [q, allSpots]);
  const searching = q.length > 0;

  const loadTopSpots = useCallback(() => {
    return fetch(`${BASE_URL}/api/spots/top/visited`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setTopSpots(d.spots.filter((s) => (s.visitCount ?? 0) > 0));
          setTopError(false);
        } else setTopError(true);
      })
      // A failed request is not an empty collection. Without this the screen
      // said "No visits yet — be the first to explore!" when the backend was
      // simply unreachable (which, on a cold Render dyno, it often is).
      .catch(() => setTopError(true));
  }, []);

  useEffect(() => { loadTopSpots().finally(() => setTopLoading(false)); }, [loadTopSpots]);

  useFocusEffect(useCallback(() => { refreshPoints(); }, [refreshPoints]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTopSpots().finally(() => setRefreshing(false));
  }, [loadTopSpots]);

  const Wrap = reduceMotion ? View : Animated.View;
  const anim = (i) => (reduceMotion ? {} : { entering: stagger(i) });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── Slim fixed header ───
          paddingTop now derives from the real safe-area inset. It used to be a
          hardcoded 52, which over-padded small devices and under-padded ones
          with large insets — and disagreed with ScreenHeader everywhere else. */}
      <View style={[h.header, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <Logo size={32} />

        <View style={h.headerActions}>
          <TouchableOpacity
            style={h.headerBtn}
            onPress={() => searchRef.current?.focus()}
            accessibilityRole="button"
            accessibilityLabel="Search spots"
            hitSlop={8}
          >
            <Icon name="search" size={21} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("Profile")}
            style={h.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Go to your profile"
          >
            {profilePhoto ? (
              <Image source={{ uri: avatarImage(profilePhoto, 36) }} style={h.avatar} />
            ) : (
              <View style={[h.avatar, h.avatarFallback, { backgroundColor: colors.brand }]}>
                <Icon name="user" size={16} color={colors.onBrand} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={[h.scroll, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {/* ─── Greeting ─── */}
        <Wrap {...anim(0)} style={h.greeting}>
          <Text style={[h.greetHi, { color: colors.textMuted }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {greetingFor()},
          </Text>
          <View style={h.greetRow}>
            <Text
              style={[h.greetName, { color: colors.textPrimary }]}
              numberOfLines={1}
              accessibilityRole="header"
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            >
              {firstName}
            </Text>
            <View
              style={[h.pointsPill, { backgroundColor: colors.brandLight }]}
              accessibilityLabel={`${userPoints ?? 0} points`}
            >
              <Icon name="stars" size={15} color={colors.brand} weight="fill" />
              <Text style={[h.pointsText, { color: colors.brand }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {userPoints ?? 0}
              </Text>
            </View>
          </View>
        </Wrap>

        {/* ─── Global search ─── */}
        <Wrap {...anim(1)} style={h.searchWrap}>
          <SearchField
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search spots across Bulacan"
          />
        </Wrap>

        {searching ? (
          /* ─── Search results ─── */
          <View style={h.sectionBody}>
            <Text style={[h.resultCount, { color: colors.textMuted }]}>
              {results.length} {results.length === 1 ? "result" : "results"} for “{query.trim()}”
            </Text>
            {results.length === 0 ? (
              <View style={[h.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Icon name="search" size={26} color={colors.textMuted} />
                <Text style={[h.emptyText, { color: colors.textSecondary }]}>
                  Nothing matched that. Try a town or a landmark name.
                </Text>
              </View>
            ) : (
              <View style={[h.grid, { gap }]}>
                {results.map((spot) => (
                  <TouchableOpacity
                    key={spot._id}
                    style={[h.gridCard, { width: cardW, backgroundColor: colors.brandLight }]}
                    onPress={() => handleSpotPress(spot)}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel={`${spot.name}${spot.city ? `, ${spot.city}` : ""}`}
                  >
                    <Image source={{ uri: spotImage(spot.image, cardW, 200) }} style={h.gridImg} resizeMode="cover" />
                    <PhotoScrim />
                    <View style={h.gridInfoWrap}>
                      <Text style={h.gridName} numberOfLines={1}>{spot.name}</Text>
                      {(spot.city || spot.location) && (
                        <Text style={h.gridLocationText} numberOfLines={1}>{spot.city || spot.location}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            {/* ─── Quick actions ─── */}
            <Wrap {...anim(2)} style={h.quickRow}>
              {QUICK_ACTIONS.map((a) => (
                <TouchableOpacity
                  key={a.key}
                  style={[h.quickItem, { width: (width - H_PAD * 2 - 30) / 4 }]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate(a.route)}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                >
                  <View style={[h.quickIcon, { backgroundColor: colors.brandLight }]}>
                    <Icon name={a.icon} size={21} color={colors.brand} />
                  </View>
                  <Text
                    style={[h.quickLabel, { color: colors.textSecondary }]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}
                  >
                    {a.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </Wrap>

            {/* ─── Featured carousel ─── */}
            <Wrap {...anim(3)}>
              <View style={h.sectionHead}>
                <Text style={[h.sectionTitle, { color: colors.textPrimary }]} accessibilityRole="header">
                  Featured
                </Text>
              </View>

              <View style={[h.heroWrap, { height: HERO_H }]}>
                {sliderData.length === 0 ? (
                  <Skeleton width={width - H_PAD * 2} height={HERO_H} radius={radius.card} />
                ) : (
                  <Carousel
                    width={width - H_PAD * 2}
                    height={HERO_H}
                    style={{ borderRadius: radius.card }}
                    data={sliderData}
                    loop
                    autoPlay={autoPlay}
                    autoPlayInterval={7000}
                    scrollAnimationDuration={900}
                    onScrollBegin={() => setAutoPlay(false)}
                    onProgressChange={(_, abs) =>
                      setActiveIndex(Math.round(abs) % sliderData.length)
                    }
                    renderItem={({ item }) => (
                      // The whole slide is the target now. Previously only the
                      // small "Explore" pill navigated, while everyone taps the photo.
                      <TouchableOpacity
                        style={h.heroSlide}
                        activeOpacity={0.92}
                        onPress={() => handleSpotPress(item.spot)}
                        accessibilityRole="button"
                        accessibilityLabel={`Featured: ${item.title}, ${item.location}, rated ${item.rating} of 5`}
                      >
                        <Image source={{ uri: spotImage(item.image, width - H_PAD * 2, HERO_H) }} style={h.heroImage} resizeMode="cover" />
                        <PhotoScrim from={0.34} />
                        <View style={h.heroInfo}>
                          <Text style={h.heroName} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {item.title}
                          </Text>
                          <View style={h.heroMetaRow}>
                            <Icon name="map-pin" size={12} color="rgba(255,255,255,0.95)" />
                            <Text style={h.heroMeta} numberOfLines={1}>{item.location}</Text>
                            <View style={h.heroSep} />
                            <Icon name="star" size={13} color={colors.star} weight="fill" />
                            <Text style={h.heroMeta}>{item.rating}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}

                {activeSpot && (
                  <View style={[h.heroCta, { backgroundColor: colors.accent }]} pointerEvents="none">
                    <Text style={[h.heroCtaText, { color: colors.onAccent }]}>Explore</Text>
                    <Icon name="arrow-up-right" size={15} color={colors.onAccent} />
                  </View>
                )}
              </View>

              {sliderData.length > 1 && (
                <View
                  style={h.dotsRow}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {sliderData.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        h.dot,
                        { backgroundColor: colors.starEmpty },
                        i === activeIndex && [h.dotActive, { backgroundColor: colors.brand }],
                      ]}
                    />
                  ))}
                </View>
              )}
            </Wrap>

            {/* ─── Most visited ─── */}
            <Wrap {...anim(4)}>
              <View style={h.sectionHead}>
                <Text style={[h.sectionTitle, { color: colors.textPrimary }]} accessibilityRole="header">
                  Most visited
                </Text>
              </View>

              <View style={h.sectionBody}>
                {topLoading ? (
                  <View>
                    <Skeleton width="100%" height={200} radius={radius.card} style={{ marginBottom: 12 }} />
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <Skeleton width={cardW} height={150} radius={radius.card} />
                      <Skeleton width={cardW} height={150} radius={radius.card} />
                    </View>
                  </View>
                ) : topError ? (
                  <ErrorState
                    text="Couldn't load the most-visited spots."
                    onRetry={() => {
                      setTopLoading(true);
                      loadTopSpots().finally(() => setTopLoading(false));
                    }}
                  />
                ) : topSpots.length === 0 ? (
                  <View style={[h.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Icon name="map" size={26} color={colors.textMuted} />
                    <Text style={[h.emptyText, { color: colors.textSecondary }]}>
                      No visits yet — be the first to explore!
                    </Text>
                  </View>
                ) : (
                  <View style={[h.grid, { gap }]}>
                    {topSpots.map((spot, i) => (
                      <TouchableOpacity
                        key={spot._id}
                        style={[
                          h.gridCard,
                          { width: cardW, backgroundColor: colors.brandLight },
                          i === 0 && h.gridCardWide,
                        ]}
                        onPress={() => handleSpotPress(spot)}
                        activeOpacity={0.88}
                        accessibilityRole="button"
                        accessibilityLabel={`Number ${i + 1}, ${spot.name}, ${spot.visitCount ?? 0} visits`}
                      >
                        <Image source={{ uri: spotImage(spot.image, cardW, 200) }} style={h.gridImg} resizeMode="cover" />
                        <PhotoScrim />
                        {/* This section is a ranking — so show the rank, big. */}
                        <Text style={[h.rankNum, i === 0 && h.rankNumWide]} allowFontScaling={false}>
                          {String(i + 1).padStart(2, "0")}
                        </Text>
                        <View style={h.gridInfoWrap}>
                          <Text style={h.gridName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {spot.name}
                          </Text>
                          {(spot.city || spot.location) && (
                            <Text style={h.gridLocationText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                              {spot.city || spot.location}
                            </Text>
                          )}
                          <View style={h.gridMeta}>
                            <View style={h.gridRatingRow}>
                              <Icon name="star" size={12} color={colors.star} weight="fill" />
                              <Text style={h.gridRatingText}>{getAverageRating(spot._id) || 0}</Text>
                            </View>
                            <View style={h.gridRatingRow}>
                              <Icon name="eye" size={11} color="rgba(255,255,255,0.9)" />
                              <Text style={h.gridVisitText}>{spot.visitCount ?? 0}</Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </Wrap>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  STYLES                                    */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  tabBarWrap: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 32,
    height: TAB_BAR_HEIGHT,
    alignItems: "center",
    paddingHorizontal: 6,
    // NOTE: intentionally NO `elevation`. On Android the elevation shadow of a
    // rounded view renders as a hard rectangle on many devices. Depth here comes
    // from a hairline border (all platforms) + a soft shadow (iOS only, which
    // always follows borderRadius correctly).
    borderWidth: 1,
    shadowColor: "#0B2E31",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === "ios" ? 0.12 : 0,
    shadowRadius: 20,
  },
  // Equal fixed slots so icons never shift as you switch tabs.
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 6,
  },
  tabIconWrap: { height: 26, alignItems: "center", justifyContent: "center" },
  tabLabel:    { fontFamily: fonts.sansSemi, fontSize: 10.5, letterSpacing: -0.1 },
  tabIndicator:{ width: 16, height: 2.5, borderRadius: 2, marginTop: 3 },
});

const h = StyleSheet.create({
  scroll: { flex: 1 },

  // ── Slim fixed header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: H_PAD,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerActions:  { flexDirection: "row", alignItems: "center", gap: 4 },
  headerBtn:      { width: TAP, height: TAP, alignItems: "center", justifyContent: "center" },
  avatar:         { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },

  // ── Greeting ──
  greeting: { paddingHorizontal: H_PAD, paddingTop: 6, paddingBottom: 4 },
  greetHi:  { ...typography.bodyStrong, fontSize: 14 },
  greetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  // The signature line of the app — the one place on Home that gets the serif.
  greetName: { ...typography.h1, fontSize: 30, flex: 1, marginRight: 10 },
  pointsPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill,
  },
  pointsText: { fontFamily: fonts.sansBold, fontSize: 13, letterSpacing: -0.2 },

  // ── Search ──
  searchWrap:  { paddingHorizontal: H_PAD, marginTop: 16 },
  resultCount: { ...typography.caption, marginTop: 20, marginBottom: 12 },

  // ── Quick actions ──
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    marginTop: 24,
  },
  quickItem: { alignItems: "center" },
  quickIcon: {
    width: 58, height: 58, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  quickLabel: { ...typography.caption, fontFamily: fonts.sansSemi },

  // ── Sections ──
  sectionHead:  { paddingHorizontal: H_PAD, marginTop: 30, marginBottom: 14 },
  sectionTitle: { ...typography.h2, fontSize: 22, lineHeight: 28 },
  sectionBody:  { paddingHorizontal: H_PAD },

  // ── Featured carousel ──
  heroWrap: { marginHorizontal: H_PAD, borderRadius: radius.card, overflow: "hidden" },
  heroSlide: { width: "100%", height: "100%" },
  heroImage: { width: "100%", height: "100%" },
  heroInfo: { position: "absolute", left: 16, right: 120, bottom: 16 },
  heroName: { ...typography.display, fontSize: 23, lineHeight: 28, color: "#fff", marginBottom: 5 },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroMeta: { color: "rgba(255,255,255,0.95)", fontFamily: fonts.sansSemi, fontSize: 12 },
  heroSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.6)", marginHorizontal: 3 },
  heroCta: {
    position: "absolute",
    right: 14, bottom: 14,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 11, paddingHorizontal: 16,
    borderRadius: radius.pill,
    shadowColor: "#0B2E31", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 12, elevation: 6,
  },
  heroCtaText: { fontFamily: fonts.sansBold, fontSize: 13, letterSpacing: -0.1 },

  dotsRow: { flexDirection: "row", gap: 5, alignSelf: "center", marginTop: 14 },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 18 },

  // ── Grid ──
  grid:         { flexDirection: "row", flexWrap: "wrap" },
  gridCard:     { height: 150, borderRadius: radius.card, overflow: "hidden" },
  gridCardWide: { width: "100%", height: 200 },
  gridImg:      { width: "100%", height: "100%", position: "absolute" },
  // Editorial rank numeral — bleeds off the top-left corner.
  rankNum: {
    position: "absolute", top: -14, left: 8,
    fontFamily: fonts.displayBlack, fontSize: 64,
    color: "rgba(255,255,255,0.20)", letterSpacing: -3,
  },
  rankNumWide:  { fontSize: 88, top: -20, left: 12 },
  gridInfoWrap: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 13 },
  gridName:     { fontFamily: fonts.sansBold, fontSize: 14, letterSpacing: -0.2, color: "#fff", marginBottom: 2 },
  gridLocationText: { fontFamily: fonts.sansMedium, fontSize: 11, color: "rgba(255,255,255,0.92)", marginBottom: 5 },
  gridMeta:      { flexDirection: "row", alignItems: "center", gap: 12 },
  gridRatingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  gridRatingText:{ fontFamily: fonts.sansBold, fontSize: 11, color: "#fff" },
  gridVisitText: { fontFamily: fonts.sansBold, fontSize: 11, color: "#fff" },

  emptyCard: {
    borderRadius: radius.card, paddingVertical: 36, paddingHorizontal: 20,
    alignItems: "center", gap: 10, borderWidth: 1,
  },
  emptyText: { ...typography.body, textAlign: "center" },
});
