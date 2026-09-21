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
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { showAlert } from "../components/AppAlert";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useAuth as useAppAuth } from "../context/AuthContext";
import { useProfileImage } from "../context/ProfileImageContext";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import { ScreenHeader, H_PAD, TAP } from "../components/ui";
import { BASE_URL } from "../api";
import { avatarImage } from "../utils/image";
import Icon from "../components/Icon";

// Was a hardcoded "https://libotbackend.onrender.com" — the only place in the
// app not reading the shared base URL, so an environment change would have
// silently left this one screen pointing at production.

export default function ProfileScreen() {
  const navigation                    = useNavigation();
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken }                  = useAuth();
  const { user: contextUser }         = useAppAuth();
  const { profileImage }              = useProfileImage();
  const { colors, isDark }            = useTheme();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const modalSize                     = winWidth * 0.82;

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
      onPress: () =>
        showAlert(
          "Not Available Yet",
          "Account deactivation isn't set up yet. If you'd like to deactivate or delete your account, please contact support.",
          [{ text: "OK" }]
        ),
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
      <ScreenHeader
        title="Profile"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        right={
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.navigate("EditProfile")}
            hitSlop={8}
            accessibilityLabel="Edit profile"
          >
            <Icon name="edit-2" size={18} color={colors.brand} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.profilePhotoContainer}>
          <TouchableOpacity
            onPress={openPhotoModal}
            activeOpacity={displayPhoto ? 0.8 : 1}
            disabled={!displayPhoto}
            accessibilityRole={displayPhoto ? "imagebutton" : "image"}
            accessibilityLabel={displayPhoto ? "Your profile photo" : "No profile photo set"}
            accessibilityHint={displayPhoto ? "Opens a larger view" : undefined}
          >
            <View style={[styles.profilePhotoWrapper, { backgroundColor: colors.brand, borderColor: colors.card }]}>
              {displayPhoto ? (
                <Image source={{ uri: avatarImage(displayPhoto, 104) }} style={styles.profilePhoto} />
              ) : (
                <View style={[styles.profilePhotoPlaceholder, { backgroundColor: colors.brand }]}>
                  <Icon name="user" size={40} color={colors.onBrand} />
                </View>
              )}
            </View>
            {displayPhoto && (
              <View style={[styles.zoomBadge, { backgroundColor: colors.overlay }]}>
                <Icon name="zoom-in" size={11} color={colors.textInverse} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {fullName ? (
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{fullName}</Text>
        ) : null}
        <Text style={[styles.email, { color: colors.textSecondary }]}>{userInfo.email || "No email available"}</Text>

        {/* Each stat is grouped into a single accessibility node — otherwise a
            screen reader reads six disconnected fragments ("Trips", "12",
            "Points", "340"…) instead of three facts. */}
        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.statCard} accessible accessibilityLabel={`${tripCount} trips`}>
            <Icon name="map-pin" size={18} color={colors.brand} style={styles.statIcon} />
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips</Text>
            <Text style={[styles.statCount, { color: colors.textPrimary }]}>{tripCount}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statCard} accessible accessibilityLabel={`${points} points`}>
            <Icon name="star" size={18} color={colors.star} style={styles.statIcon} />
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Points</Text>
            <Text style={[styles.statCount, { color: colors.brand }]}>{points}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.cardBorder }]} />
          <View style={styles.statCard} accessible accessibilityLabel={`${badgeCount} badges earned`}>
            <Icon name="award" size={18} color={colors.brand} style={styles.statIcon} />
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
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.brandLight }]}>
                  <Icon name={item.icon} size={18} color={colors.brand} />
                </View>
                <Text style={[styles.menuText, { color: colors.textPrimary }]}>{item.title}</Text>
              </View>
              <View style={styles.menuRight}>
                {item.badge ? (
                  <View style={[styles.badgePill, { backgroundColor: colors.brand }]}>
                    <Text style={[styles.badgePillText, { color: colors.textInverse }]}>{item.badge}</Text>
                  </View>
                ) : null}
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
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
                  // Sized from the live window rather than a module-scope
                  // Dimensions.get() captured at import, which is stale after a
                  // rotation or in Android split-screen.
                  { width: modalSize + 16, height: modalSize + 16, borderRadius: (modalSize + 16) / 2 },
                  { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
                ]}
              >
                <View
                  style={[
                    styles.modalContent,
                    { width: modalSize, height: modalSize, borderRadius: modalSize / 2, borderColor: colors.background },
                  ]}
                >
                  <Image
                    source={{ uri: displayPhoto }}
                    style={{ width: modalSize, height: modalSize }}
                    resizeMode="cover"
                  />
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { top: winHeight * 0.08, backgroundColor: colors.overlay }]}
              onPress={closePhotoModal}
              accessibilityRole="button"
              accessibilityLabel="Close photo"
            >
              <Icon name="x" size={20} color={colors.textInverse} />
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
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 16, paddingBottom: 60 },

  profilePhotoContainer: { alignItems: "center", marginBottom: 14 },
  profilePhotoWrapper: {
    width: 104, height: 104, borderRadius: 52, overflow: "hidden",
    justifyContent: "center", alignItems: "center",
    borderWidth: 4,
  },
  profilePhoto:            { width: "100%", height: "100%", resizeMode: "cover" },
  profilePhotoPlaceholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  zoomBadge: {
    position: "absolute", bottom: 0, right: 0, width: 26, height: 26,
    borderRadius: 13, justifyContent: "center", alignItems: "center",
  },

  userName: { ...typography.display, fontSize: 26, lineHeight: 32, textAlign: "center", marginBottom: 4 },
  email:    { fontSize: 13, fontFamily: fonts.sansMedium, textAlign: "center", marginBottom: 26 },

  statsRow: {
    flexDirection: "row", borderRadius: 22, paddingVertical: 20, paddingHorizontal: 12,
    marginBottom: 28, alignItems: "center", borderWidth: 1,
  },
  statCard:    { flex: 1, alignItems: "center" },
  statIcon:    { marginBottom: 5 },
  statDivider: { width: 1, height: 50, marginHorizontal: 4 },
  statLabel:   { fontSize: 11, fontFamily: fonts.sansMedium, marginBottom: 4 },
  statCount:   { fontSize: 26, fontFamily: fonts.sansBold, letterSpacing: -0.5 },

  menuContainer: { backgroundColor: "transparent" },
  menuItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderRadius: 16, paddingVertical: 15, paddingHorizontal: 15,
    marginBottom: 10, borderWidth: 1,
  },
  menuLeft:      { flexDirection: "row", alignItems: "center" },
  iconContainer: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 12 },
  menuText:      { fontSize: 15, fontFamily: fonts.sansSemi },
  menuRight:     { flexDirection: "row", alignItems: "center", gap: 8 },
  badgePill:     { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgePillText: { fontSize: 11, fontFamily: fonts.sansBold },

  // ── Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalRing: {
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
    overflow: "hidden",
    borderWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  modalCloseBtn: {
    position: "absolute",
    right: 20,
    width: TAP,
    height: TAP,
    borderRadius: TAP / 2,
    justifyContent: "center",
    alignItems: "center",
  },
});