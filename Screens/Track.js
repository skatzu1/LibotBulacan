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

  /* ── followMode ref ── */
  const followModeRef = useRef(followMode);
  useEffect(() => { followModeRef.current = followMode; }, [followMode]);

  /* ── Update marker via injectJavaScript — no HTML rebuild, no reload ── */
  const updateMarkerRef = useRef(null);
  const updateMarkerOnMap = useCallback((coords) => {
    if (!webViewRef.current || !spotData) return;
    webViewRef.current.injectJavaScript(`
      (function() {
        try {
          window.updateUserLocation(
            ${coords.latitude},
            ${coords.longitude},
            ${followModeRef.current}
          );
        } catch(e) {}
      })(); true;
    `);
  }, [spotData]);

  // Always keep ref pointing to latest callback so watcher closure never goes stale
  updateMarkerRef.current = updateMarkerOnMap;

  /* ── Location tracking ── */
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

        const initialCoords = {
          latitude:  initial.coords.latitude,
          longitude: initial.coords.longitude,
        };
        setUserLocation(initialCoords);
        setLoading(false);

        // Send initial position to map right away
        updateMarkerRef.current?.(initialCoords);

        locationSubscription.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 3 },
          (loc) => {
            if (!isMounted.current) return;
            const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(c);
            updateMarkerRef.current?.(c);
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

  /* ── Map HTML — depends ONLY on spotData, never rebuilds on location change ── */
  const mapHTML = useMemo(() => {
    if (!spotData) return null;
    const dest = getSpotCoords(spotData);
    if (!dest) return null;

    const { lat: destLat, lng: destLng } = dest;
    const spotName = (spotData.name ?? "Destination").replace(/'/g, "\\'");

    return `<!DOCTYPE html><html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#1a1a2e; }
        #map { width:100%; height:100vh; background:#1a1a2e; }
        .leaflet-control-attribution { display:none; }
        #loading-overlay {
          position:fixed; top:0; left:0; right:0; bottom:0;
          background:#1a1a2e;
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          z-index:9999;
          font-family:sans-serif; color:#aaa;
          font-size:14px; font-weight:600; gap:12px;
        }
        .spinner {
          width:36px; height:36px;
          border:4px solid #333; border-top-color:#8b4440;
          border-radius:50%; animation:spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }
      </style>
    </head>
    <body>
      <div id="loading-overlay">
        <div class="spinner"></div>
        <span>Loading Bulacan map…</span>
      </div>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
      <script>
        const DEST_LAT  = ${destLat};
        const DEST_LNG  = ${destLng};
        const SPOT_NAME = '${spotName}';

        const bulacanBounds = L.latLngBounds(
          L.latLng(14.55, 120.68),
          L.latLng(15.35, 121.35)
        );

        window.map = L.map('map', {
          maxBounds: bulacanBounds,
          maxBoundsViscosity: 1.0,
          minZoom: 10, maxZoom: 18, zoomControl: true,
        }).setView([14.9200, 120.9900], 11);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors', maxZoom: 19,
        }).addTo(window.map);

        // ── Fetch Bulacan boundary ONCE from Overpass ──
        const overpassQuery = \`[out:json][timeout:30];
          relation["name"="Bulacan"]["admin_level"="4"];
          out geom;\`;
        const overpassURL = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery);

        fetch(overpassURL)
          .then(r => r.json())
          .then(data => {
            const relation = data.elements[0];
            if (!relation?.members) throw new Error('No boundary');

            const outerRings = relation.members
              .filter(m => m.role === 'outer' && m.geometry?.length > 1)
              .map(m => m.geometry.map(pt => [pt.lat, pt.lon]));

            if (!outerRings.length) throw new Error('No outer rings');

            const merged = mergeRings(outerRings);

            // Ensure closed
            const f = merged[0], l = merged[merged.length - 1];
            if (Math.abs(f[0]-l[0]) > 0.0001 || Math.abs(f[1]-l[1]) > 0.0001) merged.push(f);

            // World mask with Bulacan hole
            L.polygon(
              [[ [-90,-180],[-90,180],[90,180],[90,-180],[-90,-180] ], merged],
              { fillColor:'#1a1a2e', fillOpacity:0.92, stroke:false, interactive:false }
            ).addTo(window.map);

            // Bulacan border outline
            L.polyline(merged, { color:'#8b4440', weight:2.5, opacity:0.9 }).addTo(window.map);

            document.getElementById('loading-overlay').style.display = 'none';
          })
          .catch(() => {
            // Fallback rectangular mask
            L.polygon(
              [[ [-90,-180],[-90,180],[90,180],[90,-180] ],
               [ [14.62,120.76],[14.62,121.28],[15.22,121.28],[15.22,120.76] ]],
              { fillColor:'#1a1a2e', fillOpacity:0.92, stroke:false, interactive:false }
            ).addTo(window.map);
            document.getElementById('loading-overlay').style.display = 'none';
          });

        // ── Destination marker (static, drawn once) ──
        const destIcon = L.divIcon({
          html: '<div style="background:#8b4440;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',
          className:'', iconSize:[30,30], iconAnchor:[15,30]
        });
        window.destMarker = L.marker([DEST_LAT, DEST_LNG], { icon: destIcon })
          .addTo(window.map).bindPopup(SPOT_NAME);

        window.userMarker     = null;
        window.routingControl = null;
        window.mapReady       = false;

        // Called once on first location update
        window.initUserLocation = function(lat, lng) {
          const userIcon = L.divIcon({
            html: \`<div style="position:relative;">
              <div style="position:absolute;background:rgba(66,133,244,0.3);width:40px;height:40px;border-radius:50%;top:-10px;left:-10px;animation:pulse 2s infinite;"></div>
              <div style="background:#4285F4;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>
            </div>
            <style>@keyframes pulse{0%{transform:scale(0.8);opacity:1}50%{transform:scale(1.2);opacity:0.5}100%{transform:scale(0.8);opacity:1}}</style>\`,
            className:'', iconSize:[20,20], iconAnchor:[10,10]
          });

          window.userMarker = L.marker([lat, lng], { icon: userIcon })
            .addTo(window.map).bindPopup('Your Location');

          window.routingControl = L.Routing.control({
            waypoints: [L.latLng(lat, lng), L.latLng(DEST_LAT, DEST_LNG)],
            router: L.Routing.osrmv1({ serviceUrl:'https://router.project-osrm.org/route/v1' }),
            lineOptions: { styles:[{ color:'#8b4440', weight:5, opacity:0.8 }] },
            createMarker: () => null,
            addWaypoints: false, routeWhileDragging: false,
            show: false, fitSelectedRoutes: false,
          }).addTo(window.map);

          window.map.fitBounds(
            L.latLngBounds([lat, lng], [DEST_LAT, DEST_LNG]),
            { padding:[80,80] }
          );

          window.mapReady = true;
        };

        // Called every 3s via injectJavaScript — just moves marker, no reload
        window.updateUserLocation = function(lat, lng, follow) {
          if (!window.mapReady) {
            window.initUserLocation(lat, lng);
            return;
          }
          if (window.userMarker) window.userMarker.setLatLng([lat, lng]);
          if (window.routingControl) {
            window.routingControl.setWaypoints([
              L.latLng(lat, lng),
              L.latLng(DEST_LAT, DEST_LNG)
            ]);
          }
          if (follow && window.map) window.map.panTo([lat, lng], { animate:true });
        };

        // ── Ring merge utility ──
        function mergeRings(rings) {
          if (rings.length === 1) return rings[0].slice();
          const dist = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
          const TOL  = 0.001;
          let merged = rings[0].slice();
          const rem  = rings.slice(1).map(r => r.slice());
          let passes = rem.length * 4;
          while (rem.length > 0 && passes-- > 0) {
            const mF = merged[0], mL = merged[merged.length-1];
            let found = false;
            for (let i = 0; i < rem.length; i++) {
              const r = rem[i], rF = r[0], rL = r[r.length-1];
              if      (dist(mL,rF) < TOL) { merged = merged.concat(r.slice(1));              rem.splice(i,1); found=true; break; }
              else if (dist(mL,rL) < TOL) { merged = merged.concat(r.slice(0,-1).reverse()); rem.splice(i,1); found=true; break; }
              else if (dist(mF,rL) < TOL) { merged = r.slice(0,-1).concat(merged);           rem.splice(i,1); found=true; break; }
              else if (dist(mF,rF) < TOL) { merged = r.slice(1).reverse().concat(merged);    rem.splice(i,1); found=true; break; }
            }
            if (!found) {
              let bi=0, bd=Infinity, br=false;
              for (let i=0;i<rem.length;i++) {
                const r=rem[i];
                const d1=dist(mL,r[0]), d2=dist(mL,r[r.length-1]);
                if (d1<bd){bd=d1;bi=i;br=false;}
                if (d2<bd){bd=d2;bi=i;br=true;}
              }
              merged = br
                ? merged.concat(rem[bi].slice(0,-1).reverse())
                : merged.concat(rem[bi].slice(1));
              rem.splice(bi,1);
            }
          }
          return merged;
        }
      </script>
    </body></html>`;
  }, [spotData]); // ← ONLY spotData — never re-runs on location change

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

      {/* Header */}
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