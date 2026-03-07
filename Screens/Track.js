// screens/Track.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useArrival } from "../context/ArrivalContext";

const { width, height } = Dimensions.get("window");
const BASE_URL = "https://libotbackend.onrender.com";

function getSpotCoords(spot) {
  if (!spot) return null;
  if (spot.coordinates?.lat != null && spot.coordinates?.lng != null)
    return { lat: spot.coordinates.lat, lng: spot.coordinates.lng };
  if (spot.latitude != null && spot.longitude != null)
    return { lat: spot.latitude, lng: spot.longitude };
  return null;
}

export default function Track({ route, navigation }) {
  const { spot } = route.params;
  const { setActiveSpot } = useArrival();

  const [userLocation, setUserLocation]   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [spotData, setSpotData]           = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [followMode, setFollowMode]       = useState(false);

  const webViewRef           = useRef(null);
  const locationSubscription = useRef(null);
  const isMounted            = useRef(true);

  useEffect(() => {
    if (spotData) setActiveSpot(spotData);
  }, [spotData]);

  /* ── Fetch spot data ── */
  useEffect(() => {
    isMounted.current = true;

    const loadSpot = async () => {
      if (getSpotCoords(spot)) {
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
        const singleRes  = await fetch(`${BASE_URL}/api/spots/${spot._id}`);
        const singleData = await safeJson(singleRes);

        if (singleData?.success && singleData?.spot) {
          foundSpot = singleData.spot;
        } else {
          const listRes  = await fetch(`${BASE_URL}/api/spots`);
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

  /* ── Location tracking for map display only ── */
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

        setUserLocation({
          latitude:  initial.coords.latitude,
          longitude: initial.coords.longitude,
        });
        setLoading(false);

        locationSubscription.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 3 },
          (loc) => {
            if (!isMounted.current) return;
            const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(c);
            updateMarkerOnMap(c);
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

  /* ── Map marker update ── */
  const followModeRef = useRef(followMode);
  useEffect(() => { followModeRef.current = followMode; }, [followMode]);

  const updateMarkerOnMap = useCallback((coords) => {
    if (!webViewRef.current || !spotData) return;
    const dest = getSpotCoords(spotData);
    if (!dest) return;

    webViewRef.current.injectJavaScript(`
      (function() {
        try {
          if (window.userMarker) window.userMarker.setLatLng([${coords.latitude}, ${coords.longitude}]);
          if (window.routingControl) {
            window.routingControl.setWaypoints([
              L.latLng(${coords.latitude}, ${coords.longitude}),
              L.latLng(${dest.lat}, ${dest.lng})
            ]);
          }
          if (${followModeRef.current} && window.map)
            window.map.panTo([${coords.latitude}, ${coords.longitude}], { animate: true });
        } catch(e) {}
      })(); true;
    `);
  }, [spotData]);

  /* ── Center on Me ── */
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

  /* ── Map HTML ── */
  const mapHTML = useMemo(() => {
    if (!spotData || !userLocation) return null;
    const dest = getSpotCoords(spotData);
    if (!dest) return null;

    const { latitude: userLat, longitude: userLng } = userLocation;
    const { lat: destLat, lng: destLng } = dest;
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
  }, [spotData, userLocation]);

  /* ── Loading / Error states ── */
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
  if (!getSpotCoords(spotData)) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Location coordinates not available for this spot.</Text>
        <TouchableOpacity style={styles.backButtonError} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: mapHTML }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        onError={(e) => console.error("WebView error:", e.nativeEvent)}
      />

      {/* Header — back button and spot name only */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{spotData.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Center on Me */}
      <TouchableOpacity
        style={[styles.centerButton, followMode && styles.centerButtonActive]}
        onPress={handleCenterOnMe}
        activeOpacity={0.85}
      >
        <Feather name="navigation" size={22} color={followMode ? "#fff" : "#8b4440"} />
        {followMode && <Text style={styles.centerButtonLabel}>Following</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  map: {
    flex: 1,
    width,
    height,
  },

  // ── Loading / Error ──
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7cfc9",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#4a4a4a",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
    color: "#8b4440",
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  backButtonError: {
    marginTop: 20,
    backgroundColor: "#8b4440",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Header ──
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "rgba(139, 68, 64, 0.95)",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginHorizontal: 12,
  },

  // ── Center on Me button ──
  centerButton: {
    position: "absolute",
    bottom: 40,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    gap: 6,
  },
  centerButtonActive: {
    backgroundColor: "#8b4440",
  },
  centerButtonLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});