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
  Linking,
} from "react-native";
import * as Location from "expo-location";
import { showAlert } from "../components/AppAlert";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, useUser } from "@clerk/clerk-expo";
import Icon from "../components/Icon";
import { navigationRef } from "../navigation/navigationRef";
import { useTheme, fonts } from "./ThemeContext";
import { BASE_URL } from "../api";
import { badgeImage } from "../utils/image";
import { evaluateFix, watchTierFor } from "../utils/arrivalEngine";
import { usePoints } from "./PointsContext";

// Single source of truth for the backend host — see api.js.
const ARRIVAL_RADIUS_METERS    = 50;
const ACTIVE_SPOT_KEY          = "activeSpot";
const ALL_SPOTS_KEY            = "allSpots";
const SPOTS_CACHE_TTL_MS       = 5 * 60 * 1000;
const BACKGROUND_LOCATION_TASK = "background-location-task";

// Background arrivals: arrival alerts while Libot is closed, via the
// background task below, plus the "Allow all the time" prompt that asks for
// the permission it needs. ON.
//
// It depends on native config in app.json: ACCESS_BACKGROUND_LOCATION and
// FOREGROUND_SERVICE(_LOCATION) in `permissions`, and
// isAndroidBackgroundLocationEnabled / isAndroidForegroundServiceEnabled set
// to true. Changing those needs a new build, not just a JS reload. Google
// Play reviews background location strictly: the Play Console asks for a
// permission declaration and a short demo video before release.
//
// Set this to false for a foreground-only build (arrivals only while the app
// is open). Block those permissions in app.json too, and update the backend's
// /help page, which describes the current behaviour.
const BACKGROUND_ARRIVALS_ENABLED = true;

// Persisted set of spotIds the user is CURRENTLY inside (per user).
// Both the foreground watcher and the background task read/write this same
// key, so an arrival only notifies once per "stay" — the user must leave
// the radius (which clears the spot from this set) before arriving again
// will notify a second time. This survives app restarts, unlike an
// in-memory Set, which is what previously caused re-notification on reopen.
const INSIDE_SPOTS_KEY_PREFIX  = "insideSpots_";

// First visits whose rewards haven't reached the server yet (per user).
// Arriving with no signal — common at rural spots — used to lose the points,
// visit log and badge for good: the spot is marked visited locally before the
// requests go out, so it was never tried again. Now it stays here until the
// server has answered, and is replayed later. Replaying is safe because the
// server pays each reward once per user and spot however often it's asked.
const PENDING_REWARDS_KEY_PREFIX = "pendingRewards_";
const RETRY_PENDING_EVERY_MS     = 30_000;

