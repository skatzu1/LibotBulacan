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
  AppState,
} from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";
import { navigationRef } from "../navigation/navigationRef";

const BASE_URL                 = "https://libotbackend.onrender.com";
const ARRIVAL_RADIUS_METERS    = 50;
const POINTS_PER_VISIT         = 10;
const ACTIVE_SPOT_KEY          = "activeSpot";
const ALL_SPOTS_KEY            = "allSpots";
const SPOTS_CACHE_TTL_MS       = 5 * 60 * 1000;
const BACKGROUND_LOCATION_TASK = "background-location-task";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Background task
// ─────────────────────────────────────────────
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) { console.error("[BG Location] Error:", error); return; }
  if (data?.locations?.length > 0) {
    const loc = data.locations[0];
    await handleBackgroundArrival({
      latitude:  loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  }
});

async function handleBackgroundArrival(coords) {
  try {
    const spotsJson = await AsyncStorage.getItem(ALL_SPOTS_KEY);
    const spots     = spotsJson ? JSON.parse(spotsJson) : [];

    const arrivedFirstRaw  = await AsyncStorage.getItem("arrivedSpotsFirst");
    const arrivedReturnRaw = await AsyncStorage.getItem("arrivedSpotsReturn");
    const arrivedFirst  = arrivedFirstRaw  ? JSON.parse(arrivedFirstRaw)  : [];
    const arrivedReturn = arrivedReturnRaw ? JSON.parse(arrivedReturnRaw) : [];

    const currentUserId = await AsyncStorage.getItem("currentUserId");

    for (const spot of spots) {
      const spotId = String(spot._id ?? "").trim();
      if (!spotId) continue;
      if (arrivedFirst.includes(spotId) || arrivedReturn.includes(spotId)) continue;

      const dest = getSpotCoords(spot);
      if (!dest) continue;

      const dist = getDistanceMeters(coords.latitude, coords.longitude, dest.lat, dest.lng);
      if (dist > ARRIVAL_RADIUS_METERS) continue;

      const cacheKey   = `claimedSpotIds_${currentUserId}`;
      const claimedRaw = await AsyncStorage.getItem(cacheKey);
      const claimed    = claimedRaw ? JSON.parse(claimedRaw) : [];
      const isFirstVisit = !claimed.includes(spotId);

      if (isFirstVisit) {
        arrivedFirst.push(spotId);
        await AsyncStorage.setItem("arrivedSpotsFirst", JSON.stringify(arrivedFirst));
      } else {
        arrivedReturn.push(spotId);
        await AsyncStorage.setItem("arrivedSpotsReturn", JSON.stringify(arrivedReturn));
      }

      // ✅ Always send system notification, message differs by visit type
      await Notifications.scheduleNotificationAsync({
        content: {
          title: isFirstVisit ? "🏅 You arrived!" : "📍 Welcome back!",
          body: isFirstVisit
            ? `You've reached ${spot.name}! Open Libot to claim your badge.`
            : `You've arrived at ${spot.name}. Open Libot Bulacan to explore!`,
          data: { spotId, spotName: spot.name, isFirstVisit },
        },
        trigger: null,
      });

      console.log(
        isFirstVisit
          ? `[BG Arrival] ✅ First visit at: ${spot.name}`
          : `[BG Arrival] 🔁 Return visit at: ${spot.name}`
      );
    }
  } catch (e) {
    console.error("[BG Arrival] Error:", e);
  }
}

// ─────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────
async function setupNotifications() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    const { status } = existing !== "granted"
      ? await Notifications.requestPermissionsAsync()
      : { status: existing };

    if (status !== "granted") {
      console.warn("[Notifications] Permission denied");
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner:  true,
        shouldShowBanner: true,
        shouldPlaySound:  true,
        shouldSetBadge:   true,
      }),
    });

    console.log("[Notifications] ✅ Configured");
  } catch (e) {
    console.error("[Notifications] Setup error:", e);
  }
}

