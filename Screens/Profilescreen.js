import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const menuItems = [
    {
      id: 1,
      icon: "user-x",
      title: "Deactivate",
      onPress: () => console.log("Deactivate pressed"),
    },
    {
      id: 2,
      icon: "map-pin",
      title: "Previous Trips",
      onPress: () => console.log("Previous Trips pressed"),
    },
    {
      id: 3,
      icon: "settings",
      title: "Settings",
      onPress: () => navigation.navigate("Settings"),
    },
    {
      id: 4, 
      icon: "award",
      title: "Badges",
      onPress: () => console.log("Badges pressed"),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="chevron-left" size={24} color="#8a7a7a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* PROFILE PHOTO */}
        <View style={styles.profilePhotoContainer}>
          <View style={styles.profilePhotoWrapper}>
            {user?.profilePhoto ? (
              <Image
                source={{ uri: user.profilePhoto }}
                style={styles.profilePhoto}
              />
            ) : (
              <View style={styles.profilePhotoPlaceholder}>
                <Feather name="user" size={40} color="#fff" />
              </View>
            )}
          </View>
        </View>

        {/* EMAIL */}
        <Text style={styles.email}>{user?.email || "libertybluiscan@gmail.com"}</Text>

        {/* TRAVEL TRIPS CARD */}
        <View style={styles.tripsCard}>
          <Text style={styles.tripsLabel}>Travel Trips</Text>
          <Text style={styles.tripsCount}>{user?.trips || "9"}</Text>
        </View>

        {/* MENU ITEMS */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconContainer}>
                  <Feather name={item.icon} size={18} color="#7a6a6a" />
                </View>
                <Text style={styles.menuText}>{item.title}</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#8a7a7a" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5c4c1",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4a4a4a",
  },

  profilePhotoContainer: {
    alignItems: "center",
    marginBottom: 12,
  },

  profilePhotoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "#4a4a4a",
    justifyContent: "center",
    alignItems: "center",
  },

  profilePhoto: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  profilePhotoPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#4a4a4a",
  },

  email: {
    fontSize: 13,
    color: "#6a5a5a",
    textAlign: "center",
    marginBottom: 20,
  },

  tripsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 25,
    alignSelf: "center",
    minWidth: 140,
  },

  tripsLabel: {
    fontSize: 14,
    color: "#5a4a4a",
    fontWeight: "500",
    marginBottom: 6,
  },

  tripsCount: {
    fontSize: 28,
    color: "#4a4a4a",
    fontWeight: "700",
  },

  menuContainer: {
    backgroundColor: "transparent",
  },

  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f5d4d1",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e8bfbc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  menuText: {
    fontSize: 15,
    color: "#4a4a4a",
    fontWeight: "500",
  },
});