async function readPendingRewards(userId) {
  try {
    const raw = await AsyncStorage.getItem(`${PENDING_REWARDS_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
async function updatePendingRewards(userId, change) {
  const next = change(await readPendingRewards(userId));
  try { await AsyncStorage.setItem(`${PENDING_REWARDS_KEY_PREFIX}${userId}`, JSON.stringify(next)); } catch {}
}
// An entry is { spotId, lat, lng }: the arrival with where the phone was, which
// POST /api/arrivals checks. Builds up to 1.1.1 queued bare spotIds.
const pendingSpotId       = (entry) => (typeof entry === "string" ? entry : entry?.spotId);
const addPendingReward    = (userId, entry) => updatePendingRewards(userId, (l) => (l.some((e) => pendingSpotId(e) === entry.spotId) ? l : [...l, entry]));
const removePendingReward = (userId, spotId) => updatePendingRewards(userId, (l) => l.filter((e) => pendingSpotId(e) !== spotId));

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
    const currentUserId = await AsyncStorage.getItem("currentUserId");
    if (!currentUserId) return;

    const spotsJson = await AsyncStorage.getItem(ALL_SPOTS_KEY);
    const spots     = spotsJson ? JSON.parse(spotsJson) : [];

    const insideKey  = `${INSIDE_SPOTS_KEY_PREFIX}${currentUserId}`;
    const insideRaw  = await AsyncStorage.getItem(insideKey);
    const insideSet  = new Set(insideRaw ? JSON.parse(insideRaw) : []);

    const cacheKey   = `claimedSpotIds_${currentUserId}`;
    const claimedRaw = await AsyncStorage.getItem(cacheKey);
    const claimed    = claimedRaw ? JSON.parse(claimedRaw) : [];

    let changed = false;

    for (const spot of spots) {
      const spotId = String(spot._id ?? "").trim();
      if (!spotId) continue;

      const dest = getSpotCoords(spot);
      if (!dest) continue;

      const dist      = getDistanceMeters(coords.latitude, coords.longitude, dest.lat, dest.lng);
      const isInside   = dist <= ARRIVAL_RADIUS_METERS;
      const wasInside  = insideSet.has(spotId);

      if (isInside && !wasInside) {
        // Just entered the radius — notify, and queue the arrival with this
        // position; the app delivers it to POST /api/arrivals the next time
        // it's opened (flushPendingRewards). Without this the badge the
        // notification promises never came: the app found the spot already
        // marked "inside" and treated it as no arrival at all.
        insideSet.add(spotId);
        changed = true;
        await addPendingReward(currentUserId, { spotId, lat: coords.latitude, lng: coords.longitude });

        const isFirstVisit = !claimed.includes(spotId);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: isFirstVisit ? "You arrived!" : "Welcome back!",
            body: isFirstVisit
              ? `You've reached ${spot.name}! Open Libot Bulacan to claim your badge.`
              : `You've arrived at ${spot.name}. Open Libot Bulacan to explore!`,
            data: { spotId, spotName: spot.name, isFirstVisit },
          },
          trigger: null,
        });

        console.log(
          isFirstVisit
            ? `[BG Arrival] First visit at: ${spot.name}`
            : `[BG Arrival] Return visit at: ${spot.name}`
        );
      } else if (!isInside && wasInside) {
        // Left the radius — clear so the next arrival notifies again.
        insideSet.delete(spotId);
        changed = true;
        console.log(`[BG Arrival] Left: ${spot.name}`);
      }
    }

    if (changed) {
      await AsyncStorage.setItem(insideKey, JSON.stringify([...insideSet]));
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
        shouldShowBanner: true,
        shouldPlaySound:  true,
        shouldSetBadge:   true,
      }),
    });

    console.log("[Notifications] Configured");
  } catch (e) {
    console.error("[Notifications] Setup error:", e);
  }
}

// ─────────────────────────────────────────────
// Request location permissions in correct order
// ─────────────────────────────────────────────

// Promise-wrapped themed confirm dialog (AppAlert has no promise API of its own).
function confirmAsync(title, message, opts = {}) {
  const { confirmText = "Continue", cancelText = "Not now", tone = "info", icon } = opts;
  return new Promise((resolve) => {
    showAlert(
      title, message,
      [
        { text: cancelText, style: "cancel", onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ],
      { tone, icon, cancelable: false },
    );
  });
}

async function requestAllLocationPermissions() {
  const current = await Location.getForegroundPermissionsAsync();

  // First-time ask -> show a short Libot-branded rationale BEFORE the OS dialog
  // (better grant rates, and the OS "Precise / While using the app / …" sheet
  // makes more sense once the user knows why).
  if (current.status !== "granted" && current.canAskAgain) {
    const proceed = await confirmAsync(
      "Libot Bulacan uses your location",
      BACKGROUND_ARRIVALS_ENABLED
        ? "To show spots near you, log the places you visit, and send arrival alerts. You'll pick a permission level on the next screen."
        : "To show spots near you and recognise when you arrive at one while Libot Bulacan is open. Libot Bulacan doesn't use your location when the app is closed.",
      { confirmText: "Continue", icon: "map-pin", tone: "info" },
    );
    if (!proceed) {
      console.warn("[Location] User declined the rationale");
      return { foreground: false, background: false };
    }
  }

  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== "granted") {
    console.warn("[Location] Foreground permission denied");
    return { foreground: false, background: false };
  }

  if (!BACKGROUND_ARRIVALS_ENABLED) {
    return { foreground: true, background: false };
  }

  // Background access is only CHECKED here. Requesting it on Android 11+
  // jumps straight to the system's location-permission screen, so it's asked
  // for in promptForAllTimeLocation, after a modal explains why.
  let bg = "denied";
  try {
    ({ status: bg } = await Location.getBackgroundPermissionsAsync());
  } catch (_) {}
  if (bg !== "granted") {
    console.log("[Location] Foreground granted; background not (yet)");
    return { foreground: true, background: false };
  }

  console.log("[Location] Foreground + background permissions granted");
  return { foreground: true, background: true };
}

