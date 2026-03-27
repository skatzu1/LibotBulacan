import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useAuth as useAppAuth } from "../context/AuthContext";
import { useProfileImage } from "../context/ProfileImageContext";

const BASE_URL = "https://libotbackend.onrender.com";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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

  // ── Photo modal state ──
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const scaleAnim   = useState(new Animated.Value(0))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];

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

  // ── Open modal with zoom-in animation ──
  const openPhotoModal = () => {
    if (!displayPhoto) return;
    setPhotoModalVisible(true);
    scaleAnim.setValue(0.5);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ── Close modal with zoom-out animation ──
  const closePhotoModal = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.5,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setPhotoModalVisible(false));
  };

  const displayPhoto = profileImage || userInfo.profilePhoto;

  const fullName = userInfo.fullName;
  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

        {/* ── Profile Photo (tappable) ── */}
        <View style={styles.profilePhotoContainer}>
          <TouchableOpacity
            onPress={openPhotoModal}
            activeOpacity={displayPhoto ? 0.8 : 1}
            disabled={!displayPhoto}
          >
            <View style={styles.profilePhotoWrapper}>
              {displayPhoto ? (
                <Image source={{ uri: displayPhoto }} style={styles.profilePhoto} />
              ) : (
                <View style={styles.profilePhotoPlaceholder}>
                  <Feather name="user" size={40} color="#fff" />
                </View>
              )}
            </View>
            {/* Small zoom hint badge — only shown when photo exists */}
            {displayPhoto && (
              <View style={styles.zoomBadge}>
                <Feather name="zoom-in" size={11} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {fullName ? (
          <Text style={styles.userName}>{fullName}</Text>
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

      {/* ── Fullscreen Photo Modal ── */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="none"
        onRequestClose={closePhotoModal}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={closePhotoModal}>
          <Animated.View style={[styles.modalBackdrop, { opacity: opacityAnim }]}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.modalContent,
                  { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
                ]}
              >
                <Image
                  source={{ uri: displayPhoto }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
                {/* Name label inside modal */}
                <View style={styles.modalNameRow}>
                  <Text style={styles.modalName}>{fullName}</Text>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>

            {/* Close button */}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={closePhotoModal}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const MODAL_SIZE = SCREEN_WIDTH * 0.82;

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

  // ── Avatar ──
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

  // ── Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: MODAL_SIZE,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#4a2e2c",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  modalImage: {
    width: MODAL_SIZE,
    height: MODAL_SIZE,
  },
  modalNameRow: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: "#4a2e2c",
    alignItems: "center",
  },
  modalName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  modalCloseBtn: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.08,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});