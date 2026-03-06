import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useAuth as useAppAuth } from "../context/AuthContext";

const BASE_URL = "https://libotbackend.onrender.com";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { user: contextUser } = useAppAuth();

  const [userInfo, setUserInfo] = useState({
    email: "",
    firstName: "",
    lastName: "",
    fullName: "",
    profilePhoto: null,
  });
  const [points, setPoints]         = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [tripCount, setTripCount]   = useState(0); // ✅ from DB

  /* ── User info from Clerk ── */
  useEffect(() => {
    if (isLoaded && clerkUser) {
      setUserInfo({
        email:        clerkUser.primaryEmailAddress?.emailAddress || "",
        firstName:    clerkUser.firstName || "",
        lastName:     clerkUser.lastName || "",
        fullName:     `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
        profilePhoto: clerkUser.imageUrl || clerkUser.profileImageUrl || null,
      });
    } else if (contextUser) {
      setUserInfo({
        email:        contextUser.email || "",
        firstName:    contextUser.firstName || "",
        lastName:     contextUser.lastName || "",
        fullName:     contextUser.name || contextUser.fullName || "User",
        profilePhoto: contextUser.profilePhoto || null,
      });
    }
  }, [clerkUser, isLoaded, contextUser]);

  /* ── Load stats from DB ── */
  const loadStats = useCallback(async () => {
    try {
      const token = await getToken();
      const res   = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      const user = data?.user;

      if (typeof user?.points === "number") setPoints(user.points);

      const badges = Array.isArray(user?.badges) ? user.badges : [];
      setBadgeCount(badges.length);

      const trips = Array.isArray(user?.visitedSpots) ? user.visitedSpots : [];
      setTripCount(trips.length);
    } catch (e) {
      console.warn("ProfileScreen loadStats error:", e);
    }
  }, [getToken]);

  useEffect(() => {
    loadStats();
    const unsubscribe = navigation.addListener("focus", loadStats);
    return unsubscribe;
  }, [navigation, loadStats]);

  /* ── Menu ── */
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
      badge: tripCount > 0 ? `${tripCount} spots` : null,
      onPress: () => navigation.navigate("PreviousTrips"), // ✅ register this in your navigator
    },
    {
      id: 3,
      icon: "award",
      title: "Badges",
      badge: badgeCount > 0 ? `${badgeCount} earned` : null,
      onPress: () => navigation.navigate("Badges"),
    },
    {
      id: 4,
      icon: "settings",
      title: "Settings",
      onPress: () => navigation.navigate("Settings"),
    },
  ];

  if (!isLoaded) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#7a6a6a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-left" size={24} color="#8a7a7a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* PROFILE PHOTO */}
        <View style={styles.profilePhotoContainer}>
          <View style={styles.profilePhotoWrapper}>
            {userInfo.profilePhoto ? (
              <Image source={{ uri: userInfo.profilePhoto }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.profilePhotoPlaceholder}>
                <Feather name="user" size={40} color="#fff" />
              </View>
            )}
          </View>
        </View>

        {userInfo.fullName ? (
          <Text style={styles.userName}>{userInfo.fullName}</Text>
        ) : null}

        <Text style={styles.email}>{userInfo.email || "No email available"}</Text>

        {/* STATS ROW */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Feather name="map-pin" size={18} color="#8b4440" style={styles.statIcon} />
            <Text style={styles.statLabel}>Trips</Text>
            <Text style={styles.statCount}>{tripCount}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Feather name="star" size={18} color="#f4c542" style={styles.statIcon} />
            <Text style={styles.statLabel}>Points</Text>
            <Text style={[styles.statCount, styles.pointsCount]}>{points}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Feather name="award" size={18} color="#8b4440" style={styles.statIcon} />
            <Text style={styles.statLabel}>Badges</Text>
            <Text style={[styles.statCount, styles.pointsCount]}>{badgeCount}</Text>
          </View>
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
              <View style={styles.menuRight}>
                {item.badge ? (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>{item.badge}</Text>
                  </View>
                ) : null}
                <Feather name="chevron-right" size={18} color="#8a7a7a" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#ffffff" },
  loadingContainer: { justifyContent: "center", alignItems: "center" },
  scrollContent:    { paddingHorizontal: 20, paddingTop: 50 },

  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 25,
  },
  backButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#4a4a4a" },

  profilePhotoContainer: { alignItems: "center", marginBottom: 12 },
  profilePhotoWrapper: {
    width: 100, height: 100, borderRadius: 50,
    overflow: "hidden", backgroundColor: "#4a4a4a",
    justifyContent: "center", alignItems: "center",
  },
  profilePhoto: { width: "100%", height: "100%", resizeMode: "cover" },
  profilePhotoPlaceholder: {
    width: "100%", height: "100%",
    justifyContent: "center", alignItems: "center",
    backgroundColor: "#4a4a4a",
  },

  userName: { fontSize: 18, fontWeight: "600", color: "#4a4a4a", textAlign: "center", marginBottom: 4 },
  email:    { fontSize: 13, color: "#6a5a5a", textAlign: "center", marginBottom: 20 },

  statsRow: {
    flexDirection: "row", backgroundColor: "#fff",
    borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12,
    marginBottom: 25, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    borderWidth: 1, borderColor: "#f0e0de",
  },
  statCard:    { flex: 1, alignItems: "center" },
  statIcon:    { marginBottom: 5 },
  statDivider: { width: 1, height: 50, backgroundColor: "#e8d0ce", marginHorizontal: 4 },
  statLabel:   { fontSize: 11, color: "#5a4a4a", fontWeight: "500", marginBottom: 4 },
  statCount:   { fontSize: 24, color: "#4a4a4a", fontWeight: "700" },
  pointsCount: { color: "#8b4440" },

  menuContainer: { backgroundColor: "transparent" },
  menuItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#f5d4d1", borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10,
  },
  menuLeft:      { flexDirection: "row", alignItems: "center" },
  iconContainer: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#e8bfbc", justifyContent: "center",
    alignItems: "center", marginRight: 12,
  },
  menuText:      { fontSize: 15, color: "#4a4a4a", fontWeight: "500" },
  menuRight:     { flexDirection: "row", alignItems: "center", gap: 8 },
  badgePill: {
    backgroundColor: "#8b4440", borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgePillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});