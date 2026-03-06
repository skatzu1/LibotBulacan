import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";
import { ALL_BADGES } from "./BadgeScreen";

const { width, height } = Dimensions.get("window");

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

export default function Track({ route, navigation }) {
  const { spot } = route.params;
  const { getToken } = useAuth();

  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spotData, setSpotData] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [followMode, setFollowMode] = useState(false);

  const [hasArrived, setHasArrived] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);

  // Points popup animations
  const [showPointsPopup, setShowPointsPopup] = useState(false);
  const pointsOpacity = useRef(new Animated.Value(0)).current;
  const pointsTranslateY = useRef(new Animated.Value(40)).current;
  const pointsScale = useRef(new Animated.Value(0.8)).current;

  // Badge banner animation
  const [pendingBadge, setPendingBadge] = useState(null);
  const [showBadgeBanner, setShowBadgeBanner] = useState(false);
  const badgeTranslateY = useRef(new Animated.Value(-160)).current;

  const webViewRef = useRef(null);
  const locationSubscription = useRef(null);
  const isMounted = useRef(true);

  /* =========================================================
     LOAD POINTS FROM MONGODB ON MOUNT
     Fetches the user's current points from the backend so
     the header badge always shows the real DB value.
  ========================================================= */
  useEffect(() => {
    const loadPointsFromDB = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BASE_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const dbPoints = data?.user?.points ?? data?.points ?? null;
          if (typeof dbPoints === "number") {
            setTotalPoints(dbPoints);
            // Keep AsyncStorage in sync
            await AsyncStorage.setItem("userPoints", String(dbPoints));
            return;
          }
        }
      } catch (_) {}

      // Fallback to AsyncStorage if backend unavailable
      const stored = await AsyncStorage.getItem("userPoints").catch(() => null);
      if (stored !== null) setTotalPoints(parseInt(stored, 10));
    };

    loadPointsFromDB();
  }, []);

  /* =========================================================
     AWARD POINTS — saves to MongoDB via PATCH /api/users/points
     Falls back to AsyncStorage-only if request fails.
  ========================================================= */
  const savePointsToDB = useCallback(async (spotId) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users/points`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ spotId }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (data.success) {
        // Sync AsyncStorage with DB value
        await AsyncStorage.setItem("userPoints", String(data.points));
        return data; // { success, alreadyAwarded, points }
      }
      return null;
    } catch (e) {
      console.warn("savePointsToDB error:", e);
      return null;
    }
  }, [getToken]);

  /* =========================================================
     POINTS POPUP
  ========================================================= */
  const triggerPointsPopup = useCallback((newTotal) => {
    setTotalPoints(newTotal);
    pointsOpacity.setValue(0);
    pointsTranslateY.setValue(40);
    pointsScale.setValue(0.8);
    setShowPointsPopup(true);

    Animated.parallel([
      Animated.timing(pointsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(pointsTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(pointsScale, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(pointsOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(pointsTranslateY, { toValue: -20, duration: 300, useNativeDriver: true }),
        ]).start(() => setShowPointsPopup(false));
      }, 2400);
    });
  }, [pointsOpacity, pointsTranslateY, pointsScale]);

  /* =========================================================
     BADGE BANNER
  ========================================================= */
  const triggerBadgeBanner = useCallback((badge) => {
    badgeTranslateY.setValue(-160);
    setPendingBadge(badge);
    setShowBadgeBanner(true);
    Animated.timing(badgeTranslateY, {
      toValue: 0, duration: 350, useNativeDriver: true,
    }).start();
  }, [badgeTranslateY]);

  const dismissBadgeBanner = useCallback(() => {
    Animated.timing(badgeTranslateY, {
      toValue: -160, duration: 280, useNativeDriver: true,
    }).start(() => {
      setShowBadgeBanner(false);
      setPendingBadge(null);
    });
  }, [badgeTranslateY]);

  const claimBadge = useCallback(async () => {
    if (!pendingBadge) return;
    try {
      const raw = await AsyncStorage.getItem("unlockedBadges");
      const ids = raw ? JSON.parse(raw) : [];
      if (!ids.includes(pendingBadge.id)) {
        ids.push(pendingBadge.id);
        await AsyncStorage.setItem("unlockedBadges", JSON.stringify(ids));
      }
    } catch (e) {
      console.warn("Failed to save badge:", e);
    }
    dismissBadgeBanner();
  }, [pendingBadge, dismissBadgeBanner]);

  /* =========================================================
     AWARD REWARDS ON ARRIVAL
     1. PATCH points to MongoDB
     2. Show points popup with updated DB total
     3. Trigger badge banner if spot has a badge
  ========================================================= */
  const awardRewards = useCallback(async () => {
    if (hasArrived) return;
    setHasArrived(true);

    // Save to DB — backend handles duplicate prevention per spotId
    const result = await savePointsToDB(spot._id);

    if (result) {
      if (!result.alreadyAwarded) {
        // Fresh visit — show popup with new total from DB
        triggerPointsPopup(result.points);
      } else {
        // Already visited — just update display silently
        setTotalPoints(result.points);
      }
    } else {
      // Backend unavailable — fall back to local increment
      const stored = await AsyncStorage.getItem("userPoints").catch(() => "0");
      const current = parseInt(stored ?? "0", 10);
      const updated = current + POINTS_PER_VISIT;
      await AsyncStorage.setItem("userPoints", String(updated)).catch(() => {});
      triggerPointsPopup(updated);
    }

    // Badge — only show if not already awarded for this spot
    const matchedBadge = ALL_BADGES.find((b) => b.spotId === spot._id);
    if (matchedBadge) {
      try {
        const raw = await AsyncStorage.getItem("unlockedBadges");
        const ids = raw ? JSON.parse(raw) : [];
        if (!ids.includes(matchedBadge.id)) {
          setTimeout(() => triggerBadgeBanner(matchedBadge), 1400);
        }
      } catch (_) {}
    }
  }, [hasArrived, spot._id, savePointsToDB, triggerPointsPopup, triggerBadgeBanner]);

  /* =========================================================
     FETCH SPOT DATA
  ========================================================= */
  useEffect(() => {
    isMounted.current = true;

    const loadSpot = async () => {
      if (spot?.coordinates?.lat && spot?.coordinates?.lng) {
        setSpotData(spot);
        return;
      }
      try {
        const safeJson = async (res) => {
          const ct = res.headers.get("content-type") ?? "";
          if (!ct.includes("application/json")) return null;
          return res.json();
        };
        let foundSpot = null;
        const singleRes = await fetch(`${BASE_URL}/api/spots/${spot._id}`);
        const singleData = await safeJson(singleRes);
        if (singleData?.success && singleData?.spot) {
          foundSpot = singleData.spot;
        } else {
          const listRes = await fetch(`${BASE_URL}/api/spots`);
          const listData = await safeJson(listRes);
          if (listData?.success && Array.isArray(listData.spots)) {
            foundSpot = listData.spots.find((s) => s._id === spot._id) ?? null;
          }
        }
        if (!isMounted.current) return;
        setSpotData(foundSpot ?? spot);
      } catch {
        if (!isMounted.current) return;
        setSpotData(spot);
      }
    };

    loadSpot();

    return () => {
      isMounted.current = false;
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, [spot._id]);

  /* =========================================================
     LOCATION TRACKING
  ========================================================= */
  useEffect(() => {
    if (!spotData) return;
    let cancelled = false;

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled && isMounted.current) {
            setLocationError("Location permission is required for navigation.");
            setLoading(false);
          }
          return;
        }

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled || !isMounted.current) return;

        const coords = {
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        };
        setUserLocation(coords);
        setLoading(false);
        checkArrival(coords);

        locationSubscription.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 3 },
          (loc) => {
            if (!isMounted.current) return;
            const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(c);
            updateMarkerOnMap(c);
            checkArrival(c);
          }
        );
      } catch {
        if (!cancelled && isMounted.current) {
          setLocationError("Unable to get your location. Please try again.");
          setLoading(false);
        }
      }
    };

    startTracking();
    return () => { cancelled = true; };
  }, [spotData]);

  /* =========================================================
     CHECK ARRIVAL
  ========================================================= */
  const checkArrival = useCallback((coords) => {
  if (!spotData?.coordinates?.lat || !spotData?.coordinates?.lng) return;

  const dist = getDistanceMeters(
    coords.latitude,
    coords.longitude,
    spotData.coordinates.lat,
    spotData.coordinates.lng
  );

  console.log("DISTANCE:", dist);   // 👈 ADD THIS

  if (dist <= ARRIVAL_RADIUS_METERS) {
    console.log("ARRIVED");        // 👈 ADD THIS
    awardRewards();
  }
}, [spotData, awardRewards]);

  /* =========================================================
     MAP UPDATE
  ========================================================= */
  const followModeRef = useRef(followMode);
  useEffect(() => { followModeRef.current = followMode; }, [followMode]);

  const updateMarkerOnMap = useCallback((coords) => {
    if (!webViewRef.current || !spotData?.coordinates) return;
    const { lat: destLat, lng: destLng } = spotData.coordinates;
    webViewRef.current.injectJavaScript(`
      (function() {
        try {
          if (window.userMarker) window.userMarker.setLatLng([${coords.latitude}, ${coords.longitude}]);
          if (window.routingControl) {
            window.routingControl.setWaypoints([
              L.latLng(${coords.latitude}, ${coords.longitude}),
              L.latLng(${destLat}, ${destLng})
            ]);
          }
          if (${followModeRef.current} && window.map)
            window.map.panTo([${coords.latitude}, ${coords.longitude}], { animate: true });
        } catch(e) {}
      })(); true;
    `);
  }, [spotData]);

  const handleCenterOnMe = useCallback(() => {
    if (!webViewRef.current || !userLocation) return;
    if (!followMode) {
      setFollowMode(true);
      webViewRef.current.injectJavaScript(`
        (function() {
          try { window.map?.setView([${userLocation.latitude}, ${userLocation.longitude}], 17, { animate: true }); }
          catch(e) {}
        })(); true;
      `);
    } else {
      setFollowMode(false);
    }
  }, [followMode, userLocation]);

  /* =========================================================
     MAP HTML
  ========================================================= */
  const mapHTML = useMemo(() => {
    if (!spotData?.coordinates || !userLocation) return null;
    const { lat: destLat, lng: destLng } = spotData.coordinates;
    const { latitude: userLat, longitude: userLng } = userLocation;
    const spotName = (spotData.name ?? "Destination").replace(/'/g, "\\'");

    return `<!DOCTYPE html><html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
        <style>* { margin:0; padding:0; box-sizing:border-box; } #map { width:100%; height:100vh; }</style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
        <script>
          window.map = L.map('map').setView([${(userLat + destLat) / 2}, ${(userLng + destLng) / 2}], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(window.map);
          const userIcon = L.divIcon({
            html: \`<div style="position:relative;">
              <div style="position:absolute;background:rgba(66,133,244,0.3);width:40px;height:40px;border-radius:50%;top:-10px;left:-10px;animation:pulse 2s infinite;"></div>
              <div style="background:#4285F4;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>
            </div>
            <style>@keyframes pulse{0%{transform:scale(0.8);opacity:1;}50%{transform:scale(1.2);opacity:0.5;}100%{transform:scale(0.8);opacity:1;}}</style>\`,
            className: '', iconSize: [20,20], iconAnchor: [10,10]
          });
          window.userMarker = L.marker([${userLat}, ${userLng}], { icon: userIcon }).addTo(window.map).bindPopup('Your Location');
          const destIcon = L.divIcon({
            html: '<div style="background:#8b4440;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',
            className: '', iconSize: [30,30], iconAnchor: [15,30]
          });
          window.destMarker = L.marker([${destLat}, ${destLng}], { icon: destIcon }).addTo(window.map).bindPopup('${spotName}');
          window.routingControl = L.Routing.control({
            waypoints: [L.latLng(${userLat}, ${userLng}), L.latLng(${destLat}, ${destLng})],
            router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
            lineOptions: { styles: [{ color: '#8b4440', weight: 5, opacity: 0.7 }] },
            createMarker: () => null,
            addWaypoints: false, routeWhileDragging: false, show: false, fitSelectedRoutes: false
          }).addTo(window.map);
          window.map.fitBounds(L.latLngBounds([${userLat}, ${userLng}], [${destLat}, ${destLng}]), { padding: [80, 80] });
        </script>
      </body></html>`;
  }, [spotData, userLocation !== null]);

  /* =========================================================
     LOADING / ERROR
  ========================================================= */
  if (loading || !spotData || !userLocation) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#8b4440" />
        <Text style={styles.loadingText}>
          {!spotData ? "Loading spot data..." : "Getting your location..."}
        </Text>
      </View>
    );
  }
  if (locationError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>{locationError}</Text>
        <TouchableOpacity style={styles.backButtonError} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!spotData.coordinates?.lat || !spotData.coordinates?.lng) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Location coordinates not available for this spot.</Text>
        <TouchableOpacity style={styles.backButtonError} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: mapHTML }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(e) => console.log("WebView:", e.nativeEvent.data)}
        onError={(e) => console.error("WebView error:", e.nativeEvent)}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>{spotData.name}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Badge Claim Banner */}
      {showBadgeBanner && pendingBadge && (
        <Animated.View style={[styles.badgeBanner, { transform: [{ translateY: badgeTranslateY }] }]}>
          <View style={styles.badgeBannerLeft}>
            <Image source = {pendingBadge.icon}style={{ width: 40, height: 40 }}/>
            <View style={{ flex: 1 }}>
              <Text style={styles.badgeBannerTitle}>New Badge Unlocked!</Text>
              <Text style={styles.badgeBannerName} numberOfLines={1}>{pendingBadge.name}</Text>
            </View>
          </View>
          <View style={styles.badgeBannerActions}>
            <TouchableOpacity style={styles.claimButton} onPress={claimBadge}>
              <Text style={styles.claimButtonText}>Claim</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissButton} onPress={dismissBadgeBanner}>
              <Feather name="x" size={16} color="#8b4440" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Center on Me */}
      <TouchableOpacity
        style={[styles.centerButton, followMode && styles.centerButtonActive]}
        onPress={handleCenterOnMe}
        activeOpacity={0.85}
      >
        <Feather name="navigation" size={22} color={followMode ? "#fff" : "#8b4440"} />
        {followMode && <Text style={styles.centerButtonLabel}>Following</Text>}
      </TouchableOpacity>

      {/* Points Popup */}
      {showPointsPopup && (
        <Animated.View
          style={[
            styles.pointsPopup,
            {
              opacity: pointsOpacity,
              transform: [{ translateY: pointsTranslateY }, { scale: pointsScale }],
            },
          ]}
        >
          <Text style={styles.pointsPopupEmoji}>🎉</Text>
          <Text style={styles.pointsPopupTitle}>You arrived!</Text>
          <Text style={styles.pointsPopupPoints}>+{POINTS_PER_VISIT} Points</Text>
          <Text style={styles.pointsPopupTotal}>Total: {totalPoints} pts</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  map: { flex: 1, width, height },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f7cfc9" },
  loadingText: { marginTop: 15, fontSize: 16, color: "#4a4a4a", fontWeight: "600" },
  errorText: { fontSize: 16, color: "#8b4440", fontWeight: "600", textAlign: "center", paddingHorizontal: 40 },
  backButtonError: { marginTop: 20, backgroundColor: "#8b4440", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  backButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  header: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20,
    backgroundColor: "rgba(139, 68, 64, 0.95)",
  },
  backButton: {
    width: 40, height: 40, justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 20,
  },
  headerContent: { flex: 1, marginHorizontal: 15 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },


  badgeBanner: {
    position: "absolute", top: 110, left: 16, right: 16,
    backgroundColor: "#fff", borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 10,
    borderWidth: 1.5, borderColor: "#f4c542",
  },
  badgeBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  badgeBannerEmoji: { fontSize: 32 },
  badgeBannerTitle: { fontSize: 11, color: "#8b4440", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  badgeBannerName: { fontSize: 14, color: "#4a2e2c", fontWeight: "600", marginTop: 1 },
  badgeBannerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  claimButton: { backgroundColor: "#8b4440", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  claimButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  dismissButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#fce8e6", justifyContent: "center", alignItems: "center" },

  centerButton: {
    position: "absolute", bottom: 40, right: 20,
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 30, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, gap: 6,
  },
  centerButtonActive: { backgroundColor: "#8b4440" },
  centerButtonLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },

  pointsPopup: {
    position: "absolute", bottom: 120, alignSelf: "center",
    backgroundColor: "#fff", borderRadius: 20,
    paddingVertical: 20, paddingHorizontal: 35, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
    borderWidth: 2, borderColor: "#f4c542",
  },
  pointsPopupEmoji: { fontSize: 36, marginBottom: 6 },
  pointsPopupTitle: { fontSize: 18, fontWeight: "700", color: "#4a4a4a", marginBottom: 4 },
  pointsPopupPoints: { fontSize: 26, fontWeight: "800", color: "#8b4440", marginBottom: 2 },
  pointsPopupTotal: { fontSize: 13, color: "#6a5a5a", fontWeight: "500" },
});