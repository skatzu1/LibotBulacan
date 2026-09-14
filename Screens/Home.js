import "react-native-gesture-handler";
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
  RefreshControl,
  Platform,
} from "react-native";
import { showAlert } from "../components/AppAlert";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import Carousel from "react-native-reanimated-carousel";
import { useAuth } from "../context/AuthContext";
import { useReviews } from "../context/ReviewContext";
import { useUser } from "@clerk/clerk-expo";
import { useArrival } from "../context/ArrivalContext";
import { useProfileImage } from "../context/ProfileImageContext";
import { usePoints } from "../context/PointsContext";
import { useTheme } from "../context/ThemeContext";
import Logo from "../components/Logo";
import { BASE_URL } from "../api";

import Bookmark      from "./Bookmark";
import Leaderboard   from "./Leaderboard";
import Categories    from "./Categories";
import ProfileScreen from "./Profilescreen";

// ── Skeleton imports ──────────────────────────────────────────────────────────
import HomeSkeleton from "../components/HomeSkeleton";
import Skeleton     from "../components/Skeleton";

const { width, height } = Dimensions.get("window");
const HERO_H  = Math.round(height * 0.36);
const H_PAD   = 20;                       // screen horizontal gutter
const CARD_W  = (width - H_PAD * 2 - 12) / 2;

// Feature shortcuts surfaced on the home screen (all live in the root stack).
const QUICK_ACTIONS = [
  { key: "ar",       label: "AR View",  icon: "compass",    route: "ARSpotSelect" },
  { key: "missions", label: "Missions", icon: "flag",       route: "MissionsSpotSelect" },
  { key: "navigate", label: "Navigate", icon: "navigation", route: "TrackSpotSelect" },
  { key: "trips",    label: "My Trips", icon: "map",         route: "PreviousTrips" },
];

const greetingFor = (d = new Date()) => {
  const hr = d.getHours();
  return hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
};

const Drawer    = createDrawerNavigator();
const BottomTab = createBottomTabNavigator();

/* -------------------------------------------------------------------------- */
/*                         CUSTOM DRAWER CONTENT                              */
/* -------------------------------------------------------------------------- */
function CustomDrawerContent(props) {
  const { navigation } = props;
  const { colors } = useTheme();

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[styles.drawerContainer, { backgroundColor: colors.drawer }]}
    >
      <Text style={[styles.drawerHeading, { color: colors.drawerText }]}>Menu</Text>

      <DrawerItem label="Home"    labelStyle={[styles.drawerLabel, { color: colors.drawerText }]} inactiveTintColor={colors.drawerText} icon={({ color }) => <Feather name="home"      size={20} color={color} />} onPress={() => navigation.navigate("HomeSide")} />
      <DrawerItem label="Profile" labelStyle={[styles.drawerLabel, { color: colors.drawerText }]} inactiveTintColor={colors.drawerText} icon={({ color }) => <Feather name="user"      size={20} color={color} />} onPress={() => navigation.navigate("Profile")} />

      <Text style={[styles.drawerSection, { color: colors.brandDark }]}>Explore</Text>

      <DrawerItem label="AR Experience"    labelStyle={[styles.drawerLabel, { color: colors.drawerText }]} inactiveTintColor={colors.drawerText} icon={({ color }) => <Feather name="camera"    size={20} color={color} />} onPress={() => navigation.navigate("ARSpotSelect")} />
      <DrawerItem label="Mission"          labelStyle={[styles.drawerLabel, { color: colors.drawerText }]} inactiveTintColor={colors.drawerText} icon={({ color }) => <Feather name="flag"       size={20} color={color} />} onPress={() => navigation.navigate("MissionsSpotSelect")} />
      <DrawerItem label="Navigate to Spot" labelStyle={[styles.drawerLabel, { color: colors.drawerText }]} inactiveTintColor={colors.drawerText} icon={({ color }) => <Feather name="navigation" size={20} color={color} />} onPress={() => navigation.navigate("TrackSpotSelect")} />

      <View style={[styles.drawerDivider, { backgroundColor: colors.divider }]} />

      <DrawerItem
        label="Logout"
        labelStyle={[styles.drawerLabel, { color: colors.danger }]}
        inactiveTintColor={colors.danger}
        icon={({ color }) => <Feather name="log-out" size={20} color={color} />}
        onPress={() => navigation.navigate("Logout")}
      />
    </DrawerContentScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/*                            CUSTOM BOTTOM TAB                               */
