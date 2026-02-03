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
} from "react-native";

import { createDrawerNavigator } from "@react-navigation/drawer";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Carousel from "react-native-reanimated-carousel";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useReviews } from "../context/ReviewContext";

import Bookmark from "./Bookmark";
import Leaderboard from "./Leaderboard";
import Categories from "./Categories";
import ProfileScreen from "./Profilescreen";
import Reviews from "./Reviews";

const { width } = Dimensions.get("window");

const Drawer = createDrawerNavigator();
const TopTab = createMaterialTopTabNavigator();
const BottomTab = createBottomTabNavigator();

/* -------------------------------------------------------------------------- */
/*                            BOTTOM TABS STYLE                               */
/* -------------------------------------------------------------------------- */
function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.customTabBarContainer}>
      <View style={styles.customTabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
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
                  color: isFocused ? "#8b4440" : "#ffffff",
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
      screenOptions={{
        headerShown: false,
      }}
    >
      <BottomTab.Screen
        name="HomeScreen"
        component={HomeTab}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={24} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name="Categories"
        component={Categories}
        options={{
          tabBarLabel: "Categories",
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" size={24} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name="Bookmark"
        component={Bookmark}
        options={{
          tabBarLabel: "Bookmark",
          tabBarIcon: ({ color, size }) => (
            <Feather name="bookmark" size={24} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name="Leaderboard"
        component={Leaderboard}
        options={{
          tabBarLabel: "Leaderboard",
          tabBarIcon: ({ color, size }) => (
            <Feather name="award" size={24} color={color} />
          ),
        }}
      />
    </BottomTab.Navigator>
  );
}

/* -------------------------------------------------------------------------- */
/*                     OTHER TABS (Contents of Top Tabs )                     */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                               HOME SCREEN                                  */
/* -------------------------------------------------------------------------- */
function HomeTab() {
  const navigation = useNavigation();
  const { user } = useAuth();

  return (
    <View style={styles.screen}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.toggleDrawer()}>
          <Feather name="menu" size={28} color="#4a4a4a" />
        </TouchableOpacity>
        <Image 
          source={require('../assets/logo.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <View style={styles.profileIcon}>
            <Feather name="user" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Add the HomeContent component here */}
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
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get rating for a spot - show 0 if no reviews exist
  const getSpotRating = (spot) => {
    const reviewCount = getReviewCount(spot._id);
    if (reviewCount > 0) {
      return getAverageRating(spot._id);
    }
    return 0; // Return 0 if no reviews exist
  };

  const sliderData = (spots && spots.length > 0) 
    ? spots.slice(0, 3).map(({ _id, image, name, description, location, rating }, index) => {
        const reviewRating = getAverageRating(_id);
        const reviewCount = getReviewCount(_id);
        const displayRating = reviewCount > 0 ? reviewRating : 0;
        
        return {
          id: _id || String(index),
          image: image,
          title: name,
          location: location,
          rating: displayRating,
          reviewCount: reviewCount,
          spot: { _id, image, name, description, location, rating }
        };
      })
    : [];

  useEffect(() => {
    setLoading(true);
    fetch("https://libotbackend.onrender.com/api/spots")
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched data:", data);
        setSpots(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching spots:", error);
        setLoading(false);
      });
  }, []);

  return (
    <ScrollView style={styles.tabScreen} showsVerticalScrollIndicator={false}>
      {/* CAROUSEL */}
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
                onPress={() => navigation.navigate('InformationScreen', { spot: item.spot })}
                style={styles.carouselCard}
              >
                <Image 
                  source={{ 
                    uri: item.image,
                    cache: 'force-cache'
                  }} 
                  style={styles.carouselImage}
                  resizeMode="cover"
                />
                <View style={styles.carouselOverlay}>
                  <Text style={styles.carouselTitle}>{item.title}</Text>
                  <View style={styles.carouselLocationContainer}>
                    <Feather name="map-pin" size={12} color="#fff" />
                    <Text style={styles.carouselLocation}>{item.location || "Philippines"}</Text>
                  </View>
                  <View style={styles.carouselRating}>
                    <Feather name="star" size={12} color="#FFD700" />
                    <Text style={styles.carouselRatingText}>
                      {item.rating}
                      {item.reviewCount > 0 && (
                        <Text style={styles.reviewCountText}> ({item.reviewCount})</Text>
                      )}
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

      {/* TOP PLACES SECTION */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Places visited this week</Text>
        <TouchableOpacity>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      {!loading && spots && spots.length > 0 ? (
        spots.slice(0, 3).map((spot) => {
          const displayRating = getSpotRating(spot);
          const reviewCount = getReviewCount(spot._id);
          
          return (
            <TouchableOpacity 
              key={spot._id}
              style={styles.topPlaceCard}
              onPress={() => navigation.navigate('InformationScreen', { spot })}
            >
              <Image
                source={{ 
                  uri: spot.image,
                  cache: 'force-cache'
                }}
                style={styles.topPlaceImage}
                resizeMode="cover"
              />
              <View style={styles.topPlaceInfo}>
                <Text style={styles.topPlaceTitle}>{spot.name}</Text>
                <View style={styles.topPlaceLocationContainer}>
                  <Feather name="map-pin" size={12} color="#FFD700" />
                  <Text style={styles.topPlaceLocation}>{spot.location || "Santa Maria"}</Text>
                </View>
                <View style={styles.topPlaceRating}>
                  <Feather name="star" size={12} color="#FFD700" />
                  <Text style={styles.topPlaceRatingText}>
                    {displayRating}
                    {reviewCount > 0 && (
                      <Text style={styles.reviewCountInCard}> ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</Text>
                    )}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        !loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>No places to display</Text>
          </View>
        )
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
      screenOptions={{ 
        headerShown: false,
        drawerStyle: {
          backgroundColor: "#dbbcb7",
        },
      }}
    >
      <Drawer.Screen name="Home" component={HomeBottomTabs} />
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
      Alert.alert(
        "Logout",
        "Are you sure you want to logout?",
        [
                {
                  text: "Cancel",
                  style: "cancel"
                },
                {
                  text: "Log Out",
                  onPress: async () => {
                    try {
                      await logout();
                      navigation.replace('Login');
                    } catch (error) {
                      Alert.alert("Error", "Failed to log out. Please try again.");
                    }
                  },
                  style: "destructive"
          },
        ]
      );
    }, [])
  );
}

/* ------------------------------ Styles ---------------------------------- */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
    paddingTop: 50,
  },
  
  tabScreen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
  },

  header: {
    width: "90%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    alignSelf: "center",
  },

  logo: {
    width: 50,
    height: 50,
  },

  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4a4a4a",
    justifyContent: "center",
    alignItems: "center",
  },

  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#4a4a4a",
  },

  centeredText: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },

  recommendedTextContainer: {
    marginTop: 15,
    width: "90%",
    alignSelf: "center",
  },

  recommendedText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4a4a4a",
  },

  // Carousel styles
  carouselContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
    height: 250,
  },

  carouselCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    marginHorizontal: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  carouselImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e0e0e0",
  },

  carouselOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  carouselTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 5,
  },

  carouselLocationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  carouselLocation: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 5,
  },

  carouselRating: {
    flexDirection: "row",
    alignItems: "center",
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  carouselRatingText: {
    color: "#4a4a4a",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },

  reviewCountText: {
    fontSize: 10,
    fontWeight: "400",
  },

  // Section header
  sectionHeader: {
    width: "90%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    alignSelf: "center",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4a4a4a",
  },

  viewAll: {
    color: "#8b4440",
    fontWeight: "600",
    fontSize: 14,
  },

  // Top places card
  topPlaceCard: {
    flexDirection: "row",
    backgroundColor: "#8f7f7f",
    borderRadius: 16,
    padding: 12,
    width: "90%",
    alignSelf: "center",
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },

  topPlaceImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 15,
  },

  topPlaceInfo: {
    flex: 1,
    justifyContent: "center",
  },

  topPlaceTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  topPlaceLocationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  topPlaceLocation: {
    color: "#FFD700",
    fontSize: 12,
    marginLeft: 5,
  },

  topPlaceRating: {
    flexDirection: "row",
    alignItems: "center",
  },

  topPlaceRatingText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 5,
  },

  reviewCountInCard: {
    fontSize: 10,
    fontWeight: "400",
    color: "#FFD700",
  },

  // Custom Tab Bar Styles
  customTabBarContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  
  customTabBar: {
    flexDirection: "row",
    height: 70,
    borderRadius: 35,
    backgroundColor: "#5a4a4a",
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "space-around",
    width: width * 0.85,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },

  emptyText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: 50,
  },

  loadingContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
  },
});