import "react-native-gesture-handler";
import React from "react";
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
import Carousel from "react-native-reanimated-carousel";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useReviews } from "../context/ReviewContext";
import { useUser } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { useProfileImage } from "../context/ProfileImageContext";

import Bookmark      from "./Bookmark";
import Leaderboard   from "./Leaderboard";
import Categories    from "./Categories";
import ProfileScreen from "./Profilescreen";

const { width, height } = Dimensions.get("window");
const HERO_H            = height * 0.40;

const Drawer    = createDrawerNavigator();
const BottomTab = createBottomTabNavigator();

/* -------------------------------------------------------------------------- */
/*                         CUSTOM DRAWER CONTENT                              */
/* -------------------------------------------------------------------------- */
function CustomDrawerContent(props) {
  const { navigation } = props;
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContainer}>
      <Text style={styles.drawerHeading}>Menu</Text>

      <DrawerItem label="Home"    icon={({ color }) => <Feather name="home"      size={20} color={color} />} onPress={() => navigation.navigate("HomeSide")}           labelStyle={styles.drawerLabel} inactiveTintColor="#3a2a28" />
      <DrawerItem label="Profile" icon={({ color }) => <Feather name="user"      size={20} color={color} />} onPress={() => navigation.navigate("Profile")}            labelStyle={styles.drawerLabel} inactiveTintColor="#3a2a28" />

      <Text style={styles.drawerSection}>Explore</Text>

      <DrawerItem label="AR Experience"    icon={({ color }) => <Feather name="camera"    size={20} color={color} />} onPress={() => navigation.navigate("ARSpotSelect")}       labelStyle={styles.drawerLabel} inactiveTintColor="#3a2a28" />
      <DrawerItem label="Mission"          icon={({ color }) => <Feather name="flag"       size={20} color={color} />} onPress={() => navigation.navigate("MissionsSpotSelect")} labelStyle={styles.drawerLabel} inactiveTintColor="#3a2a28" />
      <DrawerItem label="Navigate to Spot" icon={({ color }) => <Feather name="navigation" size={20} color={color} />} onPress={() => navigation.navigate("TrackSpotSelect")}    labelStyle={styles.drawerLabel} inactiveTintColor="#3a2a28" />

      <View style={styles.drawerDivider} />

      <DrawerItem label="Logout" icon={({ color }) => <Feather name="log-out" size={20} color={color} />} onPress={() => navigation.navigate("Logout")} labelStyle={[styles.drawerLabel, { color: "#c0392b" }]} inactiveTintColor="#c0392b" />
    </DrawerContentScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/*                            CUSTOM BOTTOM TAB                               */
