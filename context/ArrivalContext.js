// context/ArrivalContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";

const BASE_URL = "https://libotbackend.onrender.com";
const ARRIVAL_RADIUS_METERS = 50;
const POINTS_PER_VISIT = 10;

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getSpotCoords(spot) {
  if (!spot) return null;
  if (spot.coordinates?.lat != null && spot.coordinates?.lng != null)
    return { lat: spot.coordinates.lat, lng: spot.coordinates.lng };
  if (spot.latitude != null && spot.longitude != null)
    return { lat: spot.latitude, lng: spot.longitude };
  return null;
}

// ✅ Safe default — prevents null crash if Provider is ever missing
const ArrivalContext = createContext({
  activeSpot: null,
  setActiveSpot: () => {},
});

export function useArrival() {
  const ctx = useContext(ArrivalContext);
  if (!ctx) throw new Error("useArrival() must be used inside <ArrivalProvider>");
  return ctx;
}

export function ArrivalProvider({ children }) {
  const { getToken, isSignedIn } = useAuth();

  const [activeSpot, setActiveSpot] = useState(null);

  // Points popup
  const [showPointsPopup, setShowPointsPopup] = useState(false);
  const [popupPoints, setPopupPoints]         = useState({ earned: 0, total: 0 });
  const pointsOpacity    = useRef(new Animated.Value(0)).current;
  const pointsTranslateY = useRef(new Animated.Value(40)).current;
  const pointsScale      = useRef(new Animated.Value(0.8)).current;

  // Badge banner
  const [pendingBadge, setPendingBadge]       = useState(null);
  const [showBadgeBanner, setShowBadgeBanner] = useState(false);
  const badgeTranslateY = useRef(new Animated.Value(-160)).current;

  const locationSub  = useRef(null);
  const arrivedSpots = useRef(new Set());

  // Keep a ref to activeSpot so the location watcher always sees latest value
  const activeSpotRef = useRef(activeSpot);
  useEffect(() => { activeSpotRef.current = activeSpot; }, [activeSpot]);

  /* ── Points popup ── */
  const triggerPointsPopup = useCallback((earned, total) => {
    setPopupPoints({ earned, total });
    pointsOpacity.setValue(0);
    pointsTranslateY.setValue(40);
    pointsScale.setValue(0.8);
    setShowPointsPopup(true);

    Animated.parallel([
      Animated.timing(pointsOpacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(pointsTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(pointsScale,      { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(pointsOpacity,    { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(pointsTranslateY, { toValue: -20, duration: 300, useNativeDriver: true }),
        ]).start(() => setShowPointsPopup(false));
      }, 2400);
    });
  }, [pointsOpacity, pointsTranslateY, pointsScale]);

  /* ── Badge banner ── */
  const triggerBadgeBanner = useCallback((badge) => {
    badgeTranslateY.setValue(-160);
    setPendingBadge(badge);
    setShowBadgeBanner(true);
    Animated.timing(badgeTranslateY, { toValue: 0, duration: 350, useNativeDriver: true }).start();
  }, [badgeTranslateY]);

  const dismissBadgeBanner = useCallback(() => {
    Animated.timing(badgeTranslateY, { toValue: -160, duration: 280, useNativeDriver: true })
      .start(() => { setShowBadgeBanner(false); setPendingBadge(null); });
  }, [badgeTranslateY]);

  /* ── Claim badge ── */
  const claimBadge = useCallback(async () => {
    if (!pendingBadge) return;
    const badge = pendingBadge;
    dismissBadgeBanner();

    try {
      const token = await getToken();
      await fetch(`${BASE_URL}/api/users/badges`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ spotId: badge.spotId }),
      });
    } catch (e) {
      console.warn("claimBadge network error:", e);
    }

    try {
      const raw = await AsyncStorage.getItem("claimedSpotIds");
      const ids = raw ? JSON.parse(raw) : [];
      if (!ids.includes(badge.spotId)) {
        ids.push(badge.spotId);
        await AsyncStorage.setItem("claimedSpotIds", JSON.stringify(ids));
      }
    } catch (_) {}
  }, [pendingBadge, dismissBadgeBanner, getToken]);

  /* ── Award rewards on arrival ── */
  const awardRewards = useCallback(async (spot) => {
    const spotId = spot._id;
    if (arrivedSpots.current.has(spotId)) return;
    arrivedSpots.current.add(spotId);

    // 1. Points
    let earned = 0;
    let total  = 0;
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users/points`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ spotId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          total  = data.points;
          earned = data.alreadyAwarded ? 0 : POINTS_PER_VISIT;
          await AsyncStorage.setItem("userPoints", String(total));
        }
      }
    } catch (e) {
      console.warn("awardRewards points error:", e);
      const stored  = await AsyncStorage.getItem("userPoints").catch(() => "0");
      const current = parseInt(stored ?? "0", 10);
      total  = current + POINTS_PER_VISIT;
      earned = POINTS_PER_VISIT;
      await AsyncStorage.setItem("userPoints", String(total)).catch(() => {});
    }

    if (earned > 0) triggerPointsPopup(earned, total);

    // 2. Badge
    try {
      const token   = await getToken();
      const spotRes = await fetch(`${BASE_URL}/api/spots/${spotId}`);
      if (!spotRes.ok) return;

      const spotData  = await spotRes.json();
      const freshSpot = spotData?.spot;

      const badgeImageUrl = freshSpot?.Badge ?? freshSpot?.badge?.image ?? null;
      if (!badgeImageUrl) return;

      const meRes = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) return;

      const meData         = await meRes.json();
      const userBadges     = meData?.user?.badges ?? [];
      const alreadyClaimed = userBadges.some((b) => b.spotId === spotId);

      if (!alreadyClaimed) {
        const delay = earned > 0 ? 1400 : 0;
        setTimeout(() => {
          triggerBadgeBanner({ spotId, name: freshSpot.name, image: badgeImageUrl });
        }, delay);
      }
    } catch (e) {
      console.warn("awardRewards badge check error:", e);
    }
  }, [getToken, triggerPointsPopup, triggerBadgeBanner]);

  /* ── Arrival check — uses ref so watcher never stales ── */
  const checkArrival = useCallback((coords) => {
    const spot = activeSpotRef.current; // ✅ always fresh
    if (!spot) return;
    const dest = getSpotCoords(spot);
    if (!dest) return;

    const dist = getDistanceMeters(
      coords.latitude, coords.longitude,
      dest.lat, dest.lng
    );
    if (dist <= ARRIVAL_RADIUS_METERS) awardRewards(spot);
  }, [awardRewards]); // no activeSpot dep needed — uses ref

  /* ── Global location watcher ── */
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;

      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (loc) => {
          if (cancelled) return;
          checkArrival({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      );
    };

    start();
    return () => {
      cancelled = true;
      locationSub.current?.remove();
      locationSub.current = null;
    };
  }, [isSignedIn]); // ✅ checkArrival removed from deps — uses ref internally

  return (
    <ArrivalContext.Provider value={{ activeSpot, setActiveSpot }}>
      {children}

      {/* Points Popup */}
      {showPointsPopup && (
        <Animated.View
          pointerEvents="none"
          style={[styles.pointsPopup, {
            opacity: pointsOpacity,
            transform: [{ translateY: pointsTranslateY }, { scale: pointsScale }],
          }]}
        >
          <Text style={styles.pointsEmoji}>🎉</Text>
          <Text style={styles.pointsTitle}>You arrived!</Text>
          <Text style={styles.pointsEarned}>+{popupPoints.earned} Points</Text>
          <Text style={styles.pointsTotal}>Total: {popupPoints.total} pts</Text>
        </Animated.View>
      )}

      {/* Badge Banner */}
      {showBadgeBanner && pendingBadge && (
        <Animated.View style={[styles.badgeBanner, { transform: [{ translateY: badgeTranslateY }] }]}>
          <View style={styles.bannerLeft}>
            {pendingBadge.image ? (
              <Image source={{ uri: pendingBadge.image }} style={styles.bannerImage} />
            ) : (
              <View style={styles.bannerPlaceholder}>
                <Feather name="award" size={22} color="#8b4440" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerLabel}>New Badge Unlocked!</Text>
              <Text style={styles.bannerName} numberOfLines={1}>{pendingBadge.name}</Text>
            </View>
          </View>
          <View style={styles.bannerActions}>
            <TouchableOpacity style={styles.claimBtn} onPress={claimBadge}>
              <Text style={styles.claimBtnText}>Claim</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissBtn} onPress={dismissBadgeBanner}>
              <Feather name="x" size={16} color="#8b4440" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </ArrivalContext.Provider>
  );
}

const styles = StyleSheet.create({
  pointsPopup: {
    position: "absolute", bottom: 120, alignSelf: "center",
    backgroundColor: "#fff", borderRadius: 20,
    paddingVertical: 20, paddingHorizontal: 35, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 20,
    borderWidth: 2, borderColor: "#f4c542", zIndex: 9999,
  },
  pointsEmoji:  { fontSize: 36, marginBottom: 6 },
  pointsTitle:  { fontSize: 18, fontWeight: "700", color: "#4a4a4a", marginBottom: 4 },
  pointsEarned: { fontSize: 26, fontWeight: "800", color: "#8b4440", marginBottom: 2 },
  pointsTotal:  { fontSize: 13, color: "#6a5a5a", fontWeight: "500" },

  badgeBanner: {
    position: "absolute", top: 55, left: 16, right: 16,
    backgroundColor: "#fff", borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 20,
    borderWidth: 1.5, borderColor: "#f4c542", zIndex: 9999,
  },
  bannerLeft:        { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  bannerImage:       { width: 44, height: 44, borderRadius: 22, resizeMode: "cover" },
  bannerPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#fce8e6", justifyContent: "center", alignItems: "center",
  },
  bannerLabel: {
    fontSize: 11, color: "#8b4440", fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  bannerName:    { fontSize: 14, color: "#4a2e2c", fontWeight: "600", marginTop: 1 },
  bannerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  claimBtn: {
    backgroundColor: "#8b4440", paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 20,
  },
  claimBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  dismissBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#fce8e6", justifyContent: "center", alignItems: "center",
  },
});