/* -------------------------------------------------------------------------- */
function CustomTabBar({ state, descriptors, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]} pointerEvents="box-none">
      <View style={[styles.tabBar, { backgroundColor: colors.tabBar, borderColor: colors.divider }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused   = state.index === index;
          const label       = options.tabBarLabel ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={isFocused ? { selected: true } : {}}
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
function HomeBottomTabs() {
  return (
    <BottomTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <BottomTab.Screen name="HomeScreen"  component={HomeTab}     options={{ tabBarLabel: "Home",    tabBarIcon: ({ color, size }) => <Feather name="home"     size={size} color={color} /> }} />
      <BottomTab.Screen name="Categories"  component={Categories}  options={{ tabBarLabel: "Explore", tabBarIcon: ({ color, size }) => <Feather name="grid"     size={size} color={color} /> }} />
      <BottomTab.Screen name="Bookmark"    component={Bookmark}    options={{ tabBarLabel: "Saved",   tabBarIcon: ({ color, size }) => <Feather name="bookmark" size={size} color={color} /> }} />
      <BottomTab.Screen name="Leaderboard" component={Leaderboard} options={{ tabBarLabel: "Ranking", tabBarIcon: ({ color, size }) => <Feather name="award"    size={size} color={color} /> }} />
    </BottomTab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                               HOME TAB                                     */
/* -------------------------------------------------------------------------- */
function HomeTab() {
  const navigation                = useNavigation();
  const { user: authUser }        = useAuth();
  const { user: clerkUser }       = useUser();
  const { profileImage, loading } = useProfileImage();
  const { colors }                = useTheme();

  if (loading) return <HomeSkeleton />;

  const profilePhoto =
    profileImage ??
    clerkUser?.imageUrl ??
    clerkUser?.profileImageUrl ??
    authUser?.profilePhoto ??
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
  const [topSpots,    setTopSpots]    = useState([]);
  const [topLoading,  setTopLoading]  = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const firstName = (clerkUser?.firstName || "").trim() || "Explorer";

  const handleSpotPress = (spot) => navigation.navigate("InformationScreen", { spot });

  const sliderData = allSpots.slice(0, 8).map(
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
  );

  const activeSpot = sliderData[activeIndex] ?? null;

  const loadTopSpots = useCallback(() => {
    return fetch(`${BASE_URL}/api/spots/top/visited`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setTopSpots(d.spots.filter((s) => (s.visitCount ?? 0) > 0));
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadTopSpots().finally(() => setTopLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { refreshPoints(); }, [refreshPoints]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTopSpots().finally(() => setRefreshing(false));
  }, [loadTopSpots]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── Slim fixed header ─── */}
      <View style={[h.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={h.headerBtn}
          onPress={() => navigation.toggleDrawer()}
          accessibilityLabel="Open menu"
          hitSlop={8}
        >
          <Feather name="menu" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <Logo size={32} />

        <TouchableOpacity
          onPress={() => navigation.navigate("Profile")}
          style={h.headerBtn}
          accessibilityLabel="Go to profile"
        >
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={h.avatar} accessibilityLabel="Your profile photo" />
          ) : (
            <View style={[h.avatar, h.avatarFallback, { backgroundColor: colors.brand }]}>
              <Feather name="user" size={16} color={colors.onBrand} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[h.scroll, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
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
        <View style={h.greeting}>
          <Text style={[h.greetHi, { color: colors.textMuted }]}>{greetingFor()},</Text>
          <View style={h.greetRow}>
            <Text style={[h.greetName, { color: colors.textPrimary }]} numberOfLines={1}>
              {firstName}
            </Text>
            <View style={[h.pointsPill, { backgroundColor: colors.card }]}>
              <MaterialIcons name="stars" size={15} color={colors.brand} />
              <Text style={[h.pointsText, { color: colors.textPrimary }]}>{userPoints ?? 0}</Text>
            </View>
          </View>
          <Text style={[h.greetSub, { color: colors.textSecondary }]}>
            Discover Bulacan's best spots
          </Text>
        </View>

        {/* ─── Quick actions ─── */}
        <View style={h.quickRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={h.quickItem}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(a.route)}
              accessibilityLabel={a.label}
            >
              <View style={[h.quickIcon, { backgroundColor: colors.card }]}>
                <Feather name={a.icon} size={21} color={colors.brand} />
              </View>
              <Text style={[h.quickLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Featured carousel ─── */}
        <View style={h.sectionHead}>
          <Text style={[h.sectionTitle, { color: colors.textPrimary }]}>Featured</Text>
        </View>

        <View style={h.heroWrap}>
          {sliderData.length === 0 ? (
            <Skeleton width={width - H_PAD * 2} height={HERO_H} radius={24} />
          ) : (
            <Carousel
              width={width - H_PAD * 2}
              height={HERO_H}
              style={{ borderRadius: 24 }}
              data={sliderData}
              loop
              autoPlay
              autoPlayInterval={4500}
              scrollAnimationDuration={900}
              onProgressChange={(_, abs) =>
                setActiveIndex(Math.round(abs) % sliderData.length)
              }
              renderItem={({ item }) => (
                <View style={h.heroSlide}>
                  <Image
                    source={{ uri: item.image }}
                    style={h.heroImage}
                    resizeMode="cover"
                    accessibilityLabel={`Hero image of ${item.title}`}
                  />
                  <View style={h.heroScrim} />
                  <View style={h.heroInfo}>
                    <Text style={h.heroName} numberOfLines={1}>{item.title}</Text>
                    <View style={h.heroMetaRow}>
                      <Feather name="map-pin" size={12} color="rgba(255,255,255,0.92)" />
                      <Text style={h.heroMeta} numberOfLines={1}>{item.location}</Text>
                      <View style={h.heroSep} />
                      <MaterialIcons name="star" size={13} color={colors.star} />
                      <Text style={h.heroMeta}>{item.rating}</Text>
                    </View>
                  </View>
                </View>
              )}
            />
          )}

          {activeSpot && (
            <TouchableOpacity
              style={[h.heroCta, { backgroundColor: colors.accent }]}
              onPress={() => handleSpotPress(activeSpot.spot)}
              activeOpacity={0.9}
              accessibilityLabel={`Explore ${activeSpot.title}`}
            >
              <Text style={[h.heroCtaText, { color: colors.onAccent }]}>Explore</Text>
              <Feather name="arrow-up-right" size={15} color={colors.onAccent} />
            </TouchableOpacity>
          )}
        </View>

        {sliderData.length > 1 && (
          <View style={h.dotsRow}>
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

        {/* ─── Most visited ─── */}
        <View style={h.sectionHead}>
          <Text style={[h.sectionTitle, { color: colors.textPrimary }]}>Most visited</Text>
        </View>

        <View style={h.sectionBody}>
          {topLoading ? (
            <View>
              <Skeleton width="100%" height={185} radius={22} style={{ marginBottom: 12 }} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Skeleton width={CARD_W} height={150} radius={22} />
                <Skeleton width={CARD_W} height={150} radius={22} />
              </View>
            </View>
          ) : topSpots.length === 0 ? (
            <View style={[h.emptyCard, { backgroundColor: colors.card }]}>
              <Feather name="map" size={26} color={colors.textMuted} />
              <Text style={[h.emptyText, { color: colors.textSecondary }]}>
                No visits yet — be the first to explore!
              </Text>
            </View>
          ) : (
            <View style={h.grid}>
              {topSpots.map((spot, i) => (
                <TouchableOpacity
                  key={spot._id}
                  style={[h.gridCard, i === 0 && h.gridCardWide, { backgroundColor: colors.card }]}
                  onPress={() => handleSpotPress(spot)}
                  activeOpacity={0.88}
                  accessibilityLabel={`Explore ${spot.name}`}
                >
                  <Image source={{ uri: spot.image }} style={h.gridImg} resizeMode="cover" accessibilityLabel={spot.name} />
                  <View style={h.gridScrim} />
                  <View style={h.gridInfoWrap}>
                    <Text style={h.gridName} numberOfLines={1}>{spot.name}</Text>
                    {(spot.city || spot.location) && (
                      <Text style={h.gridLocationText} numberOfLines={1}>
                        {spot.city || spot.location}
                      </Text>
                    )}
                    <View style={h.gridMeta}>
                      <View style={h.gridRatingRow}>
                        <MaterialIcons name="star" size={12} color={colors.star} />
                        <Text style={h.gridRatingText}>{getAverageRating(spot._id) || 0}</Text>
                      </View>
                      <View style={h.gridVisitRow}>
                        <Feather name="eye" size={11} color="rgba(255,255,255,0.85)" />
                        <Text style={h.gridVisitText}> {spot.visitCount ?? 0}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                               DRAWER NAV                                   */
/* -------------------------------------------------------------------------- */
export default function HomeDrawer() {
  const { colors } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: colors.drawer },
      }}
    >
      <Drawer.Screen name="HomeSide" component={HomeBottomTabs} />
      <Drawer.Screen name="Profile"  component={ProfileScreen} />
      <Drawer.Screen name="Logout"   component={LogoutScreen} />
    </Drawer.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                               LOGOUT SCREEN                                */
/* -------------------------------------------------------------------------- */
function LogoutScreen() {
  const { logout }   = useAuth();
  const navigation   = useNavigation();

  useFocusEffect(
    React.useCallback(() => {
      showAlert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel",  style: "cancel",     onPress: () => navigation.navigate("HomeSide") },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try   { await logout(); }
            catch { showAlert("Error", "Failed to log out. Please try again."); }
          },
        },
      ]);
    }, [])
  );
  return null;
}

/* -------------------------------------------------------------------------- */
/*                                  STYLES                                    */
/* -------------------------------------------------------------------------- */
const styles = StyleSheet.create({
  drawerContainer: { flex: 1, paddingTop: 48, paddingHorizontal: 10 },
  drawerHeading:   { fontSize: 26, fontWeight: "800", letterSpacing: -0.4, paddingHorizontal: 16, marginBottom: 12 },
  drawerSection:   { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, paddingHorizontal: 16, marginTop: 24, marginBottom: 6 },
  drawerLabel:     { fontSize: 15, fontWeight: "600" },
  drawerDivider:   { height: 1, marginHorizontal: 16, marginVertical: 16 },

  tabBarWrap: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 32,
    height: 66,
    width: width - 32,
    maxWidth: 440,
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
  tabIconWrap: {
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  tabIndicator: {
    width: 16,
    height: 2.5,
    borderRadius: 2,
    marginTop: 3,
  },
});

const h = StyleSheet.create({
  scroll: { flex: 1 },

  // ── Slim fixed header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 52,
    paddingHorizontal: H_PAD,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerBtn:      { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  avatar:         { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },

  // ── Greeting ──
  greeting: { paddingHorizontal: H_PAD, paddingTop: 6, paddingBottom: 4 },
  greetHi:  { fontSize: 14, fontWeight: "600" },
  greetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  greetName: { fontSize: 27, fontWeight: "800", letterSpacing: -0.6, flex: 1, marginRight: 10 },
  greetSub:  { fontSize: 13.5, fontWeight: "500", marginTop: 4 },
  pointsPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  pointsText: { fontSize: 13, fontWeight: "800", letterSpacing: -0.2 },

  // ── Quick actions ──
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    marginTop: 20,
  },
  quickItem: { alignItems: "center", width: (width - H_PAD * 2 - 30) / 4 },
  quickIcon: {
    width: 58, height: 58, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  quickLabel: { fontSize: 11.5, fontWeight: "600" },

  // ── Sections ──
  sectionHead: {
    paddingHorizontal: H_PAD,
    marginTop: 30,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  sectionBody:  { paddingHorizontal: H_PAD },

  // ── Featured carousel ──
  heroWrap: {
    marginHorizontal: H_PAD,
    height: HERO_H,
    borderRadius: 24,
    overflow: "hidden",
  },
  heroSlide: { width: "100%", height: "100%" },
  heroImage: { width: "100%", height: "100%" },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    top: "45%",
    backgroundColor: "rgba(6,20,22,0.62)",
  },
  heroInfo: { position: "absolute", left: 16, right: 120, bottom: 16 },
  heroName: { color: "#fff", fontSize: 19, fontWeight: "800", letterSpacing: -0.3, marginBottom: 5 },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroMeta: { color: "rgba(255,255,255,0.92)", fontSize: 12, fontWeight: "600" },
  heroSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.6)", marginHorizontal: 3 },
  heroCta: {
    position: "absolute",
    right: 14, bottom: 14,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 11, paddingHorizontal: 16,
    borderRadius: 999,
    shadowColor: "#0B2E31", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 12, elevation: 6,
  },
  heroCtaText: { fontWeight: "800", fontSize: 13, letterSpacing: -0.1 },

  dotsRow: { flexDirection: "row", gap: 5, alignSelf: "center", marginTop: 14 },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 18 },

  // ── Most visited grid ──
  grid:         { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridCard:     { width: CARD_W, height: 150, borderRadius: 22, overflow: "hidden" },
  gridCardWide: { width: "100%", height: 185 },
  gridImg:      { width: "100%", height: "100%", position: "absolute" },
  gridScrim:    { ...StyleSheet.absoluteFillObject, top: "40%", backgroundColor: "rgba(6,20,22,0.55)" },
  gridInfoWrap: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 13 },
  gridName:      { fontSize: 14, fontWeight: "800", letterSpacing: -0.2, color: "#fff", marginBottom: 2 },
  gridLocationText: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "500", marginBottom: 5 },
  gridMeta:      { flexDirection: "row", alignItems: "center", gap: 12 },
  gridRatingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  gridRatingText:{ fontSize: 11, fontWeight: "700", color: "#fff" },
  gridVisitRow:  { flexDirection: "row", alignItems: "center" },
  gridVisitText: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "500" },

  emptyCard: {
    borderRadius: 22, paddingVertical: 36, paddingHorizontal: 20,
    alignItems: "center", gap: 10,
  },
  emptyText: { fontSize: 13, textAlign: "center", fontWeight: "500" },
});