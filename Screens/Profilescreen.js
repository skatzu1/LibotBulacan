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
import { useTheme } from "../context/ThemeContext";

const BASE_URL = "https://libotbackend.onrender.com";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_SIZE = SCREEN_WIDTH * 0.82;

export default function ProfileScreen() {
  const navigation                    = useNavigation();
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken }                  = useAuth();
  const { user: contextUser }         = useAppAuth();
  const { profileImage }              = useProfileImage();
  const { colors, isDark }            = useTheme();

  const [userInfo, setUserInfo] = useState({
    email: "", firstName: "", lastName: "", fullName: "", profilePhoto: null,
  });
  const [points, setPoints]         = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [tripCount, setTripCount]   = useState(0);

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
      onPress: () => navigation.navigate("PreviousTrips"),
    },
    {
      id: 3,
      icon: "award",
      title: "Badges",
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
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-left" size={24} color={colors.brandDark} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.brandDark }]}>Profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <Feather name="edit-2" size={18} color={colors.brand} />
          </TouchableOpacity>
        </View>

        <View style={styles.profilePhotoContainer}>
          <TouchableOpacity
            onPress={openPhotoModal}
            activeOpacity={displayPhoto ? 0.8 : 1}
            disabled={!displayPhoto}
          >
            <View style={[styles.profilePhotoWrapper, { backgroundColor: colors.brand }]}>
              {displayPhoto ? (
                <Image source={{ uri: displayPhoto }} style={styles.profilePhoto} />
              ) : (
                <View style={[styles.profilePhotoPlaceholder, { backgroundColor: colors.brand }]}>
                  <Feather name="user" size={40} color={colors.textInverse} />
                </View>
              )}
            </View>
            {displayPhoto && (
              <View style={[styles.zoomBadge, { backgroundColor: colors.overlay }]}>
                <Feather name="zoom-in" size={11} color={colors.textInverse} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {fullName ? (
          <Text style={[styles.userName, { color: colors.brandDark }]}>{fullName}</Text>
        ) : null}
        <Text style={[styles.email, { color: colors.textSecondary }]}>{userInfo.email || "No email available"}</Text>

        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.statCard}>
            <Feather name="map-pin" size={18} color={colors.brand} style={styles.statIcon} />
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
            <Text style={[styles.statCount, { color: colors.textPrimary }]}>{tripCount}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statCard}>
            <Feather name="star" size={18} color={colors.star} style={styles.statIcon} />
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Points</Text>
            <Text style={[styles.statCount, { color: colors.brand }]}>{points}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statCard}>
            <Feather name="award" size={18} color={colors.brand} style={styles.statIcon} />
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Badges</Text>
            <Text style={[styles.statCount, { color: colors.brand }]}>{badgeCount}</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.brandLight }]}>
                  <Feather name={item.icon} size={18} color={colors.brand} />
                </View>
                <Text style={[styles.menuText, { color: colors.textPrimary }]}>{item.title}</Text>
              </View>
              <View style={styles.menuRight}>
                {item.badge ? (
                  <View style={[styles.badgePill, { backgroundColor: colors.brand }]}>
                    <Text style={[styles.badgePillText, { color: colors.textInverse }]}>{item.badge}</Text>
                  </View>
                ) : null}
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* ── Photo Modal ── */}
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
                  styles.modalRing,
                  { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
                ]}
              >
                <View style={[styles.modalContent, { borderColor: colors.background }]}>
                  <Image
                    source={{ uri: displayPhoto }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>

            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: colors.overlay }]} onPress={closePhotoModal}>
              <Feather name="x" size={20} color={colors.textInverse} />
            </TouchableOpacity>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  centered:      { justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 50 },

  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 24,
  },
  backButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  editButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-end" },

  profilePhotoContainer: { alignItems: "center", marginBottom: 12 },
  profilePhotoWrapper: {
    width: 100, height: 100, borderRadius: 50, overflow: "hidden",
    justifyContent: "center", alignItems: "center",
  },
  profilePhoto:            { width: "100%", height: "100%", resizeMode: "cover" },
  profilePhotoPlaceholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  zoomBadge: {
    position: "absolute", bottom: 0, right: 0, width: 26, height: 26,
    borderRadius: 13, justifyContent: "center", alignItems: "center",
  },

  userName: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  email:    { fontSize: 13, textAlign: "center", marginBottom: 20 },

  statsRow: {
    flexDirection: "row", borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12,
    marginBottom: 24, alignItems: "center", borderWidth: 1,
  },
  statCard:    { flex: 1, alignItems: "center" },
  statIcon:    { marginBottom: 5 },
  statDivider: { width: 1, height: 50, marginHorizontal: 4 },
  statLabel:   { fontSize: 11, fontWeight: "500", marginBottom: 4 },
  statCount:   { fontSize: 24, fontWeight: "700" },

  menuContainer: { backgroundColor: "transparent" },
  menuItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14,
    marginBottom: 8, borderWidth: 1,
  },
  menuLeft:      { flexDirection: "row", alignItems: "center" },
  iconContainer: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 12 },
  menuText:      { fontSize: 15, fontWeight: "500" },
  menuRight:     { flexDirection: "row", alignItems: "center", gap: 8 },
  badgePill:     { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgePillText: { fontSize: 11, fontWeight: "700" },

  // ── Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalRing: {
    width: MODAL_SIZE + 16,
    height: MODAL_SIZE + 16,
    borderRadius: (MODAL_SIZE + 16) / 2,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  modalContent: {
    width: MODAL_SIZE,
    height: MODAL_SIZE,
    borderRadius: MODAL_SIZE / 2,
    overflow: "hidden",
    borderWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  modalImage: {
    width: MODAL_SIZE,
    height: MODAL_SIZE,
  },
  modalCloseBtn: {
    position: "absolute",
    top: SCREEN_HEIGHT * 0.08,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});