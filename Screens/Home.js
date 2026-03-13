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

import Bookmark from "./Bookmark";
import Leaderboard from "./Leaderboard";
import Categories from "./Categories";
import ProfileScreen from "./Profilescreen";

const { width } = Dimensions.get("window");

const Drawer = createDrawerNavigator();
const BottomTab = createBottomTabNavigator();

/* -------------------------------------------------------------------------- */
/*                         CUSTOM DRAWER CONTENT                              */
/* -------------------------------------------------------------------------- */
function CustomDrawerContent(props) {
  const { navigation } = props;

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContainer}>
      <Text style={styles.drawerHeading}>Menu</Text>

      <DrawerItem
        label="Home"
        icon={({ color }) => <Feather name="home" size={20} color={color} />}
        onPress={() => navigation.navigate("HomeSide")}
        labelStyle={styles.drawerLabel}
        inactiveTintColor="#3a2a28"
      />

      <DrawerItem
        label="Profile"
        icon={({ color }) => <Feather name="user" size={20} color={color} />}
        onPress={() => navigation.navigate("Profile")}
        labelStyle={styles.drawerLabel}
        inactiveTintColor="#3a2a28"
      />

      <Text style={styles.drawerSection}>Explore</Text>

      <DrawerItem
        label="AR Experience"
        icon={({ color }) => <Feather name="camera" size={20} color={color} />}
        onPress={() => navigation.navigate("ARSpotSelect")}
        labelStyle={styles.drawerLabel}
        inactiveTintColor="#3a2a28"
      />

      <DrawerItem
        label="Missions"
        icon={({ color }) => <Feather name="flag" size={20} color={color} />}
        onPress={() => navigation.navigate("MissionsSpotSelect")}
        labelStyle={styles.drawerLabel}
        inactiveTintColor="#3a2a28"
      />

      <DrawerItem
        label="Navigate to Spot"
        icon={({ color }) => <Feather name="navigation" size={20} color={color} />}
        onPress={() => navigation.navigate("TrackSpotSelect")}
        labelStyle={styles.drawerLabel}
        inactiveTintColor="#3a2a28"
      />

      <View style={styles.drawerDivider} />

      <DrawerItem
        label="Logout"
        icon={({ color }) => <Feather name="log-out" size={20} color={color} />}
        onPress={() => navigation.navigate("Logout")}
        labelStyle={[styles.drawerLabel, { color: "#c0392b" }]}
        inactiveTintColor="#c0392b"
      />
    </DrawerContentScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/*                            BOTTOM TABS STYLE                               */
/* -------------------------------------------------------------------------- */
function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.customTabBarContainer}>
      <View style={styles.customTabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabItem}
            >
              {options.tabBarIcon &&
                options.tabBarIcon({
                  focused: isFocused,
                  color: isFocused ? "#f7cfc9" : "#ffffff",
                  size: 24,
                })}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                         BOTTOM TABS FUNCTION                               */