// ─────────────────────────────────────────────
// Request location permissions in correct order
// ─────────────────────────────────────────────
async function requestAllLocationPermissions() {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== "granted") {
    console.warn("[Location] Foreground permission denied");
    return { foreground: false, background: false };
  }

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== "granted") {
    console.warn("[Location] Background permission denied — only foreground granted");
    return { foreground: true, background: false };
  }

  console.log("[Location] ✅ Foreground + background permissions granted");
  return { foreground: true, background: true };
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────
export function ArrivalProvider({ children }) {
  const { getToken, isSignedIn } = useAuth();
  const { user: clerkUser }      = useUser();

  const [activeSpot, setActiveSpotState] = useState(null);
  const [allSpots, setAllSpots]          = useState([]);
  const allSpotsRef                      = useRef([]);
  const spotsFetchedAt                   = useRef(0);

  const [showPointsPopup, setShowPointsPopup] = useState(false);
  const [popupPoints, setPopupPoints]         = useState({ earned: 0, total: 0 });
  const pointsOpacity    = useRef(new Animated.Value(0)).current;
  const pointsTranslateY = useRef(new Animated.Value(60)).current;
  const pointsScale      = useRef(new Animated.Value(0.8)).current;

  const [earnedBadge, setEarnedBadge]         = useState(null);
  const [showBadgeBanner, setShowBadgeBanner] = useState(false);
  const badgeTranslateY = useRef(new Animated.Value(-200)).current;
  const badgeOpacity    = useRef(new Animated.Value(0)).current;

  const locationSub      = useRef(null);
  const arrivedSpots     = useRef(new Set());
  const activeSpotRef    = useRef(null);
  const currentUserIdRef = useRef(null);
  const appStateRef      = useRef(AppState.currentState);
  const bgTrackingLock   = useRef(false);
  const appStateDebounce = useRef(null);
  const hasLocationPerms = useRef({ foreground: false, background: false });

  useEffect(() => { activeSpotRef.current = activeSpot; }, [activeSpot]);

  // ─────────────────────────────────────────
  // 1. On sign-in: request permissions + setup notifs
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;

    const init = async () => {
      await setupNotifications();
      hasLocationPerms.current = await requestAllLocationPermissions();
    };

    init();

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const spotId = response.notification.request.content.data?.spotId;
      if (spotId && navigationRef.isReady()) {
        navigationRef.navigate("Badges");
      }
    });

    return () => subscription.remove();
  }, [isSignedIn]);

  // ─────────────────────────────────────────
  // 2. AppState → start/stop background tracking
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;

    const handleAppStateChange = (nextState) => {
      if (appStateDebounce.current) clearTimeout(appStateDebounce.current);

      appStateDebounce.current = setTimeout(async () => {
        const prevState = appStateRef.current;

        // Going to background
        if (
          (nextState === "inactive" || nextState === "background") &&
          prevState === "active"
        ) {
          if (bgTrackingLock.current) return;
          bgTrackingLock.current = true;

          try {
            if (!hasLocationPerms.current.background) {
              console.warn("[Location] Skipping BG tracking — no background permission");
              return;
            }

            const isRunning = await Location.hasStartedLocationUpdatesAsync(
              BACKGROUND_LOCATION_TASK
            ).catch(() => false);

            if (!isRunning) {
              await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                accuracy:                   Location.Accuracy.Balanced,
                timeInterval:               30000,
                distanceInterval:           20,
                pausesUpdatesAutomatically: false,
                foregroundService: {
                  notificationTitle: "Libot is tracking your location",
                  notificationBody:  "Detecting nearby tourist spots in Bulacan.",
                  notificationColor: "#8b4440",
                },
              });
              console.log("[Location] ✅ Background tracking started");
            }
          } catch (e) {
            console.warn("[Location] Could not start background tracking:", e.message);
          } finally {
            bgTrackingLock.current = false;
          }
        }

        // Returning to foreground
        if (nextState === "active" && prevState !== "active") {
          try {
            const isRunning = await Location.hasStartedLocationUpdatesAsync(
              BACKGROUND_LOCATION_TASK
            ).catch(() => false);

            if (isRunning) {
              await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
              console.log("[Location] Background tracking stopped");
            }
          } catch (e) {
            console.warn("[Location] Could not stop background tracking:", e.message);
          }
        }

        appStateRef.current = nextState;
      }, 300);
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
      if (appStateDebounce.current) clearTimeout(appStateDebounce.current);
    };
  }, [isSignedIn]);

  // ─────────────────────────────────────────
  // Reset on user change
  // ─────────────────────────────────────────
  useEffect(() => {
    const newUserId = clerkUser?.id ?? null;
    if (newUserId === currentUserIdRef.current) return;

    console.log("[Arrival] 🔄 User changed:", currentUserIdRef.current, "→", newUserId);

    if (newUserId) AsyncStorage.setItem("currentUserId", newUserId);
    AsyncStorage.removeItem("arrivedSpotsFirst");
    AsyncStorage.removeItem("arrivedSpotsReturn");

    arrivedSpots.current     = new Set();
    setActiveSpotState(null);
    activeSpotRef.current    = null;
    allSpotsRef.current      = [];
    spotsFetchedAt.current   = 0;
    currentUserIdRef.current = newUserId;
  }, [clerkUser?.id]);

  // ─────────────────────────────────────────
  // Fetch spots
  // ─────────────────────────────────────────
  const fetchAllSpots = useCallback(async () => {
    const now = Date.now();
    if (now - spotsFetchedAt.current < SPOTS_CACHE_TTL_MS && allSpotsRef.current.length > 0) return;

    try {
      const res  = await fetch(`${BASE_URL}/api/spots`);
      const data = await safeJson(res);
      if (data?.success && Array.isArray(data.spots)) {
        const spots = data.spots;
        allSpotsRef.current    = spots;
        spotsFetchedAt.current = now;
        setAllSpots(spots);
        await AsyncStorage.setItem(ALL_SPOTS_KEY, JSON.stringify(spots));
        console.log("[Arrival] Loaded", spots.length, "spots");
      }
    } catch (e) {
      console.warn("[Arrival] Could not fetch spots, using cache:", e.message);
      try {
        const raw = await AsyncStorage.getItem(ALL_SPOTS_KEY);
        if (raw) { const c = JSON.parse(raw); allSpotsRef.current = c; setAllSpots(c); }
      } catch (_) {}
    }
  }, []);

  useEffect(() => { if (isSignedIn) fetchAllSpots(); }, [isSignedIn, fetchAllSpots]);

  // ─────────────────────────────────────────
  // Active spot
  // ─────────────────────────────────────────
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
    if (!isSignedIn) return;
    AsyncStorage.getItem(ACTIVE_SPOT_KEY).then((raw) => {
      if (!raw) return;
      try {
        const spot = JSON.parse(raw);
        setActiveSpotState(spot);
        activeSpotRef.current = spot;
        console.log("[Arrival] Restored active spot:", spot.name);
      } catch (_) {}
    });
  }, [isSignedIn]);

  // ─────────────────────────────────────────
  // Points popup
  // ─────────────────────────────────────────
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
          Animated.timing(pointsOpacity,    { toValue: 0,    duration: 350, useNativeDriver: true }),
          Animated.timing(pointsTranslateY, { toValue: -30,  duration: 350, useNativeDriver: true }),
          Animated.timing(pointsScale,      { toValue: 0.85, duration: 350, useNativeDriver: true }),
        ]).start(() => setShowPointsPopup(false));
      }, 2600);
    });
  }, [pointsOpacity, pointsTranslateY, pointsScale]);

  // ─────────────────────────────────────────
  // Badge banner
  // ─────────────────────────────────────────
  const triggerBadgeBanner = useCallback((badge) => {
    badgeTranslateY.setValue(-200);
    badgeOpacity.setValue(0);
    setEarnedBadge(badge);
    setShowBadgeBanner(true);

    Animated.parallel([
      Animated.spring(badgeTranslateY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }),
      Animated.timing(badgeOpacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(badgeTranslateY, { toValue: -200, duration: 350, useNativeDriver: true }),
          Animated.timing(badgeOpacity,    { toValue: 0,    duration: 350, useNativeDriver: true }),
        ]).start(() => { setShowBadgeBanner(false); setEarnedBadge(null); });
      }, 5000);
    });
  }, [badgeTranslateY, badgeOpacity]);

  // ─────────────────────────────────────────
  // Save badge to DB
  // ─────────────────────────────────────────
  const saveBadge = useCallback(async (badge) => {
    try {
      const token = await getToken();
      if (!token) { console.warn("[Badge] No token"); return; }

      const res  = await fetch(`${BASE_URL}/api/users/badges`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ spotId: badge.spotId }),
      });
      const data = await safeJson(res);
      if (!data || !res.ok || !data.success) { console.warn("[Badge] Save failed:", data?.message); return; }

      console.log("[Badge] ✅ Auto-saved:", JSON.stringify(data.claimed));

      const cacheKey = `claimedSpotIds_${currentUserIdRef.current}`;
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        const ids = raw ? JSON.parse(raw) : [];
        if (!ids.includes(badge.spotId))
          await AsyncStorage.setItem(cacheKey, JSON.stringify([...ids, badge.spotId]));
      } catch (_) {}
    } catch (e) { console.error("[Badge] Save error:", e); }
  }, [getToken]);

  // ─────────────────────────────────────────
  // Award rewards (foreground)
  // ─────────────────────────────────────────
  const awardRewards = useCallback(async (spot) => {
    const spotId = String(spot._id ?? "").trim();
    if (!spotId || arrivedSpots.current.has(spotId)) return;
    arrivedSpots.current.add(spotId);

    console.log("[Arrival] ✅ Arrived at:", spot.name, "| spotId:", spotId);

    // visitCount
    try {
      const token = await getToken();
      const visitRes = await fetch(`${BASE_URL}/api/spots/${spotId}/visit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const visitData = await safeJson(visitRes);
      console.log("[Visit]", visitData?.alreadyVisited ? "⚠️ Already visited" : `✅ visitCount → ${visitData?.visitCount}`);
    } catch (e) { console.warn("[Visit] Failed:", e); }

    // Points
    let pointsJustEarned = false;
    try {
      const token = await getToken();
      const res   = await fetch(`${BASE_URL}/api/users/points`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ spotId }),
      });
      const data = await safeJson(res);
      if (res.ok && data?.success && !data.alreadyAwarded) {
        pointsJustEarned = true;
        await AsyncStorage.setItem("userPoints", String(data.points));
        triggerPointsPopup(POINTS_PER_VISIT, data.points);
      }
    } catch (e) { console.warn("[Points] Error:", e); }

    // Badge
    try {
      const cacheKey  = `claimedSpotIds_${currentUserIdRef.current}`;
      const cachedRaw = await AsyncStorage.getItem(cacheKey);
      const cachedIds = cachedRaw ? JSON.parse(cachedRaw) : [];
      const isFirstVisit = !cachedIds.includes(spotId);

      // ✅ Always send system notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: isFirstVisit ? "🏅 You arrived!" : "📍 Welcome back!",
          body: isFirstVisit
            ? `You've reached ${spot.name}! Open Libot to claim your badge.`
            : `You've arrived at ${spot.name}. Open Libot Bulacan to explore!`,
          data: { spotId, spotName: spot.name, isFirstVisit },
        },
        trigger: null,
      });

      // ✅ In-app banner only on first visit
      if (!isFirstVisit) {
        console.log("[Badge] Return visit — system notif sent, no in-app banner");
        return;
      }

      // Verify against DB before showing in-app banner
      const token      = await getToken();
      const meRes      = await fetch(`${BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meData     = await safeJson(meRes);
      const alreadyInDB = (meData?.user?.badges ?? []).some((b) => String(b.spotId) === spotId);

      if (alreadyInDB) {
        if (!cachedIds.includes(spotId))
          await AsyncStorage.setItem(cacheKey, JSON.stringify([...cachedIds, spotId]));
        console.log("[Badge] Already in DB — system notif sent, no in-app banner");
        return;
      }

      // ✅ Genuinely first visit — get badge and show in-app banner
      const cachedSpot  = allSpotsRef.current.find((s) => String(s._id) === spotId);
      let badgeImageUrl = cachedSpot?.Badge ?? cachedSpot?.badge?.image ?? null;
      let spotName      = cachedSpot?.name  ?? spot.name;

      if (!cachedSpot) {
        const spotRes  = await fetch(`${BASE_URL}/api/spots/${spotId}`);
        const spotJson = await safeJson(spotRes);
        const fresh    = spotJson?.spot;
        if (fresh) { badgeImageUrl = fresh.Badge ?? fresh.badge?.image ?? null; spotName = fresh.name; }
      }

      if (!badgeImageUrl) { console.log("[Badge] No badge image for:", spotName); return; }

      const badge = { spotId, name: spotName, image: badgeImageUrl };
      await saveBadge(badge);
      setTimeout(() => triggerBadgeBanner(badge), pointsJustEarned ? 1500 : 0);

    } catch (e) { console.error("[Badge] Error:", e); }
  }, [getToken, triggerPointsPopup, triggerBadgeBanner, saveBadge]);

  // ─────────────────────────────────────────
  // Foreground location watcher
  // ─────────────────────────────────────────
  const checkArrival = useCallback((coords) => {
    for (const spot of allSpotsRef.current) {
      const dest = getSpotCoords(spot);
      if (!dest) continue;
      const dist = getDistanceMeters(coords.latitude, coords.longitude, dest.lat, dest.lng);
      if (dist <= ARRIVAL_RADIUS_METERS) awardRewards(spot);
    }
  }, [awardRewards]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;

    const start = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
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
  }, [isSignedIn, checkArrival]);

  // ─────────────────────────────────────────
  // Banner tap
  // ─────────────────────────────────────────
  const handleBadgeBannerPress = useCallback(() => {
    setShowBadgeBanner(false);
    setEarnedBadge(null);
    if (navigationRef.isReady()) navigationRef.navigate("Badges");
  }, []);

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <ArrivalContext.Provider value={{ activeSpot, setActiveSpot, clearActiveSpot, allSpots }}>
      {children}

      <Modal visible={showPointsPopup} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
        <View style={styles.pointsOverlay} pointerEvents="box-none">
          <Animated.View
            pointerEvents="none"
            style={[styles.pointsPopup, {
              opacity:   pointsOpacity,
              transform: [{ translateY: pointsTranslateY }, { scale: pointsScale }],
            }]}
          >
            <Text style={styles.pointsEmoji}>🎉</Text>
            <Text style={styles.pointsTitle}>You arrived!</Text>
            <Text style={styles.pointsEarned}>+{String(popupPoints.earned)} Points</Text>
            <Text style={styles.pointsTotal}>Total: {String(popupPoints.total)} pts</Text>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showBadgeBanner && !!earnedBadge} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
        <View style={styles.badgeBackdrop} pointerEvents="box-none">
          <Animated.View
            pointerEvents="auto"
            style={[styles.badgeBanner, {
              opacity:   badgeOpacity,
              transform: [{ translateY: badgeTranslateY }],
            }]}
          >
            <TouchableOpacity onPress={handleBadgeBannerPress} style={styles.bannerTouchable} activeOpacity={0.75}>
              <View style={styles.bannerLeft}>
                {earnedBadge?.image ? (
                  <Image source={{ uri: earnedBadge.image }} style={styles.bannerImage} />
                ) : (
                  <View style={styles.bannerPlaceholder}>
                    <Feather name="award" size={22} color="#8b4440" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerLabel}>🏅 Badge Earned!</Text>
                  <Text style={styles.bannerName} numberOfLines={2}>{String(earnedBadge?.name ?? "")}</Text>
                  <Text style={styles.bannerSub}>Tap to view · Auto-dismiss in 5s</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </ArrivalContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  pointsOverlay: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: 110 },
  pointsPopup: {
    backgroundColor: "#fff", borderRadius: 24, paddingVertical: 22, paddingHorizontal: 40,
    alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 25, borderWidth: 2, borderColor: "#f4c542", minWidth: 200,
  },
  pointsEmoji:  { fontSize: 38, marginBottom: 6 },
  pointsTitle:  { fontSize: 18, fontWeight: "700", color: "#4a4a4a", marginBottom: 4 },
  pointsEarned: { fontSize: 28, fontWeight: "800", color: "#8b4440", marginBottom: 2 },
  pointsTotal:  { fontSize: 13, color: "#6a5a5a", fontWeight: "500" },

  badgeBackdrop: { flex: 1, pointerEvents: "none" },
  badgeBanner: {
    marginTop: Platform.OS === "ios" ? 55 : 40, marginHorizontal: 16, backgroundColor: "#fff",
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row",
    alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 25, borderWidth: 1.5, borderColor: "#f4c542",
  },
  bannerTouchable:   { flex: 1, flexDirection: "row" },
  bannerLeft:        { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  bannerImage:       { width: 46, height: 46, borderRadius: 23, resizeMode: "cover" },
  bannerPlaceholder: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#fce8e6", justifyContent: "center", alignItems: "center" },
  bannerLabel:       { fontSize: 11, color: "#8b4440", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  bannerName:        { fontSize: 14, color: "#4a2e2c", fontWeight: "600", marginTop: 2 },
  bannerSub:         { fontSize: 11, color: "#b0908c", marginTop: 3, fontWeight: "500" },
});