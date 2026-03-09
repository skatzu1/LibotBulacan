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
  Modal,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";

const BASE_URL              = "https://libotbackend.onrender.com";
const ARRIVAL_RADIUS_METERS = 50;
const POINTS_PER_VISIT      = 10;
const ACTIVE_SPOT_KEY       = "activeSpot";
const ALL_SPOTS_KEY         = "allSpots";
const SPOTS_CACHE_TTL_MS    = 5 * 60 * 1000;

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R    = 6371000;
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

async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch {
    console.error("[HTTP] Non-JSON from", res.url, "status:", res.status, "body:", text.slice(0, 150));
    return null;
  }
}

const ArrivalContext = createContext({
  activeSpot:      null,
  setActiveSpot:   () => {},
  clearActiveSpot: () => {},
  allSpots:        [],
});

export function useArrival() {
  const ctx = useContext(ArrivalContext);
  if (!ctx) throw new Error("useArrival() must be used inside <ArrivalProvider>");
  return ctx;
}

export function ArrivalProvider({ children }) {
  const { getToken, isSignedIn } = useAuth();

  const [activeSpot, setActiveSpotState] = useState(null);
  const [allSpots, setAllSpots]          = useState([]);
  const allSpotsRef                      = useRef([]);
  const spotsFetchedAt                   = useRef(0);

  // ── Points popup ──
  const [showPointsPopup, setShowPointsPopup] = useState(false);
  const [popupPoints, setPopupPoints]         = useState({ earned: 0, total: 0 });
  const pointsOpacity    = useRef(new Animated.Value(0)).current;
  const pointsTranslateY = useRef(new Animated.Value(60)).current;
  const pointsScale      = useRef(new Animated.Value(0.8)).current;

  // ── Badge banner ──
  const [pendingBadge, setPendingBadge]       = useState(null);
  const [showBadgeBanner, setShowBadgeBanner] = useState(false);
  const badgeTranslateY = useRef(new Animated.Value(-200)).current;

  const locationSub   = useRef(null);
  const arrivedSpots  = useRef(new Set());
  const activeSpotRef = useRef(null);

  useEffect(() => { activeSpotRef.current = activeSpot; }, [activeSpot]);

  /* ── Fetch all spots ── */
  const fetchAllSpots = useCallback(async () => {
    const now = Date.now();
    if (now - spotsFetchedAt.current < SPOTS_CACHE_TTL_MS && allSpotsRef.current.length > 0) return;

    try {
      const res  = await fetch(`${BASE_URL}/api/spots`);
      const data = await safeJson(res);
      if (data?.success && Array.isArray(data.spots)) {
        const spots = data.spots;
        allSpotsRef.current = spots;
        setAllSpots(spots);
        spotsFetchedAt.current = now;
        await AsyncStorage.setItem(ALL_SPOTS_KEY, JSON.stringify(spots));
        console.log("[Arrival] Loaded", spots.length, "spots for proximity detection");
      }
    } catch (e) {
      console.warn("[Arrival] Could not fetch spots, using cache:", e.message);
      try {
        const raw = await AsyncStorage.getItem(ALL_SPOTS_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          allSpotsRef.current = cached;
          setAllSpots(cached);
          console.log("[Arrival] Restored", cached.length, "spots from cache");
        }
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) fetchAllSpots();
  }, [isSignedIn]);

  /* ── Active spot ── */
  const setActiveSpot = useCallback(async (spot) => {
    try { if (spot) await AsyncStorage.setItem(ACTIVE_SPOT_KEY, JSON.stringify(spot)); } catch (_) {}
    setActiveSpotState(spot);
    activeSpotRef.current = spot;
  }, []);

  const clearActiveSpot = useCallback(async () => {
    try { await AsyncStorage.removeItem(ACTIVE_SPOT_KEY); } catch (_) {}
    setActiveSpotState(null);
    activeSpotRef.current = null;
  }, []);

  useEffect(() => {
    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_SPOT_KEY);
        if (raw) {
          const spot = JSON.parse(raw);
          setActiveSpotState(spot);
          activeSpotRef.current = spot;
          console.log("[Arrival] Restored active spot:", spot.name);
        }
      } catch (_) {}
    };
    restore();
  }, []);

  /* ── Points popup animation ── */
  const triggerPointsPopup = useCallback((earned, total) => {
    setPopupPoints({ earned, total });
    pointsOpacity.setValue(0);
    pointsTranslateY.setValue(60);
    pointsScale.setValue(0.8);
    setShowPointsPopup(true);

    Animated.parallel([
      Animated.spring(pointsOpacity,    { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.spring(pointsTranslateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.spring(pointsScale,      { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(pointsOpacity,    { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.timing(pointsTranslateY, { toValue: -30, duration: 350, useNativeDriver: true }),
          Animated.timing(pointsScale,      { toValue: 0.85, duration: 350, useNativeDriver: true }),
        ]).start(() => setShowPointsPopup(false));
      }, 2600);
    });
  }, [pointsOpacity, pointsTranslateY, pointsScale]);

  /* ── Badge banner animation ── */
  const triggerBadgeBanner = useCallback((badge) => {
    badgeTranslateY.setValue(-200);
    setPendingBadge(badge);
    setShowBadgeBanner(true);
    Animated.spring(badgeTranslateY, {
      toValue: 0, useNativeDriver: true, tension: 70, friction: 10,
    }).start();
  }, [badgeTranslateY]);

  const dismissBadgeBanner = useCallback(() => {
    Animated.timing(badgeTranslateY, {
      toValue: -200, duration: 300, useNativeDriver: true,
    }).start(() => {
      setShowBadgeBanner(false);
      setPendingBadge(null);
    });
  }, [badgeTranslateY]);

  /* ── Claim badge ── */
  const claimBadge = useCallback(async () => {
    if (!pendingBadge) return;
    const badge = { ...pendingBadge };
    dismissBadgeBanner();

    try {
      const token = await getToken();
      if (!token) { console.warn("[Badge] No token"); return; }

      const res  = await fetch(`${BASE_URL}/api/users/badges`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ spotId: badge.spotId }),
      });
      const data = await safeJson(res);

      if (!data) { console.error("[Badge] No JSON — check PATCH /api/users/badges exists in server.js"); return; }
      console.log("[Badge] Claim response:", res.status, JSON.stringify(data));

      if (!res.ok || !data.success) { console.warn("[Badge] Claim failed:", data?.message); return; }
      console.log("[Badge] ✅ Saved:", JSON.stringify(data.claimed));

      try {
        const raw = await AsyncStorage.getItem("claimedSpotIds");
        const ids = raw ? JSON.parse(raw) : [];
        if (!ids.includes(badge.spotId))
          await AsyncStorage.setItem("claimedSpotIds", JSON.stringify([...ids, badge.spotId]));
      } catch (_) {}

    } catch (e) { console.error("[Badge] Claim error:", e); }
  }, [pendingBadge, dismissBadgeBanner, getToken]);

  /* ─────────────────────────────────────────────────────────
     AWARD REWARDS
     Called when user physically arrives within 50m of a spot.
     visitCount is incremented here — NOT on card tap.
  ───────────────────────────────────────────────────────── */
  const awardRewards = useCallback(async (spot) => {
    const spotId = String(spot._id ?? "").trim();
    if (!spotId) return;
    if (arrivedSpots.current.has(spotId)) return;
    arrivedSpots.current.add(spotId);

    console.log("[Arrival] ✅ Arrived at:", spot.name, "| spotId:", spotId);

    // ── 0. Increment visitCount (physical arrival only) ────
    try {
      await fetch(`${BASE_URL}/api/spots/${spotId}/visit`, { method: "PATCH" });
      console.log("[Visit] ✅ Incremented visitCount for:", spot.name);
    } catch (e) {
      console.warn("[Visit] Failed to increment visitCount:", e);
    }

    // ── 1. Points ──────────────────────────────────────────
    let pointsJustEarned = false;
    try {
      const token = await getToken();
      const res   = await fetch(`${BASE_URL}/api/users/points`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ spotId }),
      });
      const data = await safeJson(res);
      console.log("[Points]", res.status, JSON.stringify(data));

      if (res.ok && data?.success && !data.alreadyAwarded) {
        pointsJustEarned = true;
        await AsyncStorage.setItem("userPoints", String(data.points));
        triggerPointsPopup(POINTS_PER_VISIT, data.points);
      }
    } catch (e) { console.warn("[Points] Error:", e); }

    // ── 2. Badge ───────────────────────────────────────────
    try {
      const cachedSpot  = allSpotsRef.current.find((s) => String(s._id) === spotId);
      let badgeImageUrl = cachedSpot?.Badge ?? cachedSpot?.badge?.image ?? null;
      let spotName      = cachedSpot?.name ?? spot.name;

      if (!cachedSpot) {
        const spotRes  = await fetch(`${BASE_URL}/api/spots/${spotId}`);
        const spotJson = await safeJson(spotRes);
        const fresh    = spotJson?.spot;
        if (fresh) {
          badgeImageUrl = fresh.Badge ?? fresh.badge?.image ?? null;
          spotName      = fresh.name;
        }
      }

      if (!badgeImageUrl) { console.log("[Badge] No badge for:", spotName); return; }

      console.log("[Badge] Badge URL:", badgeImageUrl);

      try {
        const raw       = await AsyncStorage.getItem("claimedSpotIds");
        const cachedIds = raw ? JSON.parse(raw) : [];
        if (cachedIds.includes(spotId)) { console.log("[Badge] Already claimed (cache)"); return; }
      } catch (_) {}

      const token  = await getToken();
      const meRes  = await fetch(`${BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meData = await safeJson(meRes);
      const alreadyClaimed = (meData?.user?.badges ?? []).some((b) => String(b.spotId) === spotId);

      if (alreadyClaimed) { console.log("[Badge] Already in DB"); return; }

      const delay = pointsJustEarned ? 1500 : 0;
      console.log("[Badge] Showing banner in", delay, "ms");
      setTimeout(() => triggerBadgeBanner({ spotId, name: spotName, image: badgeImageUrl }), delay);

    } catch (e) { console.error("[Badge] Error:", e); }
  }, [getToken, triggerPointsPopup, triggerBadgeBanner]);

  /* ── Check arrival against all spots ── */
  const checkArrival = useCallback((coords) => {
    const spots = allSpotsRef.current;
    for (const spot of spots) {
      const dest = getSpotCoords(spot);
      if (!dest) continue;
      const dist = getDistanceMeters(
        coords.latitude, coords.longitude,
        dest.lat, dest.lng
      );
      if (dist <= ARRIVAL_RADIUS_METERS) {
        awardRewards(spot);
      }
    }
  }, [awardRewards]);

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
  }, [isSignedIn]);

  return (
    <ArrivalContext.Provider value={{ activeSpot, setActiveSpot, clearActiveSpot, allSpots }}>
      {children}

      {/* Points Popup */}
      <Modal visible={showPointsPopup} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
        <View style={styles.pointsOverlay} pointerEvents="box-none">
          <Animated.View
            pointerEvents="none"
            style={[styles.pointsPopup, { opacity: pointsOpacity, transform: [{ translateY: pointsTranslateY }, { scale: pointsScale }] }]}
          >
            <Text style={styles.pointsEmoji}>🎉</Text>
            <Text style={styles.pointsTitle}>You arrived!</Text>
            <Text style={styles.pointsEarned}>+{String(popupPoints.earned)} Points</Text>
            <Text style={styles.pointsTotal}>Total: {String(popupPoints.total)} pts</Text>
          </Animated.View>
        </View>
      </Modal>

      {/* Badge Banner */}
      <Modal visible={showBadgeBanner && !!pendingBadge} transparent animationType="none" statusBarTranslucent onRequestClose={dismissBadgeBanner}>
        <TouchableOpacity style={styles.badgeBackdrop} activeOpacity={1} onPress={dismissBadgeBanner}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <Animated.View style={[styles.badgeBanner, { transform: [{ translateY: badgeTranslateY }] }]}>
              <View style={styles.bannerLeft}>
                {pendingBadge?.image ? (
                  <Image source={{ uri: pendingBadge.image }} style={styles.bannerImage} />
                ) : (
                  <View style={styles.bannerPlaceholder}>
                    <Feather name="award" size={22} color="#8b4440" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerLabel}>New Badge Unlocked!</Text>
                  <Text style={styles.bannerName} numberOfLines={2}>{String(pendingBadge?.name ?? "")}</Text>
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ArrivalContext.Provider>
  );
}

const styles = StyleSheet.create({
  pointsOverlay: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: 110 },
  pointsPopup: {
    backgroundColor: "#fff", borderRadius: 24, paddingVertical: 22, paddingHorizontal: 40,
    alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 25,
    borderWidth: 2, borderColor: "#f4c542", minWidth: 200,
  },
  pointsEmoji:  { fontSize: 38, marginBottom: 6 },
  pointsTitle:  { fontSize: 18, fontWeight: "700", color: "#4a4a4a", marginBottom: 4 },
  pointsEarned: { fontSize: 28, fontWeight: "800", color: "#8b4440", marginBottom: 2 },
  pointsTotal:  { fontSize: 13, color: "#6a5a5a", fontWeight: "500" },

  badgeBackdrop: { flex: 1 },
  badgeBanner: {
    marginTop: Platform.OS === "ios" ? 55 : 40, marginHorizontal: 16,
    backgroundColor: "#fff", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 25,
    borderWidth: 1.5, borderColor: "#f4c542",
  },
  bannerLeft:        { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  bannerImage:       { width: 46, height: 46, borderRadius: 23, resizeMode: "cover" },
  bannerPlaceholder: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#fce8e6", justifyContent: "center", alignItems: "center" },
  bannerLabel:       { fontSize: 11, color: "#8b4440", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  bannerName:        { fontSize: 14, color: "#4a2e2c", fontWeight: "600", marginTop: 2 },
  bannerActions:     { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
  claimBtn:          { backgroundColor: "#8b4440", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  claimBtnText:      { color: "#fff", fontWeight: "700", fontSize: 13 },
  dismissBtn:        { width: 30, height: 30, borderRadius: 15, backgroundColor: "#fce8e6", justifyContent: "center", alignItems: "center" },
});