/* -------------------------------------------------------------------------- */
function HomeBottomTabs() {
  return (
    <BottomTab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <BottomTab.Screen
        name="HomeScreen"
        component={HomeTab}
        options={{
          tabBarLabel: "HomeScreen",
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={24} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name="Categories"
        component={Categories}
        options={{
          tabBarLabel: "Categories",
          tabBarIcon: ({ color }) => (
            <Feather name="grid" size={24} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name="Bookmark"
        component={Bookmark}
        options={{
          tabBarLabel: "Bookmark",
          tabBarIcon: ({ color }) => (
            <Feather name="bookmark" size={24} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name="Leaderboard"
        component={Leaderboard}
        options={{
          tabBarLabel: "Leaderboard",
          tabBarIcon: ({ color }) => (
            <Feather name="award" size={24} color={color} />
          ),
        }}
      />
    </BottomTab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                               HOME SCREEN                                  */
/* -------------------------------------------------------------------------- */
function HomeTab() {
  const navigation = useNavigation();
  const { user: authUser } = useAuth();
  const { user: clerkUser } = useUser();

  const profilePhoto =
    clerkUser?.imageUrl || clerkUser?.profileImageUrl || authUser?.profilePhoto;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.toggleDrawer()}>
          <Feather name="menu" size={28} color="#4a4a4a" />
        </TouchableOpacity>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileIcon}>
              <Feather name="user" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>
      <HomeContent />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                              HOME CONTENT                                  */
/* -------------------------------------------------------------------------- */
function HomeContent() {
  const navigation = useNavigation();
  const { getAverageRating, getReviewCount } = useReviews();
  const [spots, setSpots]           = useState([]);
  const [topSpots, setTopSpots]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [topLoading, setTopLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getSpotRating = (spot) => {
    const reviewCount = getReviewCount(spot._id);
    return reviewCount > 0 ? getAverageRating(spot._id) : 0;
  };

  const handleSpotPress = (spot) => {
    navigation.navigate("InformationScreen", { spot });
  };

  const sliderData =
    spots.length > 0
      ? spots.slice(0, 14).map(
          ({ _id, image, name, description, location, rating, modelUrl, visitCount }, index) => {
            const reviewCount   = getReviewCount(_id);
            const displayRating = reviewCount > 0 ? getAverageRating(_id) : 0;
            return {
              id: _id || String(index),
              image,
              title: name,
              location,
              rating: displayRating,
              reviewCount,
              visitCount: visitCount ?? 0,
              spot: { _id, image, name, description, location, rating, modelUrl },
            };
          }
        )
      : [];

  useEffect(() => {
    setLoading(true);
    fetch(`https://libotbackend.onrender.com/api/spots`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSpots(data.spots);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching spots:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setTopLoading(true);
    fetch(`https://libotbackend.onrender.com/api/spots/top/visited`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const visited = data.spots.filter((s) => (s.visitCount ?? 0) > 0);
          setTopSpots(visited);
        }
        setTopLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching top spots:", err);
        setTopLoading(false);
      });
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      fetch('https://libotbackend.onrender.com/api/spots')
        .then((res) => res.json())
        .then((data) => { if (data.success) setSpots(data.spots); })
        .catch((err) => console.error('Refresh spots error:', err)),
      fetch('https://libotbackend.onrender.com/api/spots/top/visited')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const visited = data.spots.filter((s) => (s.visitCount ?? 0) > 0);
            setTopSpots(visited);
          }
        })
        .catch((err) => console.error('Refresh top spots error:', err)),
    ]).finally(() => setRefreshing(false));
  }, []);

  return (
    <ScrollView
      style={styles.tabScreen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#8b4440"]}
          tintColor="#8b4440"
        />
      }
    >
      <View style={styles.recommendedTextContainer}>
        <Text style={styles.recommendedText}>Recommended</Text>
      </View>
      <View style={styles.carouselContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading spots...</Text>
          </View>
        ) : sliderData.length > 0 ? (
          <Carousel
            width={width}
            height={250}
            data={sliderData}
            loop
            autoPlay
            mode="parallax"
            autoPlayInterval={4000}
            scrollAnimationDuration={1000}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSpotPress(item.spot)}
                style={styles.carouselCard}
              >
                <Image
                  source={{ uri: item.image, cache: "force-cache" }}
                  style={styles.carouselImage}
                  resizeMode="cover"
                />
                <View style={styles.carouselOverlay}>
                  <Text style={styles.carouselTitle}>{item.title}</Text>
                  <View style={styles.carouselLocationContainer}>
                    <Feather name="map-pin" size={12} color="#ffffff" />
                    <Text style={styles.carouselLocation}>
                      {item.location || "Philippines"}
                    </Text>
                  </View>
                  <View style={styles.carouselBottomRow}>
                    <View style={styles.carouselVisitRow}>
                      <Feather name="eye" size={11} color="#f7cfc9" />
                      <Text style={styles.carouselVisitText}>
                        {" "}{item.visitCount}{" "}
                        {item.visitCount === 1 ? "visit" : "visits"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.carouselRating}>
                    <MaterialIcons name="star" size={12} color="#FFD700" />
                    <Text style={styles.carouselRatingText}>
                      {String(item.rating)}
                      {item.reviewCount > 0 ? (
                        <Text style={styles.reviewCountText}>
                          {" "}({item.reviewCount})
                        </Text>
                      ) : null}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>No spots available</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Places visited this week</Text>
        <TouchableOpacity>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      {topLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading top places...</Text>
        </View>
      ) : topSpots.length > 0 ? (
        topSpots.map((spot) => {
          const displayRating = getSpotRating(spot);
          const reviewCount   = getReviewCount(spot._id);

          return (
            <TouchableOpacity
              key={spot._id}
              style={styles.topPlaceCard}
              onPress={() => handleSpotPress(spot)}
            >
              <Image
                source={{ uri: spot.image, cache: "force-cache" }}
                style={styles.topPlaceImage}
                resizeMode="cover"
              />
              <View style={styles.topPlaceInfo}>
                <Text style={styles.topPlaceTitle}>{spot.name}</Text>
                <View style={styles.topPlaceLocationContainer}>
                  <Feather name="map-pin" size={12} color="#ffffff" />
                  <Text style={styles.topPlaceLocation}>
                    {spot.location || "Philippines"}
                  </Text>
                </View>
                <View style={styles.topPlaceRating}>
                  <MaterialIcons name="star" size={12} color="#FFD700" />
                  <Text style={styles.topPlaceRatingText}>
                    {String(displayRating)}
                    {reviewCount > 0 ? (
                      <Text style={styles.reviewCountInCard}>
                        {" "}({reviewCount}{" "}
                        {reviewCount === 1 ? "review" : "reviews"})
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <View style={styles.visitCountRow}>
                  <Feather name="eye" size={11} color="#5a4a4a" />
                  <Text style={styles.visitCountText}>
                    {" "}{spot.visitCount ?? 0}{" "}
                    {spot.visitCount === 1 ? "visit" : "visits"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            No visits yet — be the first to explore!
          </Text>
        </View>
      )}

      <View style={{ height: 150 }} />
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
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: "#dbbcb7" },
      }}
    >
      <Drawer.Screen name="HomeSide" component={HomeBottomTabs} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen name="Logout" component={LogoutScreen} />
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
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => navigation.navigate("HomeSide"), // ← go back on cancel
        },
        {
          text: "Log Out",
          onPress: async () => {
            try {
              await logout();
              navigation.replace("Login");
            } catch (error) {
              Alert.alert("Error", "Failed to log out. Please try again.");
            }
          },
          style: "destructive",
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
  screen:    { flex: 1, backgroundColor: "#ffffff", paddingTop: 50 },
  tabScreen: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    width: "90%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    alignSelf: "center",
  },
  logo:        { width: 50, height: 50 },
  profileIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#4a4a4a",
    justifyContent: "center", alignItems: "center",
  },
  profileImage: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#4a4a4a" },
  recommendedTextContainer: { marginTop: 15, width: "90%", alignSelf: "center" },
  recommendedText: { fontSize: 16, fontWeight: "600", color: "#4a4a4a" },
  carouselContainer: { width: "100%", alignItems: "center", marginBottom: 20, height: 250 },
  carouselCard: {
    flex: 1, borderRadius: 20, overflow: "hidden", marginHorizontal: 10,
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  carouselImage:   { width: "100%", height: "100%", backgroundColor: "#e0e0e0" },
  carouselOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 15, backgroundColor: "rgba(0,0,0,0.4)",
  },
  carouselTitle:             { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 5 },
  carouselLocationContainer: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  carouselLocation:          { color: "#fff", fontSize: 12, marginLeft: 5 },
  carouselBottomRow:         { flexDirection: "row", alignItems: "center", marginTop: 2 },
  carouselVisitRow:          { flexDirection: "row", alignItems: "center" },
  carouselVisitText:         { fontSize: 11, color: "#f7cfc9", fontWeight: "500" },
  carouselRating: {
    flexDirection: "row", alignItems: "center",
    position: "absolute", top: 15, right: 15,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  carouselRatingText: { color: "#4a4a4a", fontSize: 12, fontWeight: "700", marginLeft: 4 },
  reviewCountText:    { fontSize: 10, fontWeight: "400" },
  sectionHeader: {
    width: "90%", flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 15, alignSelf: "center",
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#4a4a4a" },
  viewAll:      { color: "#ffffff", fontWeight: "600", fontSize: 14 },
  topPlaceCard: {
    flexDirection: "row", backgroundColor: "#f7cfc9",
    borderRadius: 16, padding: 12, width: "90%",
    alignSelf: "center", marginBottom: 15,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 5, elevation: 5,
  },
  topPlaceImage:             { width: 80, height: 80, borderRadius: 12, marginRight: 15 },
  topPlaceInfo:              { flex: 1, justifyContent: "center" },
  topPlaceTitle:             { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  topPlaceLocationContainer: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  topPlaceLocation:          { color: "#ffffff", fontSize: 12, marginLeft: 5 },
  topPlaceRating:            { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  topPlaceRatingText:        { color: "#fff", fontSize: 12, fontWeight: "600", marginLeft: 5 },
  reviewCountInCard:         { fontSize: 10, fontWeight: "400", color: "#FFD700" },
  visitCountRow:             { flexDirection: "row", alignItems: "center" },
  visitCountText:            { fontSize: 11, color: "#5a4a4a", fontWeight: "500" },
  customTabBarContainer:     { position: "absolute", bottom: 30, left: 0, right: 0, alignItems: "center" },
  customTabBar: {
    flexDirection: "row", height: 70, borderRadius: 35,
    backgroundColor: "#5a4a4a", paddingHorizontal: 20,
    alignItems: "center", justifyContent: "space-around",
    width: width * 0.85,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 10,
  },
  tabItem:          { alignItems: "center", justifyContent: "center", flex: 1 },
  loadingContainer: { height: 100, justifyContent: "center", alignItems: "center" },
  loadingText:      { fontSize: 14, color: "#888", textAlign: "center" },

  // ── Drawer styles ──
  drawerContainer:  { flex: 1, paddingTop: 40, paddingHorizontal: 8 },
  drawerHeading:    { fontSize: 22, fontWeight: "700", color: "#3a2a28", paddingHorizontal: 16, marginBottom: 8 },
  drawerSection:    { fontSize: 11, fontWeight: "700", color: "#8b5550", letterSpacing: 1.2, paddingHorizontal: 16, marginTop: 20, marginBottom: 4 },
  drawerLabel:      { fontSize: 15, fontWeight: "500" },
  drawerDivider:    { height: 1, backgroundColor: "rgba(90,74,74,0.2)", marginHorizontal: 16, marginVertical: 12 },
});