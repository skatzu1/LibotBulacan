import "react-native-gesture-handler";
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import Carousel from "react-native-reanimated-carousel";
import { useAuth } from "../context/AuthContext";
import { useReviews } from "../context/ReviewContext";
import { useUser } from "@clerk/clerk-expo";
import { useArrival } from "../context/ArrivalContext";
import { useProfileImage } from "../context/ProfileImageContext";
import { useTheme } from "../context/ThemeContext";
import { BASE_URL } from "../api";

import Bookmark      from "./Bookmark";
import Leaderboard   from "./Leaderboard";
import Categories    from "./Categories";
import ProfileScreen from "./Profilescreen";

// ── Skeleton imports ──────────────────────────────────────────────────────────
import HomeSkeleton from "../components/HomeSkeleton";
import Skeleton     from "../components/Skeleton";

const { width, height } = Dimensions.get("window");
const HERO_H  = height * 0.40;
const CARD_W  = (width - 54) / 2;

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

      <Text style={[styles.drawerSection, { color: colors.brand }]}>Explore</Text>

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

  return (
    <View style={styles.tabBarWrap}>
      <View style={[styles.tabBar, { backgroundColor: colors.tabBar }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused   = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={route.name}
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              style={styles.tabItem}
            >
              {isFocused && (
                <View style={[styles.tabActiveDot, { backgroundColor: colors.tabActive }]} />
              )}
              {options.tabBarIcon?.({
                focused: isFocused,
                color:   isFocused ? colors.tabActive : colors.tabInactive,
                size:    22,
              })}
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
      <BottomTab.Screen name="HomeScreen"  component={HomeTab}     options={{ tabBarIcon: ({ color }) => <Feather name="home"     size={22} color={color} /> }} />
      <BottomTab.Screen name="Categories"  component={Categories}  options={{ tabBarIcon: ({ color }) => <Feather name="grid"     size={22} color={color} /> }} />
      <BottomTab.Screen name="Bookmark"    component={Bookmark}    options={{ tabBarIcon: ({ color }) => <Feather name="bookmark" size={22} color={color} /> }} />
      <BottomTab.Screen name="Leaderboard" component={Leaderboard} options={{ tabBarIcon: ({ color }) => <Feather name="award"    size={22} color={color} /> }} />
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
  const [topSpots,    setTopSpots]    = useState([]);
  const [topLoading,  setTopLoading]  = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleSpotPress = (spot) => navigation.navigate("InformationScreen", { spot });

  const sliderData = allSpots.slice(0, 8).map(
    ({ _id, image, name, description, location, rating, modelUrl, visitCount }, i) => ({
      id:          _id || String(i),
      image,
      title:       name,
      location:    location || "Philippines",
      description: description || "",
      rating:      getAverageRating(_id) || 0,
      visitCount:  visitCount ?? 0,
      spot:        { _id, image, name, description, location, rating, modelUrl },
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTopSpots().finally(() => setRefreshing(false));
  }, [loadTopSpots]);

  return (
    // ── CHANGED: outer wrapper now holds a FIXED header (outside ScrollView) ──
    // This mirrors InformationScreen's topHeader, which sits above its ScrollView
    // and therefore never scrolls away.
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── FIXED HEADER (stays visible while scrolling) ─── */}
      <View style={[h.fixedHeader, { backgroundColor: colors.heroHeader }]}>
        <TouchableOpacity
          style={h.menuBtn}
          onPress={() => navigation.toggleDrawer()}
          accessibilityLabel="Open menu"
        >
          <View style={[h.menuLine, { backgroundColor: colors.brand }]} />
          <View style={[h.menuLine, { width: 14, backgroundColor: colors.brand }]} />
          <View style={[h.menuLine, { backgroundColor: colors.brand }]} />
        </TouchableOpacity>

        <View style={[h.logoWrap, { backgroundColor: colors.heroHeader, borderColor: colors.cardBorder }]}>
          <Image source={require("../assets/logo.png")} style={h.logo} resizeMode="contain" />
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("Profile")}
          style={h.avatarWrap}
          accessibilityLabel="Go to profile"
        >
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={h.avatar} accessibilityLabel="Your profile photo" />
          ) : (
            <View style={[h.avatar, h.avatarFallback]}>
              <Feather name="user" size={18} color="#fff" />
            </View>
          )}
          <View style={[h.onlineDot, { backgroundColor: colors.brand, borderColor: colors.heroHeader }]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[h.scroll, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {/* ─── HERO (header removed from here — now lives above the ScrollView) ─── */}
        <View style={[h.heroWrap, { backgroundColor: colors.backgroundHero }]}>
          {sliderData.length === 0 ? (
            <Skeleton width={width} height={HERO_H} radius={0} />
          ) : (
            <Carousel
              width={width}
              height={HERO_H}
              data={sliderData}
              loop
              autoPlay
              autoPlayInterval={4000}
              scrollAnimationDuration={900}
              onProgressChange={(_, abs) =>
                setActiveIndex(Math.round(abs) % sliderData.length)
              }
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item.image }}
                  style={h.heroImage}
                  resizeMode="cover"
                  accessibilityLabel={`Hero image of ${item.title}`}
                />
              )}
            />
          )}

          {/* Pagination dots */}
          {sliderData.length > 0 && (
            <View style={h.dotsRow}>
              {sliderData.map((_, i) => (
                <View
                  key={i}
                  style={[
                    h.dot,
                    i === activeIndex && h.dotActive,
                  ]}
                />
              ))}
            </View>
          )}

          {/* Explore button */}
          {activeSpot && (
            <TouchableOpacity
              style={[h.heroExploreBtn, { backgroundColor: colors.brand }]}
              onPress={() => handleSpotPress(activeSpot.spot)}
              activeOpacity={0.85}
              accessibilityLabel={`Explore ${activeSpot.title}`}
            >
              <Text style={h.heroExploreBtnText}>Explore Spot</Text>
              <Feather name="arrow-right" size={14} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* ─── SPOT INFO CARD ─── */}
        {activeSpot && (
          <View style={[h.infoCard, { backgroundColor: colors.background }]}>
            <View style={h.infoRow}>
              <Text style={[h.spotName, { color: colors.textPrimary }]} numberOfLines={1}>
                {activeSpot.title}
              </Text>
              <View style={[h.visitsBadge, { backgroundColor: colors.card }]}>
                <Feather name="eye" size={12} color={colors.brand} />
                <Text style={[h.visitsText, { color: colors.brand }]}> {activeSpot.visitCount} visits</Text>
              </View>
            </View>

            <View style={h.infoRow}>
              <View style={h.locationRow}>
                <Feather name="map-pin" size={13} color={colors.brand} />
                <Text style={[h.locationText, { color: colors.brand }]}>{activeSpot.location}</Text>
              </View>
              <View style={h.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <MaterialIcons
                    key={s}
                    name="star"
                    size={14}
                    color={s <= Math.round(activeSpot.rating) ? colors.star : colors.starEmpty}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ─── TOP CITIES ─── */}
        <View style={h.section}>
          <Text style={[h.sectionTitle, { color: colors.textPrimary }]}>Top Cities</Text>

          {topLoading ? (
            <View>
              <Skeleton width="100%" height={175} radius={18} style={{ marginBottom: 10 }} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Skeleton width={CARD_W} height={140} radius={18} />
                <Skeleton width={CARD_W} height={140} radius={18} />
              </View>
            </View>
          ) : topSpots.length === 0 ? (
            <Text style={[h.emptyText, { color: colors.textMuted }]}>
              No visits yet — be the first to explore!
            </Text>
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
                  <View style={[h.gridOverlay, { backgroundColor: colors.overlay }]} />
                  <View style={h.gridInfoWrap}>
                    <Text style={h.gridName} numberOfLines={1}>{spot.name}</Text>
                    <View style={h.gridMeta}>
                      <View style={h.gridRatingRow}>
                        <MaterialIcons name="star" size={11} color={colors.star} />
                        <Text style={h.gridRatingText}>{getAverageRating(spot._id) || 0}</Text>
                      </View>
                      <View style={h.gridVisitRow}>
                        <Feather name="eye" size={10} color="rgba(255,255,255,0.8)" />
                        <Text style={h.gridVisitText}> {spot.visitCount ?? 0}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 160 }} />
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
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel",  style: "cancel",     onPress: () => navigation.navigate("HomeSide") },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try   { await logout(); }
            catch { Alert.alert("Error", "Failed to log out. Please try again."); }
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
  drawerContainer: { flex: 1, paddingTop: 40, paddingHorizontal: 8 },
  drawerHeading:   { fontSize: 22, fontWeight: "700", paddingHorizontal: 16, marginBottom: 8 },
  drawerSection:   { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, paddingHorizontal: 16, marginTop: 20, marginBottom: 4 },
  drawerLabel:     { fontSize: 15, fontWeight: "500" },
  drawerDivider:   { height: 1, marginHorizontal: 16, marginVertical: 12 },

  tabBarWrap: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    alignItems: "center",
    paddingBottom: 24,
    backgroundColor: "transparent",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 32,
    height: 64,
    width: width * 0.82,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    shadowColor: "#4a2e2c",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  tabActiveDot: {
    position: "absolute",
    top: 8,
    width: 4, height: 4,
    borderRadius: 2,
  },
});

const h = StyleSheet.create({
  scroll: { flex: 1 },

  // ── NEW: fixed header, sibling of ScrollView (same pattern as
  // InformationScreen's `topHeader`) so it never scrolls away.
  fixedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 10,
  },

  heroWrap: {
    width: "100%",
    height: HERO_H,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },
  heroImage: { width: "100%", height: HERO_H },

  menuBtn:  { gap: 5, justifyContent: "center" },
  menuLine: { width: 22, height: 2.5, borderRadius: 2 },

  logoWrap: {
    width: 60,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
  },
  logo: { height: 40, width: 100 },

  avatarWrap:     { position: "relative" },
  avatar:         { width: 42, height: 42, borderRadius: 21, borderWidth: 2.5, borderColor: "#fff" },
  avatarFallback: { backgroundColor: "rgba(107,75,69,0.8)", justifyContent: "center", alignItems: "center" },
  onlineDot: {
    position: "absolute",
    bottom: 1, right: 1,
    width: 11, height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },

  dotsRow:   { position: "absolute", bottom: 16, left: 0, right: 0, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  dot:       { width: 6,  height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
  dotActive: { width: 18, height: 6, borderRadius: 3, backgroundColor: "#fff" },

  heroExploreBtn: {
    position: "absolute",
    bottom: 10,
    right: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  heroExploreBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  infoCard:     { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 6 },
  infoRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  spotName:     { fontSize: 22, fontWeight: "800", flex: 1, marginRight: 8 },
  visitsBadge:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  visitsText:   { fontSize: 12, fontWeight: "600" },
  locationRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 13, fontWeight: "600" },
  starsRow:     { flexDirection: "row", gap: 2 },

  section:      { paddingHorizontal: 22, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 14 },
  emptyText:    { fontSize: 13, textAlign: "center" },

  grid:          { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCard:      { width: (width - 54) / 2, height: 140, borderRadius: 18, overflow: "hidden" },
  gridCardWide:  { width: "100%", height: 175 },
  gridImg:       { width: "100%", height: "100%", position: "absolute" },
  gridOverlay:   { ...StyleSheet.absoluteFillObject },
  gridInfoWrap:  { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: "rgba(0,0,0,0.25)" },
  gridName:      { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 4 },
  gridMeta:      { flexDirection: "row", alignItems: "center", gap: 10 },
  gridRatingRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  gridRatingText:{ fontSize: 11, fontWeight: "700", color: "#fff" },
  gridVisitRow:  { flexDirection: "row", alignItems: "center" },
  gridVisitText: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "500" },
});