/* -------------------------------------------------------------------------- */
function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.tabBarWrap}>
      <View style={styles.tabBar}>
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
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              style={styles.tabItem}
            >
              {isFocused && <View style={styles.tabActiveDot} />}
              {options.tabBarIcon?.({
                focused: isFocused,
                color:   isFocused ? "#6b4b45" : "#b0a09e",
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
/*                               HOME SCREEN                                  */
/* -------------------------------------------------------------------------- */
function HomeTab() {
  const navigation                = useNavigation();
  const { user: authUser }        = useAuth();
  const { user: clerkUser }       = useUser();
  const { profileImage, loading } = useProfileImage();

  if (loading) return null;

  const profilePhoto =
    profileImage ??
    clerkUser?.imageUrl ??
    clerkUser?.profileImageUrl ??
    authUser?.profilePhoto ??
    null;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <HomeContent profilePhoto={profilePhoto} navigation={navigation} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                              HOME CONTENT                                  */
/* -------------------------------------------------------------------------- */
function HomeContent({ profilePhoto, navigation }) {
  const { getAverageRating }        = useReviews();
  const [spots, setSpots]           = useState([]);
  const [topSpots, setTopSpots]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [topLoading, setTopLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleSpotPress = (spot) => navigation.navigate("InformationScreen", { spot });

  const sliderData = spots.slice(0, 8).map(
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

  useEffect(() => {
    fetch("https://libotbackend.onrender.com/api/spots")
      .then((r) => r.json())
      .then((d) => { if (d.success) setSpots(d.spots); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("https://libotbackend.onrender.com/api/spots/top/visited")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setTopSpots(d.spots.filter((s) => (s.visitCount ?? 0) > 0));
      })
      .catch(console.error)
      .finally(() => setTopLoading(false));
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      fetch("https://libotbackend.onrender.com/api/spots").then((r) => r.json()).then((d) => { if (d.success) setSpots(d.spots); }),
      fetch("https://libotbackend.onrender.com/api/spots/top/visited").then((r) => r.json()).then((d) => {
        if (d.success) setTopSpots(d.spots.filter((s) => (s.visitCount ?? 0) > 0));
      }),
    ]).catch(console.error).finally(() => setRefreshing(false));
  }, []);

  return (
    <ScrollView
      style={h.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6b4b45" colors={["#6b4b45"]} />}
    >
      {/* ─────────────── HERO ─────────────── */}
      <View style={h.heroWrap}>
        {loading || sliderData.length === 0 ? (
          <View style={h.heroPlaceholder}>
            <Text style={{ color: "rgba(255,255,255,0.6)" }}>Loading…</Text>
          </View>
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
              />
            )}
          />
        )}

        {/* Dark gradient overlay at bottom of hero */}
        <View style={h.heroGradient} />

        {/* Floating header — menu | logo | avatar */}
        <View style={h.heroHeader}>
          <TouchableOpacity style={h.menuBtn} onPress={() => navigation.toggleDrawer()}>
            <View style={h.menuLine} />
            <View style={[h.menuLine, { width: 14 }]} />
            <View style={h.menuLine} />
          </TouchableOpacity>

          {/* ── LOGO ── */}
          <View style={h.logoWrap}>
            <Image
              source={require("../assets/logo.png")}
              style={h.logo}
              resizeMode="contain"
            />
          </View>

          <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={h.avatarWrap}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={h.avatar} />
            ) : (
              <View style={[h.avatar, h.avatarFallback]}>
                <Feather name="user" size={18} color="#fff" />
              </View>
            )}
            <View style={h.onlineDot} />
          </TouchableOpacity>
        </View>

        {/* Pagination dots */}
        {sliderData.length > 0 && (
          <View style={h.dotsRow}>
            {sliderData.map((_, i) => (
              <View key={i} style={[h.dot, i === activeIndex && h.dotActive]} />
            ))}
          </View>
        )}

        {/* ── EXPLORE BUTTON overlaid on hero ── */}
        {activeSpot && (
          <TouchableOpacity
            style={h.heroExploreBtn}
            onPress={() => handleSpotPress(activeSpot.spot)}
            activeOpacity={0.85}
          >
            <Text style={h.heroExploreBtnText}>Explore Spot</Text>
            <Feather name="arrow-right" size={14} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* ─────────────── SPOT INFO CARD ─────────────── */}
      {activeSpot && (
        <View style={h.infoCard}>
          <View style={h.infoRow}>
            <Text style={h.spotName} numberOfLines={1}>{activeSpot.title}</Text>
            <View style={h.visitsBadge}>
              <Feather name="eye" size={12} color="#6b4b45" />
              <Text style={h.visitsText}> {activeSpot.visitCount} visits</Text>
            </View>
          </View>

          <View style={h.infoRow}>
            <View style={h.locationRow}>
              <Feather name="map-pin" size={13} color="#6b4b45" />
              <Text style={h.locationText}>{activeSpot.location}</Text>
            </View>
            <View style={h.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <MaterialIcons
                  key={s}
                  name="star"
                  size={14}
                  color={s <= Math.round(activeSpot.rating) ? "#f4c542" : "#e0d0ce"}
                />
              ))}
            </View>
          </View>
          {/* description removed */}
        </View>
      )}

      {/* ─────────────── TOP CITIES ─────────────── */}
      <View style={h.section}>
        <Text style={h.sectionTitle}>Top Cities</Text>
        {topLoading ? (
          <View style={h.loadingBox}><Text style={h.loadingText}>Loading…</Text></View>
        ) : topSpots.length === 0 ? (
          <Text style={h.emptyText}>No visits yet — be the first to explore!</Text>
        ) : (
          <View style={h.grid}>
            {topSpots.map((spot, i) => (
              <TouchableOpacity
                key={spot._id}
                style={[h.gridCard, i === 0 && h.gridCardWide]}
                onPress={() => handleSpotPress(spot)}
                activeOpacity={0.88}
              >
                <Image source={{ uri: spot.image }} style={h.gridImg} resizeMode="cover" />
                <View style={h.gridOverlay} />
                <View style={h.gridInfoWrap}>
                  <Text style={h.gridName} numberOfLines={1}>{spot.name}</Text>
                  <View style={h.gridMeta}>
                    <View style={h.gridRatingRow}>
                      <MaterialIcons name="star" size={11} color="#f4c542" />
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
  );
}

/* -------------------------------------------------------------------------- */
/*                               DRAWER NAV                                   */
/* -------------------------------------------------------------------------- */
export default function HomeDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{ headerShown: false, drawerStyle: { backgroundColor: "#dbbcb7" } }}
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
  const { logout } = useAuth();
  const navigation = useNavigation();

  useFocusEffect(
    React.useCallback(() => {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel",  style: "cancel",     onPress: () => navigation.navigate("HomeSide") },
        { text: "Log Out", style: "destructive", onPress: async () => {
            try { await logout(); navigation.replace("Login"); }
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
  drawerHeading:   { fontSize: 22, fontWeight: "700", color: "#3a2a28", paddingHorizontal: 16, marginBottom: 8 },
  drawerSection:   { fontSize: 11, fontWeight: "700", color: "#8b5550", letterSpacing: 1.2, paddingHorizontal: 16, marginTop: 20, marginBottom: 4 },
  drawerLabel:     { fontSize: 15, fontWeight: "500" },
  drawerDivider:   { height: 1, backgroundColor: "rgba(90,74,74,0.2)", marginHorizontal: 16, marginVertical: 12 },

  tabBarWrap: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    alignItems: "center",
    paddingBottom: 24,
    backgroundColor: "transparent",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
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
    backgroundColor: "#6b4b45",
  },
});

const h = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fff" },

  heroWrap: {
    width: "100%",
    height: HERO_H,
    backgroundColor: "#c4a49f",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },
  heroPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  heroImage:       { width: "100%", height: HERO_H },

  // Dark gradient at bottom of hero so button/dots are readable
  heroGradient: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: HERO_H * 0.45,
    backgroundColor: "transparent",
    // RN doesn't support CSS gradients natively — use expo-linear-gradient if you want a true gradient
    // For now this gives a solid dark fade effect via the button/dots contrast
  },

  // AFTER
heroHeader: {
  position: "absolute",
  top: 0, left: 0, right: 0,
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingTop: 50,
  paddingHorizontal: 20,
  paddingBottom: 10,
},
  menuBtn:  { gap: 5, justifyContent: "center" },
  menuLine: { width: 22, height: 2.5, backgroundColor: "#fff", borderRadius: 2 },

  // Logo — centered between menu and avatar
  logoWrap: {
  backgroundColor: "#fff",
  width: 40,
  height: 40,
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 1,
  borderColor: "#ddd",
  borderRadius: 8,
  },
  logo: {
    height: 40,
    width: 100,
  },

  avatarWrap:    { position: "relative" },
  avatar:        { width: 42, height: 42, borderRadius: 21, borderWidth: 2.5, borderColor: "#fff" },
  avatarFallback:{ backgroundColor: "rgba(107,75,69,0.8)", justifyContent: "center", alignItems: "center" },
  onlineDot: {
    position: "absolute",
    bottom: 1, right: 1,
    width: 11, height: 11,
    borderRadius: 6,
    backgroundColor: "#6b4b45",
    borderWidth: 2, borderColor: "#fff",
  },

  dotsRow:   { position: "absolute", bottom: 56, left: 150, flexDirection: "row", gap: 5, alignItems: "center" },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.45)" },
  dotActive: { width: 18, height: 6, borderRadius: 3, backgroundColor: "#fff" },

  // Explore button overlaid on hero image
  heroExploreBtn: {
    position: "absolute",
    bottom: 10,
    right: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#6b4b45",
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

  // Info card — name + location + stars only (no description, no button)
  infoCard:     { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 6 },
  infoRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  spotName:     { fontSize: 22, fontWeight: "800", color: "#2e1c1a", flex: 1, marginRight: 8 },
  visitsBadge:  { flexDirection: "row", alignItems: "center", backgroundColor: "#faf5f4", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  visitsText:   { fontSize: 12, color: "#6b4b45", fontWeight: "600" },
  locationRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 13, color: "#6b4b45", fontWeight: "600" },
  starsRow:     { flexDirection: "row", gap: 2 },

  section:      { paddingHorizontal: 22, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#2e1c1a", marginBottom: 14 },
  loadingBox:   { height: 80, justifyContent: "center", alignItems: "center" },
  loadingText:  { color: "#aaa", fontSize: 13 },
  emptyText:    { color: "#aaa", fontSize: 13, textAlign: "center" },

  grid:         { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCard:     { width: (width - 54) / 2, height: 140, borderRadius: 18, overflow: "hidden", backgroundColor: "#e8d0ce" },
  gridCardWide: { width: "100%", height: 175 },
  gridImg:      { width: "100%", height: "100%", position: "absolute" },
  gridOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  gridInfoWrap: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: "rgba(0,0,0,0.25)" },
  gridName:     { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 4 },
  gridMeta:     { flexDirection: "row", alignItems: "center", gap: 10 },
  gridRatingRow:{ flexDirection: "row", alignItems: "center", gap: 2 },
  gridRatingText:{ fontSize: 11, fontWeight: "700", color: "#fff" },
  gridVisitRow: { flexDirection: "row", alignItems: "center" },
  gridVisitText:{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "500" },
});