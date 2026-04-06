// screens/Track.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useArrival } from "../context/ArrivalContext";

const { width, height } = Dimensions.get("window");
const BASE_URL = "https://libotbackend.onrender.com";

const TERMINALS = [
  // ── San Jose del Monte ──────────────────────────────────────────
  {
    id: "tungkong-mangga",
    name: "Tungkong Mangga Terminal",
    lat: 14.8177,
    lng: 121.0515,
    address: "Tungkong Mangga, San Jose del Monte, Bulacan",
    routes: ["Tungkong Mangga – Fairview", "Tungkong Mangga – Cubao"],
    type: "Jeepney / UV Express Terminal",
  },
  {
    id: "sapang-palay",
    name: "Sapang Palay Terminal",
    lat: 14.8363,
    lng: 121.0602,
    address: "Sapang Palay Proper, San Jose del Monte, Bulacan",
    routes: ["Sapang Palay – Monumento", "Sapang Palay – SM Fairview"],
    type: "Jeepney Terminal",
  },
  {
    id: "poblacion-sjdm",
    name: "Poblacion Terminal (SJDM)",
    lat: 14.8119,
    lng: 121.0447,
    address: "Poblacion, San Jose del Monte, Bulacan",
    routes: ["SJDM – Monumento", "SJDM – Cubao"],
    type: "Bus / Jeepney Terminal",
  },
  {
    id: "francisco-homes",
    name: "Francisco Homes Terminal",
    lat: 14.8256,
    lng: 121.0483,
    address: "Francisco Homes, San Jose del Monte, Bulacan",
    routes: ["Francisco Homes – Fairview", "Francisco Homes – SM City"],
    type: "UV Express Terminal",
  },
  {
    id: "muzon",
    name: "Muzon Terminal",
    lat: 14.7985,
    lng: 121.0368,
    address: "Muzon, San Jose del Monte, Bulacan",
    routes: ["Muzon – Monumento", "Muzon – SM Fairview"],
    type: "Jeepney Terminal",
  },
  {
    id: "citihomes",
    name: "Citihomes Terminal",
    lat: 14.8302,
    lng: 121.0540,
    address: "Citihomes, San Jose del Monte, Bulacan",
    routes: ["Citihomes – Fairview", "Citihomes – Monumento"],
    type: "UV Express Terminal",
  },
  {
    id: "graceville",
    name: "Graceville Terminal",
    lat: 14.8210,
    lng: 121.0590,
    address: "Graceville, San Jose del Monte, Bulacan",
    routes: ["Graceville – Cubao", "Graceville – SM Fairview"],
    type: "Jeepney Terminal",
  },

  // ── Malolos (Provincial Capital) ────────────────────────────────
  {
    id: "malolos-central",
    name: "Malolos Central Terminal",
    lat: 14.8527,
    lng: 120.8127,
    address: "Paseo del Congreso, Malolos City, Bulacan",
    routes: [
      "Malolos – Cubao (NLEX)",
      "Malolos – Monumento",
      "Malolos – Tuktukan",
    ],
    type: "Bus / Jeepney Terminal",
  },
  {
    id: "malolos-north",
    name: "Malolos North Bus Terminal",
    lat: 14.8620,
    lng: 120.8130,
    address: "McArthur Highway, Malolos City, Bulacan",
    routes: [
      "Malolos – Baliuag (via McArthur Hwy)",
      "Malolos – Calumpit",
    ],
    type: "Bus Terminal",
  },

  // ── Meycauayan ───────────────────────────────────────────────────
  {
    id: "meycauayan-terminal",
    name: "Meycauayan Transport Terminal",
    lat: 14.7356,
    lng: 120.9604,
    address: "Valenzuela Road, Meycauayan City, Bulacan",
    routes: [
      "Meycauayan – Monumento",
      "Meycauayan – SM Fairview",
      "Meycauayan – Cubao",
    ],
    type: "Jeepney / UV Express Terminal",
  },
  {
    id: "malhacan",
    name: "Malhacan Terminal",
    lat: 14.7290,
    lng: 120.9570,
    address: "Malhacan, Meycauayan City, Bulacan",
    routes: ["Malhacan – Monumento", "Malhacan – EDSA"],
    type: "Jeepney Terminal",
  },

  // ── Marilao ──────────────────────────────────────────────────────
  {
    id: "marilao-terminal",
    name: "Marilao Terminal",
    lat: 14.7619,
    lng: 120.9487,
    address: "McArthur Highway, Marilao, Bulacan",
    routes: ["Marilao – Monumento", "Marilao – SM Fairview"],
    type: "Jeepney Terminal",
  },

  // ── Bocaue ────────────────────────────────────────────────────────
  {
    id: "bocaue-terminal",
    name: "Bocaue Terminal",
    lat: 14.7978,
    lng: 120.9289,
    address: "McArthur Highway, Bocaue, Bulacan",
    routes: ["Bocaue – Monumento", "Bocaue – Malolos"],
    type: "Jeepney Terminal",
  },

  // ── Balagtas ──────────────────────────────────────────────────────
  {
    id: "balagtas-terminal",
    name: "Balagtas Terminal",
    lat: 14.8162,
    lng: 120.9079,
    address: "McArthur Highway, Balagtas, Bulacan",
    routes: ["Balagtas – Monumento", "Balagtas – Malolos"],
    type: "Jeepney Terminal",
  },

  // ── Guiguinto ─────────────────────────────────────────────────────
  {
    id: "guiguinto-terminal",
    name: "Guiguinto Terminal",
    lat: 14.8369,
    lng: 120.8859,
    address: "McArthur Highway, Guiguinto, Bulacan",
    routes: ["Guiguinto – Malolos", "Guiguinto – Monumento"],
    type: "Jeepney Terminal",
  },

  // ── Baliuag ───────────────────────────────────────────────────────
  {
    id: "baliuag-terminal",
    name: "Baliuag Terminal",
    lat: 14.9531,
    lng: 120.8975,
    address: "Rizal Street, Baliuag, Bulacan",
    routes: [
      "Baliuag – Cubao (NLEX)",
      "Baliuag – Malolos",
      "Baliuag – Cabanatuan",
    ],
    type: "Bus / Jeepney Terminal",
  },

  // ── Plaridel ──────────────────────────────────────────────────────
  {
    id: "plaridel-terminal",
    name: "Plaridel Terminal",
    lat: 14.8851,
    lng: 120.8594,
    address: "McArthur Highway, Plaridel, Bulacan",
    routes: ["Plaridel – Malolos", "Plaridel – Monumento"],
    type: "Jeepney Terminal",
  },

  // ── Pulilan ────────────────────────────────────────────────────────
  {
    id: "pulilan-terminal",
    name: "Pulilan Terminal",
    lat: 14.9021,
    lng: 120.8500,
    address: "McArthur Highway, Pulilan, Bulacan",
    routes: ["Pulilan – Malolos", "Pulilan – Baliuag"],
    type: "Jeepney Terminal",
  },

  // ── Calumpit ───────────────────────────────────────────────────────
  {
    id: "calumpit-terminal",
    name: "Calumpit Terminal",
    lat: 14.9139,
    lng: 120.7660,
    address: "Rizal Street, Calumpit, Bulacan",
    routes: ["Calumpit – Malolos", "Calumpit – Manila (via NLEX)"],
    type: "Bus / Jeepney Terminal",
  },

  // ── Hagonoy ────────────────────────────────────────────────────────
  {
    id: "hagonoy-terminal",
    name: "Hagonoy Terminal",
    lat: 14.8334,
    lng: 120.7333,
    address: "Rizal Street, Hagonoy, Bulacan",
    routes: ["Hagonoy – Malolos", "Hagonoy – Calumpit"],
    type: "Jeepney Terminal",
  },

  // ── Bustos ─────────────────────────────────────────────────────────
  {
    id: "bustos-terminal",
    name: "Bustos Terminal",
    lat: 14.9556,
    lng: 120.9167,
    address: "Poblacion, Bustos, Bulacan",
    routes: ["Bustos – Baliuag", "Bustos – Malolos"],
    type: "Jeepney Terminal",
  },

  // ── Angat ──────────────────────────────────────────────────────────
  {
    id: "angat-terminal",
    name: "Angat Terminal",
    lat: 14.9333,
    lng: 121.0167,
    address: "Poblacion, Angat, Bulacan",
    routes: ["Angat – Baliuag", "Angat – San Rafael"],
    type: "Jeepney Terminal",
  },

  // ── Norzagaray ─────────────────────────────────────────────────────
  {
    id: "norzagaray-terminal",
    name: "Norzagaray Terminal",
    lat: 14.9000,
    lng: 121.0500,
    address: "Poblacion, Norzagaray, Bulacan",
    routes: ["Norzagaray – Baliuag", "Norzagaray – Monumento"],
    type: "Jeepney Terminal",
  },

  // ── San Ildefonso ──────────────────────────────────────────────────
  {
    id: "san-ildefonso-terminal",
    name: "San Ildefonso Terminal",
    lat: 15.0667,
    lng: 121.0000,
    address: "Poblacion, San Ildefonso, Bulacan",
    routes: ["San Ildefonso – Baliuag", "San Ildefonso – Malolos"],
    type: "Jeepney Terminal",
  },

  // ── San Miguel ─────────────────────────────────────────────────────
  {
    id: "san-miguel-terminal",
    name: "San Miguel Terminal",
    lat: 15.1333,
    lng: 121.0167,
    address: "Poblacion, San Miguel, Bulacan",
    routes: [
      "San Miguel – Baliuag",
      "San Miguel – Cabanatuan (via Nueva Ecija)",
    ],
    type: "Bus / Jeepney Terminal",
  },

  // ── Dona Remedios Trinidad ─────────────────────────────────────────
  {
    id: "drt-terminal",
    name: "Doña Remedios Trinidad Terminal",
    lat: 15.0167,
    lng: 121.1167,
    address: "Poblacion, Doña Remedios Trinidad, Bulacan",
    routes: ["DRT – Norzagaray", "DRT – San Ildefonso"],
    type: "Jeepney Terminal",
  },

  // ── Obando ─────────────────────────────────────────────────────────
  {
    id: "obando-terminal",
    name: "Obando Terminal",
    lat: 14.7028,
    lng: 120.9222,
    address: "Poblacion, Obando, Bulacan",
    routes: ["Obando – Meycauayan", "Obando – Monumento"],
    type: "Jeepney Terminal",
  },

  // ── Paombong ────────────────────────────────────────────────────────
  {
    id: "paombong-terminal",
    name: "Paombong Terminal",
    lat: 14.8333,
    lng: 120.7833,
    address: "Poblacion, Paombong, Bulacan",
    routes: ["Paombong – Malolos", "Paombong – Hagonoy"],
    type: "Jeepney Terminal",
  },

  // ── Sta. Maria ──────────────────────────────────────────────────────
  {
    id: "sta-maria-terminal",
    name: "Sta. Maria Terminal",
    lat: 14.8119,
    lng: 121.0003,
    address: "McArthur Highway, Sta. Maria, Bulacan",
    routes: ["Sta. Maria – Monumento", "Sta. Maria – Malolos"],
    type: "Jeepney Terminal",
  },

  // ── Pandi ────────────────────────────────────────────────────────────
  {
    id: "pandi-terminal",
    name: "Pandi Terminal",
    lat: 14.8667,
    lng: 120.9500,
    address: "Poblacion, Pandi, Bulacan",
    routes: ["Pandi – Malolos", "Pandi – Bocaue"],
    type: "Jeepney Terminal",
  },
];

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
  const [selectedTerminal, setSelectedTerminal] = useState(null);

  // Bottom sheet animation
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const sheetVisible = useRef(false);

  const showSheet = useCallback((terminal) => {
    setSelectedTerminal(terminal);
    sheetVisible.current = true;
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [sheetAnim]);

  const hideSheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      sheetVisible.current = false;
      setSelectedTerminal(null);
    });
  }, [sheetAnim]);

  // Pan responder for swipe-down to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 60) hideSheet();
      },
    })
  ).current;

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

  /* ── Update marker via injectJavaScript ── */
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

  updateMarkerRef.current = updateMarkerOnMap;

  /* ── Handle messages from WebView ── */
  const handleWebViewMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "terminalTapped") {
        const terminal = TERMINALS.find((t) => t.id === data.id);
        if (terminal) showSheet(terminal);
      } else if (data.type === "mapTapped") {
        if (sheetVisible.current) hideSheet();
      }
    } catch {}
  }, [showSheet, hideSheet]);

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

  /* ── Map HTML ── */
  const mapHTML = useMemo(() => {
    if (!spotData) return null;
    const dest = getSpotCoords(spotData);
    if (!dest) return null;

    const { lat: destLat, lng: destLng } = dest;
    const spotName = (spotData.name ?? "Destination").replace(/'/g, "\\'");

    // Serialize terminals for the map
    const terminalsJson = JSON.stringify(
      TERMINALS.map(({ id, name, lat, lng }) => ({ id, name, lat, lng }))
    );

    // Bus SVG icon — a clean top-view bus silhouette
    // Encoded as a data URI so no external assets are needed
    const BUS_ICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32'>
      <!-- Shadow -->
      <ellipse cx='16' cy='29' rx='9' ry='2.5' fill='rgba(0,0,0,0.25)'/>
      <!-- Body -->
      <rect x='5' y='5' width='22' height='20' rx='4' fill='%232c5f9e'/>
      <!-- Roof highlight -->
      <rect x='5' y='5' width='22' height='8' rx='4' fill='%23356bb5'/>
      <!-- Front windshield -->
      <rect x='8' y='6.5' width='16' height='5' rx='2' fill='%23a8d4f5' opacity='0.9'/>
      <!-- Side windows row -->
      <rect x='7' y='14' width='5' height='4' rx='1' fill='%23a8d4f5' opacity='0.85'/>
      <rect x='13.5' y='14' width='5' height='4' rx='1' fill='%23a8d4f5' opacity='0.85'/>
      <rect x='20' y='14' width='5' height='4' rx='1' fill='%23a8d4f5' opacity='0.85'/>
      <!-- Door -->
      <rect x='13' y='20' width='6' height='4' rx='1' fill='%231d4b80'/>
      <!-- Wheels -->
      <circle cx='9'  cy='24.5' r='2.5' fill='%231a1a2e'/>
      <circle cx='23' cy='24.5' r='2.5' fill='%231a1a2e'/>
      <circle cx='9'  cy='24.5' r='1.2' fill='%23555'/>
      <circle cx='23' cy='24.5' r='1.2' fill='%23555'/>
      <!-- White border ring -->
      <rect x='5' y='5' width='22' height='20' rx='4' fill='none' stroke='white' stroke-width='1.5'/>
    </svg>`;

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

        /* Bus marker tooltip */
        .terminal-tooltip {
          background:#fff;
          border:none;
          border-radius:6px;
          padding:4px 8px;
          font-size:11px;
          font-weight:600;
          color:#1a1a2e;
          box-shadow:0 2px 8px rgba(0,0,0,0.25);
          white-space:nowrap;
        }
        .terminal-tooltip::before { display:none; }
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
        const DEST_LAT   = ${destLat};
        const DEST_LNG   = ${destLng};
        const SPOT_NAME  = '${spotName}';
        const TERMINALS  = ${terminalsJson};

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

        // Dismiss sheet when map is tapped
        window.map.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapTapped' }));
        });

        // ── Bulacan boundary ──
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
            const f = merged[0], l = merged[merged.length - 1];
            if (Math.abs(f[0]-l[0]) > 0.0001 || Math.abs(f[1]-l[1]) > 0.0001) merged.push(f);
            L.polygon(
              [[ [-90,-180],[-90,180],[90,180],[90,-180],[-90,-180] ], merged],
              { fillColor:'#1a1a2e', fillOpacity:0.92, stroke:false, interactive:false }
            ).addTo(window.map);
            L.polyline(merged, { color:'#8b4440', weight:2.5, opacity:0.9 }).addTo(window.map);
            document.getElementById('loading-overlay').style.display = 'none';
          })
          .catch(() => {
            L.polygon(
              [[ [-90,-180],[-90,180],[90,180],[90,-180] ],
               [ [14.62,120.76],[14.62,121.28],[15.22,121.28],[15.22,120.76] ]],
              { fillColor:'#1a1a2e', fillOpacity:0.92, stroke:false, interactive:false }
            ).addTo(window.map);
            document.getElementById('loading-overlay').style.display = 'none';
          });

        // ── Destination marker ──
        const destIcon = L.divIcon({
          html: '<div style="background:#8b4440;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>',
          className:'', iconSize:[30,30], iconAnchor:[15,30]
        });
        window.destMarker = L.marker([DEST_LAT, DEST_LNG], { icon: destIcon })
          .addTo(window.map).bindPopup(SPOT_NAME);

        // ── Terminal markers — bus SVG icon ──
        // The icon is an inline SVG bus silhouette (top-down view).
        // iconSize [32,32], iconAnchor centres the icon on the coordinate.
        var busIconHtml = [
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">',
            '<ellipse cx="16" cy="29" rx="9" ry="2.5" fill="rgba(0,0,0,0.25)"/>',
            '<rect x="5" y="5" width="22" height="20" rx="4" fill="#2c5f9e"/>',
            '<rect x="5" y="5" width="22" height="8" rx="4" fill="#356bb5"/>',
            '<rect x="8" y="6.5" width="16" height="5" rx="2" fill="#a8d4f5" opacity="0.9"/>',
            '<rect x="7" y="14" width="5" height="4" rx="1" fill="#a8d4f5" opacity="0.85"/>',
            '<rect x="13.5" y="14" width="5" height="4" rx="1" fill="#a8d4f5" opacity="0.85"/>',
            '<rect x="20" y="14" width="5" height="4" rx="1" fill="#a8d4f5" opacity="0.85"/>',
            '<rect x="13" y="20" width="6" height="4" rx="1" fill="#1d4b80"/>',
            '<circle cx="9" cy="24.5" r="2.5" fill="#1a1a2e"/>',
            '<circle cx="23" cy="24.5" r="2.5" fill="#1a1a2e"/>',
            '<circle cx="9" cy="24.5" r="1.2" fill="#555"/>',
            '<circle cx="23" cy="24.5" r="1.2" fill="#555"/>',
            '<rect x="5" y="5" width="22" height="20" rx="4" fill="none" stroke="white" stroke-width="1.5"/>',
          '</svg>'
        ].join('');

        const terminalIcon = L.divIcon({
          html: busIconHtml,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        TERMINALS.forEach(function(t) {
          const marker = L.marker([t.lat, t.lng], { icon: terminalIcon })
            .addTo(window.map);

          // Persistent tooltip showing terminal name on hover
          marker.bindTooltip(t.name, {
            permanent: false,
            direction: 'top',
            offset: [0, -18],
            className: 'terminal-tooltip',
          });

          marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: 'terminalTapped', id: t.id })
            );
          });
        });

        // ── User location ──
        window.userMarker     = null;
        window.routingControl = null;
        window.mapReady       = false;

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
  }, [spotData]);

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

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: mapHTML }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleWebViewMessage}
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

      {/* Terminal Place Sheet */}
      {selectedTerminal && (
        <>
          {/* Scrim — tap to dismiss */}
          <TouchableOpacity
            style={styles.scrim}
            activeOpacity={1}
            onPress={hideSheet}
          />
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}
            {...panResponder.panHandlers}
          >
            {/* Drag handle */}
            <View style={styles.sheetHandle} />

            {/* Terminal icon + name */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIconWrap}>
                {/* Bus icon in the sheet header */}
                <Feather name="truck" size={20} color="#fff" />
              </View>
              <View style={styles.sheetTitleBlock}>
                <Text style={styles.sheetName} numberOfLines={2}>
                  {selectedTerminal.name}
                </Text>
                <Text style={styles.sheetType}>{selectedTerminal.type}</Text>
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={hideSheet}>
                <Feather name="x" size={18} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Address */}
            <View style={styles.sheetRow}>
              <Feather name="map-pin" size={15} color="#8b4440" style={styles.sheetRowIcon} />
              <Text style={styles.sheetRowText}>{selectedTerminal.address}</Text>
            </View>

            {/* Routes */}
            <View style={styles.sheetDivider} />
            <Text style={styles.sheetSectionLabel}>Routes served</Text>
            {selectedTerminal.routes.map((r, i) => (
              <View key={i} style={styles.sheetRow}>
                <Feather name="arrow-right-circle" size={15} color="#2c5f9e" style={styles.sheetRowIcon} />
                <Text style={styles.sheetRowText}>{r}</Text>
              </View>
            ))}

            {/* Actions */}
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetActionBtn, styles.sheetActionPrimary]}
                activeOpacity={0.85}
                onPress={() => {
                  hideSheet();
                  webViewRef.current?.injectJavaScript(`
                    (function(){
                      try { window.map.setView([${selectedTerminal.lat}, ${selectedTerminal.lng}], 16, { animate: true }); }
                      catch(e){}
                    })(); true;
                  `);
                }}
              >
                <Feather name="crosshair" size={16} color="#fff" />
                <Text style={styles.sheetActionPrimaryText}>Show on map</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, styles.sheetActionSecondary]}
                activeOpacity={0.85}
                onPress={hideSheet}
              >
                <Text style={styles.sheetActionSecondaryText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </>
      )}
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

  // ── Bottom sheet ──
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 20,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    marginTop: 10,
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  sheetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#2c5f9e",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sheetTitleBlock: {
    flex: 1,
  },
  sheetName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    lineHeight: 22,
  },
  sheetType: {
    fontSize: 13,
    color: "#777",
    marginTop: 2,
  },
  sheetClose: {
    padding: 4,
    flexShrink: 0,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 12,
  },
  sheetSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  sheetRowIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  sheetRowText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
    lineHeight: 20,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  sheetActionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  sheetActionPrimary: {
    backgroundColor: "#8b4440",
  },
  sheetActionPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  sheetActionSecondary: {
    backgroundColor: "#f2f2f2",
  },
  sheetActionSecondaryText: {
    color: "#555",
    fontSize: 14,
    fontWeight: "600",
  },
});