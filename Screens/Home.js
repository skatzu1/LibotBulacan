import "react-native-gesture-handler";
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons"; 
import Carousel from "react-native-reanimated-carousel";

const { width } = Dimensions.get("window");

function HomeScreen() {
  const navigation = useNavigation();
  const sliderData = [
    {
      id: "1",
      image: "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=800&q=80",
      title: "Slide 1",
    },
    {
      id: "2",
      image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
      title: "Slide 2",
    },
    {
      id: "3",
      image: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=800&q=80",
      title: "Slide 3",
    },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.toggleDrawer()}>
          <Feather name="menu" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Home</Text>
        <View style={{ width: 28 }} /> 
      </View>

      <Text style={styles.subtitle}>Explore and Have fun!</Text>

      <View style={styles.carouselWrapper}>
        <Carousel
          width={width * 1}
          height={220}
          data={sliderData}
          loop
          autoPlay
          autoPlayInterval={3000}
          mode="parallax"
          modeConfig={{
            parallaxScrollingScale: 0.8,
            parallaxScrollingOffset: 50,
          }}
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
    </View>
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

const Drawer = createDrawerNavigator();

export default function Home() {
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
    paddingTop: 50,
    alignItems: "center",
  },
  header: {
    width: "90%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "200",
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "400",
    marginBottom: 20,
  },
  carouselWrapper: {
    width: "100%",
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 15,
    overflow: "hidden",
    width: "100%",
    height: "100%",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    justifyContent: "flex-end",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
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
});
