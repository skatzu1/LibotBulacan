import "react-native-gesture-handler";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Carousel from "react-native-reanimated-carousel";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

const { width } = Dimensions.get("window");
const Drawer = createDrawerNavigator();
const TopTab = createMaterialTopTabNavigator();
const BottomTab = createBottomTabNavigator();

/* ----------------------------- Home Screen ------------------------------ */
function HomeScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.toggleDrawer()}>
          <Feather name="menu" size={28} color="#000" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Home</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.centeredText}>
        <Text style={styles.subtitle}>Explore and Have fun!</Text>
      </View>

      <View style={styles.tabContainer}>
        <TopTab.Navigator
          screenOptions={{
            tabBarStyle: { backgroundColor: "#f7cfc9" },
            tabBarActiveTintColor: "#000",
            tabBarInactiveTintColor: "#888",
            tabBarPressColor : "#000",
          }}
        >
          <TopTab.Screen
            name="HomeTab"
            component={HomeTab}
            options={{ title: "Home" }}
          />
          <TopTab.Screen
            name="AnotherTab"
            component={AnotherTab}
            options={{ title: "Another" }}
          />
        </TopTab.Navigator>
      </View>
    </View>
  );
}

/* ------------------------------ Home Tab -------------------------------- */
function HomeTab() {
  const sliderData = [
    {
      id: "1",
      image:
        "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=800&q=80",
      title: "Slide 1",
    },
    {
      id: "2",
      image:
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
      title: "Slide 2",
    },
    {
      id: "3",
      image:
        "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=80",
      title: "Slide 3",
    },
  ];

  return (
    <View style={styles.tabScreen}>
      {/* Carousel */}
      <View style={styles.carouselWrapper}>
        <Carousel
          width={width}
          height={220}
          data={sliderData}
          loop
          autoPlay
          mode="parallax"
          autoPlayInterval={3000}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: item.image }} style={styles.image} />
              <View style={styles.captionWrapper}>
                <Text style={styles.caption}>{item.title}</Text>
              </View>
            </View>
          )}
        />
      </View>

      {/* Top Places Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.subtitle}>Top Places</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      {/* Top Place Card (snapped left) */}
      <TouchableOpacity activeOpacity={0.8} style={styles.topPlacesContainer}>
        <Image
          source={{
            uri: "https://upload.wikimedia.org/wikipedia/commons/6/6b/Philippine_Arena_exterior.jpg",
          }}
          style={styles.placeImage}
        />
        <Text style={styles.placeTitle}>Philippine Arena</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ----------------------------- Another Tab ----------------------------- */
function AnotherTab() {
  return (
    <View style={styles.tabScreen}>
      <Text style={styles.subtitle}>Another Tab Content</Text>
    </View>
  );
}

/* ------------------------------ Drawer ---------------------------------- */
export default function HomeDrawer() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: "#f7cfc9" },
      }}
    >
      <Drawer.Screen name="Main" component={HomeScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
    </Drawer.Navigator>
  );
}

function ProfileScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.toggleDrawer()}>
          <Feather name="menu" size={28} color="#000" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <Text style={styles.subtitle}>Your Profile</Text>
    </View>
  );
}

/* ------------------------------ Styles ---------------------------------- */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
    paddingTop: 50,
  },
/* ------------------------- Another Tab Styles --------------------------- */
  tabScreen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
    alignItems: "center",
    justifyContent: "flex-start",
  },
/* ------------------------- Another Tab Styles --------------------------- */


  header: {
    width: "90%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    alignSelf: "center",
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "200",
  },

  subtitle: {
    fontSize: 18,
    fontWeight: "400",
  },

  centeredText: {
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
},

  tabContainer: {
    flex: 1,
    width: "100%",
    marginTop: 20,
  },

  carouselWrapper: {
    width: "100%",
    height: 220,
    marginBottom: 20,
    alignItems: "center",
    paddingHorizontal: 16,
  },

  card: {
    width: "100%",
    height: "100%",
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#fff",
    justifyContent: "flex-end",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  image: {
    width: "100%",
    height: "100%",
  },

  captionWrapper: {
    position: "absolute",
    bottom: 10,
    left: 10,
  },

  caption: {
    color: "#fff",
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },

  sectionHeader: {
    width: "90%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  seeAll: {
    color: "#000",
    fontWeight: "500",
  },

  topPlacesContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8f7f7f",
    borderRadius: 14,
    padding: 10,
    width: "70%",
    height: 80,
    alignSelf: "flex-start",
    marginLeft: "5%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  placeImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 10,
  },

  placeTitle: {
    color: "#fff",
    fontWeight: "600",
  },
});
