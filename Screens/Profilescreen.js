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
      icon: "map",
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
      onPress: () => console.log("Settings pressed"),
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
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={28} color="#4a4a4a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
                <Feather name="user" size={50} color="#fff" />
              </View>
            )}
          </View>
        </View>

        {/* EMAIL */}
        <Text style={styles.email}>{user?.email || "user@email.com"}</Text>

        {/* TRAVEL TRIPS CARD */}
        <View style={styles.tripsCard}>
          <Text style={styles.tripsLabel}>Travel Trips</Text>
          <Text style={styles.tripsCount}>{user?.trips || "0"}</Text>
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
                  <Feather name={item.icon} size={20} color="#6a5a5a" />
                </View>
                <Text style={styles.menuText}>{item.title}</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#999" />
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
    paddingTop: 50,
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 30,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#4a4a4a",
  },

  profilePhotoContainer: {
    alignItems: "center",
    marginBottom: 15,
  },

  profilePhotoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    backgroundColor: "#4a4a4a",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
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
    fontSize: 14,
    color: "#6a5a5a",
    textAlign: "center",
    marginBottom: 25,
  },

  tripsCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },

  tripsLabel: {
    fontSize: 16,
    color: "#4a4a4a",
    fontWeight: "500",
    marginBottom: 10,
  },

  tripsCount: {
    fontSize: 32,
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
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e8c4c1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },

  menuText: {
    fontSize: 16,
    color: "#4a4a4a",
    fontWeight: "500",
  },
});