// Asks for "Allow all the time" when Libot only has "while using the app".
// The modal comes FIRST, then the system screen: on Android 11+ the request
// itself opens Libot's location-permission page in Settings, and Google Play
// requires this disclosure before a background-location request. "Continue"
// opens that page, where the user picks "Allow all the time"; "Not now"
// leaves it. If Android won't show its page any more (asked and refused
// twice), a second modal offers Libot's Settings page instead. At most once
// per 12 h. Resolves true if background access was granted.
const ALLTIME_PROMPT_KEY  = "alltimeLocationPromptAt";
const ALLTIME_PROMPT_EVERY = 12 * 60 * 60 * 1000; // at most once per 12h

async function promptForAllTimeLocation() {
  if (Platform.OS !== "android") return false; // iOS shows its own "Always Allow" prompt
  try {
    const last = Number(await AsyncStorage.getItem(ALLTIME_PROMPT_KEY)) || 0;
    if (Date.now() - last < ALLTIME_PROMPT_EVERY) return false;
    await AsyncStorage.setItem(ALLTIME_PROMPT_KEY, String(Date.now()));
  } catch (_) {}

  const proceed = await confirmAsync(
    "Background location access needed",
    `For a better experience, Libot Bulacan needs access to your location in the background — even when the app is closed or not in use — so it can alert you when you arrive at a tourist spot and log your visit. On the next screen, choose "Allow all the time".`,
    { confirmText: "Continue", cancelText: "Not now", icon: "map-pin", tone: "info" },
  );
  if (!proceed) return false;

  try {
    const res = await Location.requestBackgroundPermissionsAsync();
    if (res.status === "granted") {
      console.log("[Location] Background permission granted");
      return true;
    }
    if (res.canAskAgain === false) {
      const openSettings = await confirmAsync(
        "Background location access needed",
        `For a better experience, turn it on in Settings: Permissions > Location > "Allow all the time".`,
        { confirmText: "Go to Settings", cancelText: "Not now", icon: "map-pin", tone: "info" },
      );
      if (openSettings) Linking.openSettings();
    }
  } catch (e) {
    console.warn("[Location] Background permission request failed:", e?.message);
  }
  return false;
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────
const ArrivalContext = createContext({
  activeSpot:      null,
  setActiveSpot:   () => {},
  clearActiveSpot: () => {},
  allSpots:        [],
  spotsStatus:     "loading",
  reloadSpots:     () => {},
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
  // After a visit is logged, re-read points + visited spots so the Home pill
  // and the "Arrive at the spot" major mission update without a screen change.
  // A ref, so the long-lived arrival callbacks never hold a stale copy.
  const { refresh: refreshPoints } = usePoints();
  const refreshPointsRef = useRef(refreshPoints);
  refreshPointsRef.current = refreshPoints;
  const { user: clerkUser }      = useUser();
  const { colors }               = useTheme();

  const [activeSpot, setActiveSpotState] = useState(null);
  const [allSpots, setAllSpots]          = useState([]);
  // "loading" | "ready" | "error". An empty `allSpots` alone can't tell a
  // screen whether to show a skeleton or a retry — it's empty in both cases.
  const [spotsStatus, setSpotsStatus]    = useState("loading");
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
  const activeSpotRef    = useRef(null);
  const currentUserIdRef = useRef(null);
  const appStateRef      = useRef(AppState.currentState);
  const bgTrackingLock   = useRef(false);
  const appStateDebounce = useRef(null);
  const hasLocationPerms = useRef({ foreground: false, background: false });

  // In-memory mirror of INSIDE_SPOTS_KEY_PREFIX for the current user.
  // A spotId is in this set exactly while the user is currently within
  // ARRIVAL_RADIUS_METERS of it. Entering (not in set -> in set) triggers
  // a notification; leaving (in set -> not in set) clears it silently so
  // the *next* arrival notifies again.
  const insideSpotsRef = useRef(new Set());
  // Spots with an arrival awaiting a confirming fix (utils/arrivalEngine.js).
  const arrivalPendingRef = useRef(new Map());
  // Replays rewards that never reached the server (see PENDING_REWARDS).
  const flushPendingRef   = useRef(null);
  const lastFlushAtRef    = useRef(0);

  useEffect(() => { activeSpotRef.current = activeSpot; }, [activeSpot]);

  // ─────────────────────────────────────────
  // Sync claimedSpotIds cache from backend on sign-in.
  // This ensures the local cache always reflects what the DB actually has,
  // so clearing DB records also clears the effective "already visited" state.
  // ─────────────────────────────────────────
  const syncClaimedCache = useCallback(async (userId, token) => {
    try {
      // NOTE: this used to call /api/users/claimed-spots, which was never
      // implemented on the backend — it 404'd on every sign-in, so the local
      // "already claimed" cache was never actually reconciled with the DB.
      // /api/users/visitedSpots is the real endpoint and already returns the
      // exact shape expected here: { success, spotIds } from awardedSpotIds.
      const res  = await fetch(`${BASE_URL}/api/users/visitedSpots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.warn("[Cache Sync] Failed, status:", res.status);
        return;
      }
      const data = await safeJson(res);
      if (Array.isArray(data?.spotIds)) {
        const cacheKey = `claimedSpotIds_${userId}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data.spotIds));
        console.log("[Cache Sync] Synced", data.spotIds.length, "claimed spots from backend");
      }
    } catch (e) {
      console.warn("[Cache Sync] Error:", e.message);
    }
  }, []);

  // ─────────────────────────────────────────
  // Load / persist the "currently inside" set for a given user.
  // Reload is also called whenever the app returns to foreground, in case
  // the background task updated it while this provider was inactive.
  // ─────────────────────────────────────────
  const loadInsideSpots = useCallback(async (userId) => {
    try {
      const raw = await AsyncStorage.getItem(`${INSIDE_SPOTS_KEY_PREFIX}${userId}`);
      insideSpotsRef.current = new Set(raw ? JSON.parse(raw) : []);
    } catch (_) {
      insideSpotsRef.current = new Set();
    }
  }, []);

  const persistInsideSpots = useCallback(() => {
    const userId = currentUserIdRef.current;
    if (!userId) return;
    AsyncStorage.setItem(
      `${INSIDE_SPOTS_KEY_PREFIX}${userId}`,
      JSON.stringify([...insideSpotsRef.current])
    ).catch(() => {});
  }, []);

  // ─────────────────────────────────────────
  // 1. On sign-in: request permissions + setup notifs + sync cache
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;

    const init = async () => {
      await setupNotifications();
      const perms = await requestAllLocationPermissions();
      hasLocationPerms.current = perms;
      // Only ask for "all the time" when they've granted foreground but not
      // background — don't stack a second modal on top of a fresh "Not now".
      // Not awaited: the rest of sign-in shouldn't wait on the user reading it.
      if (BACKGROUND_ARRIVALS_ENABLED && perms.foreground && !perms.background) {
        promptForAllTimeLocation().then((granted) => {
          if (granted) hasLocationPerms.current = { foreground: true, background: true };
        });
      }
      if (!BACKGROUND_ARRIVALS_ENABLED) {
        // A build that had background arrivals may have left the task
        // registered; stop it so an update can't keep tracking in the background.
        Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
          .then((running) => running && Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK))
          .catch(() => {});
      }

      // Sync cache so local state matches DB
      const token  = await getToken();
      const userId = clerkUser?.id;
      if (token && userId) {
        await syncClaimedCache(userId, token);
        flushPendingRef.current?.(); // rewards earned offline last session
        await loadInsideSpots(userId);
      }
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
  // 2. AppState -> start/stop background tracking
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;

    const handleAppStateChange = (nextState) => {
      if (appStateDebounce.current) clearTimeout(appStateDebounce.current);

      appStateDebounce.current = setTimeout(async () => {
        const prevState = appStateRef.current;

        if (
          BACKGROUND_ARRIVALS_ENABLED &&
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
                  notificationTitle: "Libot Bulacan is tracking your location",
                  notificationBody:  "Detecting nearby tourist spots in Bulacan.",
                  notificationColor: "#0A6F78", // lightColors.brand
                },
              });
              console.log("[Location] Background tracking started");
            }
          } catch (e) {
            console.warn("[Location] Could not start background tracking:", e.message);
          } finally {
            bgTrackingLock.current = false;
          }
        }

        if (nextState === "active" && prevState !== "active") {
          // Reload from storage in case the background task changed the
          // "inside" set while this provider wasn't running.
          if (currentUserIdRef.current) {
            await loadInsideSpots(currentUserIdRef.current);
          }

          // "Allow all the time" may have been switched on in Settings
          // meanwhile (e.g. just now, from the prompt) — pick it up so
          // background tracking starts the next time the app is closed.
          if (BACKGROUND_ARRIVALS_ENABLED && hasLocationPerms.current.foreground) {
            Location.getBackgroundPermissionsAsync()
              .then(({ status }) => {
                hasLocationPerms.current = { ...hasLocationPerms.current, background: status === "granted" };
              })
              .catch(() => {});
          }

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
  }, [isSignedIn, loadInsideSpots]);

  // ─────────────────────────────────────────
  // Reset on user change
  // ─────────────────────────────────────────
  useEffect(() => {
    const newUserId = clerkUser?.id ?? null;
    if (newUserId === currentUserIdRef.current) return;

    console.log("[Arrival] User changed:", currentUserIdRef.current, "->", newUserId);

    if (newUserId) AsyncStorage.setItem("currentUserId", newUserId);

    insideSpotsRef.current   = new Set();
    arrivalPendingRef.current = new Map();
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

    // Nothing on screen yet: show the spots saved last time straight away and
    // refresh them below. The saved copy used to be read only after the
    // request failed — on a sleeping server, up to a minute of skeletons first.
    if (allSpotsRef.current.length === 0) {
      let saved = null;
      try {
        const raw = await AsyncStorage.getItem(ALL_SPOTS_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch (_) {}
      if (Array.isArray(saved) && saved.length > 0 && allSpotsRef.current.length === 0) {
        allSpotsRef.current = saved;
        setAllSpots(saved);
        setSpotsStatus("ready");
      } else {
        setSpotsStatus("loading");
      }
    }
    try {
      const res  = await fetch(`${BASE_URL}/api/spots`);
      const data = await safeJson(res);
      if (data?.success && Array.isArray(data.spots)) {
        const spots = data.spots;
        allSpotsRef.current    = spots;
        spotsFetchedAt.current = now;
        setAllSpots(spots);
        setSpotsStatus("ready");
        await AsyncStorage.setItem(ALL_SPOTS_KEY, JSON.stringify(spots));
        console.log("[Arrival] Loaded", spots.length, "spots");
      } else {
        throw new Error(`Unexpected /api/spots response (${res.status})`);
      }
    } catch (e) {
      // The saved spots (if any) are already showing; keep them.
      console.warn("[Arrival] Could not fetch spots:", e.message);
      if (allSpotsRef.current.length === 0) setSpotsStatus("error");
    }
  }, []);

  useEffect(() => { if (isSignedIn) fetchAllSpots(); }, [isSignedIn, fetchAllSpots]);

  // For a retry button: skip the cache TTL and ask the server again.
  const reloadSpots = useCallback(() => {
    spotsFetchedAt.current = 0;
    return fetchAllSpots();
  }, [fetchAllSpots]);

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

  // The popups' timers, cleared when the provider goes away (signing out), so
  // none of them fires into an unmounted tree.
  // (An animation can finish after that and ask for a new one: refused.)
  const timersRef = useRef(new Set());
  const unmountedRef = useRef(false);
  const later = useCallback((fn, ms) => {
    if (unmountedRef.current) return;
    const id = setTimeout(() => { timersRef.current.delete(id); fn(); }, ms);
    timersRef.current.add(id);
  }, []);
  useEffect(() => {
    const timers = timersRef.current;
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

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
      later(() => {
        Animated.parallel([
          Animated.timing(pointsOpacity,    { toValue: 0,    duration: 350, useNativeDriver: true }),
          Animated.timing(pointsTranslateY, { toValue: -30,  duration: 350, useNativeDriver: true }),
          Animated.timing(pointsScale,      { toValue: 0.85, duration: 350, useNativeDriver: true }),
        ]).start(() => setShowPointsPopup(false));
      }, 2600);
    });
  }, [pointsOpacity, pointsTranslateY, pointsScale, later]);

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
      later(() => {
        Animated.parallel([
          Animated.timing(badgeTranslateY, { toValue: -200, duration: 350, useNativeDriver: true }),
          Animated.timing(badgeOpacity,    { toValue: 0,    duration: 350, useNativeDriver: true }),
        ]).start(() => { setShowBadgeBanner(false); setEarnedBadge(null); });
      }, 5000);
    });
  }, [badgeTranslateY, badgeOpacity, later]);

  // ─────────────────────────────────────────
  // Award rewards (foreground)
  // Called only when checkArrival detects a fresh outside->inside
  // transition, so no extra dedupe guard is needed in here.
  //
  // One request, POST /api/arrivals, with where the phone was: the server
  // checks it's at the spot, then counts the visit, pays the first-visit
  // points, logs the visit and gives the badge, each once. This used to be
  // four requests that only sent the spotId — the server had to take the
  // app's word for the arrival, and so did anyone calling the API by hand.
  // ─────────────────────────────────────────

  // Resolves the server's answer, or null when there wasn't a usable one (a
  // server error) and the arrival should stay queued. Throws when the request
  // can't get out at all (no signal), like fetch.
  const postArrival = useCallback(async ({ spotId, lat, lng }) => {
    const token = await getToken();
    if (!token) return null;
    const res = await fetch(`${BASE_URL}/api/arrivals`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ spotId, lat, lng }),
    });
    if (res.status >= 500) return null;
    return (await safeJson(res)) ?? {};
  }, [getToken]);

  const awardRewards = useCallback(async (spot, fix) => {
    const spotId = String(spot._id ?? "").trim();
    if (!spotId) return;

    console.log("[Arrival] Arrived at:", spot.name, "| spotId:", spotId);

    const userId    = currentUserIdRef.current;
    const cacheKey  = `claimedSpotIds_${userId}`;
    const cachedRaw = await AsyncStorage.getItem(cacheKey);
    const cachedIds = cachedRaw ? JSON.parse(cachedRaw) : [];

    // Kept until the server has answered — crash- and signal-safe; see
    // PENDING_REWARDS. Saved with the position, which is what the server checks.
    const arrival = { spotId, lat: fix.latitude, lng: fix.longitude };
    await addPendingReward(userId, arrival);

    let result = null;
    try { result = await postArrival(arrival); }
    catch (e) { console.warn("[Arrival] Offline — saved for later:", e?.message); }
    if (result) await removePendingReward(userId, spotId);

    // The server refused it: the position it got isn't at the spot (a GPS
    // jump, or the spot's pin moved). Nothing was paid, so say nothing.
    if (result && !result.recorded) {
      console.log("[Arrival] Not recorded:", result.tooFar ? `${result.distance} m away` : result.message ?? "no pin");
      return;
    }

    // First visit or return: the server's answer, or offline, the saved copy
    // of it (synced from GET /api/users/visitedSpots at sign-in).
    const isFirstVisit = result ? !!result.firstVisit : !cachedIds.includes(spotId);
    console.log("[Arrival] isFirstVisit:", isFirstVisit, "| spotId:", spotId);
    if (!cachedIds.includes(spotId)) {
      await AsyncStorage.setItem(cacheKey, JSON.stringify([...cachedIds, spotId]));
    }

    const pointsJustEarned = (result?.pointsEarned ?? 0) > 0;
    if (result) {
      if (pointsJustEarned) {
        await AsyncStorage.setItem("userPoints", String(result.points));
        triggerPointsPopup(result.pointsEarned, result.points);
      }
      refreshPointsRef.current?.();
    }

    // ── Notification (every fresh arrival) ─────────────────────────────────
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isFirstVisit ? "You arrived!" : "Welcome back!",
        body: isFirstVisit
          ? `You've reached ${spot.name}! Open Libot Bulacan to claim your badge.`
          : `You've arrived at ${spot.name}. Open Libot Bulacan to explore!`,
        data: { spotId, spotName: spot.name, isFirstVisit },
      },
      trigger: null,
    });

    // ── Badge (first visit only; the server gives it once) ─────────────────
    const badge = result?.badge;
    if (badge?.claimed && !badge.alreadyOwned) {
      console.log("[Badge] Claimed:", badge.claimed.name);
      later(() => triggerBadgeBanner(badge.claimed), pointsJustEarned ? 1500 : 0);
    }
  }, [postArrival, triggerPointsPopup, triggerBadgeBanner, later]);

  // ─────────────────────────────────────────
  // Replay arrivals that never reached the server
  // Each leaves the list once the server has answered; no signal keeps it
  // for the next attempt. Runs quietly — the points show up in the profile.
  // Arrivals queued by builds up to 1.1.1 are bare spotIds with no position;
  // those go through the old one-reward-per-call routes, which the server
  // keeps for those builds (and which simply answer 404 once removed).
  // ─────────────────────────────────────────
  const flushingRef = useRef(false);
  const flushPendingRewards = useCallback(async () => {
    const userId = currentUserIdRef.current;
    if (!userId || flushingRef.current) return;
    flushingRef.current = true;
    lastFlushAtRef.current = Date.now();
    let delivered = 0;
    try {
      const pending = await readPendingRewards(userId);
      for (const entry of pending) {
        try {
          const token = await getToken();
          if (!token) return;
          if (typeof entry === "string") {
            const call = async (method, path, body) => {
              const res = await fetch(`${BASE_URL}${path}`, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                ...(body ? { body: JSON.stringify(body) } : {}),
              });
              return res.status < 500;
            };
            const answered = [
              await call("PATCH", `/api/spots/${entry}/visit`),
              await call("PATCH", "/api/users/points", { spotId: entry }),
              await call("POST",  "/api/visitlogs", { spotId: entry }),
              await call("PATCH", "/api/users/badges", { spotId: entry }),
            ];
            if (!answered.every(Boolean)) continue;
          } else if (!(await postArrival(entry))) {
            continue;
          }
          await removePendingReward(userId, pendingSpotId(entry));
          delivered++;
          console.log("[Rewards] Delivered offline visit:", pendingSpotId(entry));
        } catch {
          return; // still offline — try again later
        }
      }
    } finally {
      flushingRef.current = false;
      if (delivered) refreshPointsRef.current?.();
    }
  }, [getToken, postArrival]);
  useEffect(() => { flushPendingRef.current = flushPendingRewards; }, [flushPendingRewards]);

  // …and whenever the app comes back to the foreground.
  useEffect(() => {
    if (!isSignedIn) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") flushPendingRef.current?.();
    });
    return () => sub.remove();
  }, [isSignedIn]);

  // ─────────────────────────────────────────
  // Foreground location watcher
  // The rules — hysteresis at the radius, ignoring vague fixes, confirming an
  // arrival — live in utils/arrivalEngine.js, where they are unit-tested.
  // Only an arrival triggers awardRewards/notification.
  // ─────────────────────────────────────────

  // Returns the distance to the nearest spot, which sets the GPS rate.
  const checkArrival = useCallback((fix) => {
    const byId = new Map();
    const targets = [];
    for (const spot of allSpotsRef.current) {
      const id = String(spot._id ?? "").trim();
      const dest = id && getSpotCoords(spot);
      if (!dest) continue;
      byId.set(id, spot);
      targets.push({ id, lat: dest.lat, lng: dest.lng });
    }

    // evaluateFix updates insideSpotsRef's Set in place — the entry is marked
    // synchronously *before* awarding, so a rapid second fix (or reopening
    // the app a moment later) can't double-trigger.
    const state = { inside: insideSpotsRef.current, pending: arrivalPendingRef.current };
    const { entered, left, nearestM } = evaluateFix(state, fix, targets);

    for (const id of entered) awardRewards(byId.get(id), fix);
    for (const id of left) console.log("[Arrival] Left:", byId.get(id)?.name);
    if (entered.length || left.length) persistInsideSpots();
    return nearestM;
  }, [awardRewards, persistInsideSpots]);

  // The watcher calls through a ref, so a new checkArrival (awardRewards
  // changes whenever Clerk's getToken does) no longer tears down and restarts
  // the GPS watch.
  const checkArrivalRef = useRef(checkArrival);
  useEffect(() => { checkArrivalRef.current = checkArrival; }, [checkArrival]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    let tier = null;
    let switching = false;

    // GPS effort follows the distance to the nearest spot (arrivalEngine's
    // watchTierFor): full rate within 400 m, relaxed within 2.5 km, and a
    // low-power network fix beyond that — where most time is spent.
    const watchWith = async (next) => {
      locationSub.current?.remove();
      locationSub.current = null;
      tier = next;
      const sub = await Location.watchPositionAsync(
        {
          accuracy: next.accuracy === "high" ? Location.Accuracy.High : Location.Accuracy.Balanced,
          timeInterval: next.timeInterval,
          distanceInterval: next.distanceInterval,
        },
        onFix,
      );
      if (cancelled) { sub.remove(); return; }
      locationSub.current = sub;
      console.log(`[Location] Arrival watch: ${next.key} (${next.timeInterval / 1000}s / ${next.distanceInterval}m)`);
    };

    function onFix(loc) {
      if (cancelled) return;
      const nearestM = checkArrivalRef.current({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      });
      // A fix proves location works; if rewards are waiting, try the network too.
      if (Date.now() - lastFlushAtRef.current > RETRY_PENDING_EVERY_MS) flushPendingRef.current?.();
      const next = watchTierFor(nearestM, tier?.key);
      if (next.key !== tier?.key && !switching) {
        switching = true;
        watchWith(next).finally(() => { switching = false; });
      }
    }

    const start = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;
      // Distance unknown until the first fix, so start in the middle tier.
      await watchWith(watchTierFor(null));
    };

    start();
    return () => {
      cancelled = true;
      locationSub.current?.remove();
      locationSub.current = null;
    };
  }, [isSignedIn]);

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
    <ArrivalContext.Provider value={{ activeSpot, setActiveSpot, clearActiveSpot, allSpots, spotsStatus, reloadSpots }}>
      {children}

      <Modal visible={showPointsPopup} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
        <View style={styles.pointsOverlay} pointerEvents="box-none">
          <Animated.View
            pointerEvents="none"
            style={[styles.pointsPopup, {
              backgroundColor: colors.card,
              borderColor: colors.accent,
              opacity:   pointsOpacity,
              transform: [{ translateY: pointsTranslateY }, { scale: pointsScale }],
            }]}
          >
            <Icon name="award" size={34} color={colors.accent} style={styles.pointsIcon} />
            <Text style={[styles.pointsTitle, { color: colors.textSecondary }]}>You arrived!</Text>
            <Text style={[styles.pointsEarned, { color: colors.brand }]}>+{String(popupPoints.earned)} Points</Text>
            <Text style={[styles.pointsTotal, { color: colors.textMuted }]}>Total: {String(popupPoints.total)} pts</Text>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showBadgeBanner && !!earnedBadge} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
        <View style={styles.badgeBackdrop} pointerEvents="box-none">
          <Animated.View
            pointerEvents="auto"
            style={[styles.badgeBanner, {
              backgroundColor: colors.card,
              borderColor: colors.accent,
              opacity:   badgeOpacity,
              transform: [{ translateY: badgeTranslateY }],
            }]}
          >
            <TouchableOpacity onPress={handleBadgeBannerPress} style={styles.bannerTouchable} activeOpacity={0.75}>
              <View style={styles.bannerLeft}>
                {earnedBadge?.image ? (
                  <Image source={{ uri: badgeImage(earnedBadge.image, 64) }} style={styles.bannerImage} />
                ) : (
                  <View style={[styles.bannerPlaceholder, { backgroundColor: colors.brandSoft }]}>
                    <Icon name="award" size={22} color={colors.brand} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerLabel, { color: colors.brand }]}>Badge Earned!</Text>
                  <Text style={[styles.bannerName, { color: colors.brandDark }]} numberOfLines={2}>{String(earnedBadge?.name ?? "")}</Text>
                  <Text style={[styles.bannerSub, { color: colors.textMuted }]}>Tap to view · Auto-dismiss in 5s</Text>
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
// Colours come from the theme inline in the JSX above; these are layout only.
const styles = StyleSheet.create({
  pointsOverlay: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: 110 },
  pointsPopup: {
    borderRadius: 24, paddingVertical: 22, paddingHorizontal: 40,
    alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 25, borderWidth: 2, minWidth: 200,
  },
  pointsIcon:   { marginBottom: 6 },
  pointsTitle:  { fontFamily: fonts.sansBold, fontSize: 18, marginBottom: 4 },
  pointsEarned: { fontFamily: fonts.display, fontSize: 28, marginBottom: 2 },
  pointsTotal:  { fontFamily: fonts.sansMedium, fontSize: 13 },

  badgeBackdrop: { flex: 1, pointerEvents: "none" },
  badgeBanner: {
    marginTop: Platform.OS === "ios" ? 55 : 40, marginHorizontal: 16,
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row",
    alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 25, borderWidth: 1.5,
  },
  bannerTouchable:   { flex: 1, flexDirection: "row" },
  bannerLeft:        { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  bannerImage:       { width: 46, height: 46, borderRadius: 23, resizeMode: "cover" },
  bannerPlaceholder: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  bannerLabel:       { fontFamily: fonts.sansBold, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  bannerName:        { fontFamily: fonts.sansSemi, fontSize: 14, marginTop: 2 },
  bannerSub:         { fontFamily: fonts.sansMedium, fontSize: 11, marginTop: 3 },
});