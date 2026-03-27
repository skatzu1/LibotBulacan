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
import { useProfileImage } from "../context/ProfileImageContext";

const BASE_URL = "https://libotbackend.onrender.com";

export default function ProfileScreen() {
  const navigation                    = useNavigation();
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken }                  = useAuth();
  const { user: contextUser }         = useAppAuth();
  const { profileImage }              = useProfileImage();

  const [userInfo, setUserInfo] = useState({
    email: "", firstName: "", lastName: "", fullName: "", profilePhoto: null,
  });
  const [points, setPoints]         = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [tripCount, setTripCount]   = useState(0);

  useEffect(() => {
    if (isLoaded && clerkUser) {
      setUserInfo({
        email:        clerkUser.primaryEmailAddress?.emailAddress || "",
        firstName:    clerkUser.firstName || "",
        lastName:     clerkUser.lastName  || "",
        fullName:     `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
        profilePhoto: clerkUser.imageUrl || clerkUser.profileImageUrl || null,
      });
    } else if (contextUser) {
      setUserInfo({
        email:        contextUser.email     || "",
        firstName:    contextUser.firstName || "",
        lastName:     contextUser.lastName  || "",
        fullName:     contextUser.name || contextUser.fullName || "User",
        profilePhoto: contextUser.profilePhoto || null,
      });
    }
  }, [clerkUser, isLoaded, contextUser]);

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
      setBadgeCount(Array.isArray(user?.badges)      ? user.badges.length      : 0);
      setTripCount(Array.isArray(user?.visitedSpots) ? user.visitedSpots.length : 0);
    } catch (e) {
      console.warn("ProfileScreen loadStats error:", e);
    }
  }, [getToken]);

  useEffect(() => {
    loadStats();
    const unsubscribe = navigation.addListener("focus", loadStats);
    return unsubscribe;
  }, [navigation, loadStats]);

  // Context is the single source of truth for the photo.
  // It's seeded from DB on app start (ProfileImageContext) and updated
  // instantly on save (EditProfile). Falls back to Clerk URL if context is null.
  const displayPhoto = profileImage || userInfo.profilePhoto;

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
      onPress: () => navigation.navigate("PreviousTrips"),
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
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6b4b45" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-left" size={24} color="#4a2e2c" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <Feather name="edit-2" size={18} color="#6b4b45" />
          </TouchableOpacity>
        </View>

        <View style={styles.profilePhotoContainer}>
          <View style={styles.profilePhotoWrapper}>
            {displayPhoto ? (
              <Image source={{ uri: displayPhoto }} style={styles.profilePhoto} />
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

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Feather name="map-pin" size={18} color="#6b4b45" style={styles.statIcon} />
            <Text style={styles.statLabel}>Trips</Text>
            <Text style={styles.statCount}>{tripCount}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Feather name="star" size={18} color="#f4c542" style={styles.statIcon} />
            <Text style={styles.statLabel}>Points</Text>
            <Text style={[styles.statCount, styles.statCountAccent]}>{points}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Feather name="award" size={18} color="#6b4b45" style={styles.statIcon} />
            <Text style={styles.statLabel}>Badges</Text>
            <Text style={[styles.statCount, styles.statCountAccent]}>{badgeCount}</Text>
          </View>
        </View>

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
                  <Feather name={item.icon} size={18} color="#6b4b45" />
                </View>
                <Text style={styles.menuText}>{item.title}</Text>
              </View>
              <View style={styles.menuRight}>
                {item.badge ? (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>{item.badge}</Text>
                  </View>
                ) : null}
                <Feather name="chevron-right" size={18} color="#b0908c" />
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
  container:     { flex: 1, backgroundColor: "#fff" },
  centered:      { justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 50 },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 24,
  },
  backButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#4a2e2c" },
  editButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-end" },
  profilePhotoContainer: { alignItems: "center", marginBottom: 12 },
  profilePhotoWrapper: {
    width: 100, height: 100, borderRadius: 50, overflow: "hidden",
    backgroundColor: "#6b4b45", justifyContent: "center", alignItems: "center",
  },
  profilePhoto:            { width: "100%", height: "100%", resizeMode: "cover" },
  profilePhotoPlaceholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center", backgroundColor: "#6b4b45" },
  userName: { fontSize: 18, fontWeight: "700", color: "#4a2e2c", textAlign: "center", marginBottom: 4 },
  email:    { fontSize: 13, color: "#7a5a58", textAlign: "center", marginBottom: 20 },
  statsRow: {
    flexDirection: "row", backgroundColor: "#faf5f4",
    borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12,
    marginBottom: 24, alignItems: "center",
    borderWidth: 1, borderColor: "#f0e0de",
  },
  statCard:        { flex: 1, alignItems: "center" },
  statIcon:        { marginBottom: 5 },
  statDivider:     { width: 1, height: 50, backgroundColor: "#e8d0ce", marginHorizontal: 4 },
  statLabel:       { fontSize: 11, color: "#7a5a58", fontWeight: "500", marginBottom: 4 },
  statCount:       { fontSize: 24, color: "#4a2e2c", fontWeight: "700" },
  statCountAccent: { color: "#6b4b45" },
  menuContainer:   { backgroundColor: "transparent" },
  menuItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#faf5f4", borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    marginBottom: 8, borderWidth: 1, borderColor: "#f0e0de",
  },
  menuLeft:      { flexDirection: "row", alignItems: "center" },
  iconContainer: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#f0e0de", justifyContent: "center", alignItems: "center", marginRight: 12 },
  menuText:      { fontSize: 15, color: "#4a2e2c", fontWeight: "500" },
  menuRight:     { flexDirection: "row", alignItems: "center", gap: 8 },
  badgePill:     { backgroundColor: "#6b4b45", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgePillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});