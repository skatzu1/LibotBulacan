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
  StatusBar,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useArrival } from "../context/ArrivalContext";
import { useTheme, radius, shadow } from "../context/ThemeContext";
import { BULACAN_BOUNDARY, BULACAN_BBOX } from "../utils/bulacanBoundary";

/* ── Human-readable distance / duration ───────────────────────────── */
function fmtDistance(m) {
  if (m == null) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m / 10) * 10} m`;
}
function fmtDuration(s) {
  if (s == null) return "";
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} hr ${mins % 60} min`;
}

const { width, height } = Dimensions.get("window");
const BASE_URL = "https://libotbackend.onrender.com";

const TERMINALS = [

  // ── San Jose del Monte ───────────────────────────────────────────
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
    lat: 14.8587,
    lng: 121.0484,
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
    lat: 14.8083,
    lng: 121.0583,
    address: "Francisco Homes, San Jose del Monte, Bulacan",
    routes: ["Francisco Homes – Fairview", "Francisco Homes – SM City"],
    type: "UV Express Terminal",
  },
  {
    id: "muzon",
    name: "Muzon Terminal",
    lat: 14.8024,
    lng: 121.0347,
    address: "Muzon, San Jose del Monte, Bulacan",
    routes: ["Muzon – Monumento", "Muzon – SM Fairview"],
    type: "Jeepney Terminal",
  },
  {
    id: "citihomes",
    name: "Citihomes Terminal",
    lat: 14.8421,
    lng: 121.0457,
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
  {
    id: "kaypian",
    name: "Kaypian Terminal",
    lat: 14.8370,
    lng: 121.0630,
    address: "Kaypian, San Jose del Monte, Bulacan",
    routes: ["Kaypian – Fairview", "Kaypian – Monumento"],
    type: "Jeepney Terminal",
  },
  {
    id: "paradise-3",
    name: "Paradise III Terminal",
    lat: 14.8290,
    lng: 121.0500,
    address: "Paradise III, San Jose del Monte, Bulacan",
    routes: ["Paradise III – Cubao", "Paradise III – SM Fairview"],
    type: "UV Express Terminal",
  },
  {
    id: "san-manuel-sjdm",
    name: "San Manuel Terminal (SJDM)",
    lat: 14.8450,
    lng: 121.0390,
    address: "San Manuel, San Jose del Monte, Bulacan",
    routes: ["San Manuel – Monumento", "San Manuel – Fairview"],
    type: "Jeepney Terminal",
  },

  // ── Sta. Maria ───────────────────────────────────────────────────
  {
    id: "sta-maria-terminal",
    name: "Sta. Maria Jeepney Terminal",
    lat: 14.8150,
    lng: 120.9597,
    address: "McArthur Highway, Sta. Maria, Bulacan",
    routes: ["Sta. Maria – Monumento", "Sta. Maria – Malolos", "Malinta – Sta. Maria"],
    type: "Jeepney Terminal",
  },
  {
    id: "bulak-terminal",
    name: "Bulak / Baliuag–Malolos Jeepney Terminal",
    lat: 14.7951,
    lng: 120.8786,
    address: "Matungao Street, Bulakan, Bulacan",
    routes: ["Bulakan – Balagtas", "Bulakan – Malolos City"],
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

  // ── Pandi ─────────────────────────────────────────────────────────
  {
    id: "pandi-terminal",
    name: "Pandi Terminal",
    lat: 14.8635,
    lng: 120.9524,
    address: "McArthur Highway, Pandi, Bulacan",
    routes: ["Pandi – Malolos", "Pandi – Bocaue", "Pandi – Trinoma (P2P)"],
    type: "Jeepney / P2P Terminal",
  },

  // ── Balagtas ──────────────────────────────────────────────────────
  {
    id: "balagtas-terminal",
    name: "Balagtas Terminal",
    lat: 14.8162,
    lng: 120.9079,
    address: "McArthur Highway, Balagtas, Bulacan",
    routes: ["Balagtas – Monumento", "Balagtas – Malolos", "Balagtas – Trinoma (P2P)"],
    type: "Jeepney / P2P Terminal",
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

  // ── Malolos ───────────────────────────────────────────────────────
  {
    id: "malolos-central",
    name: "Malolos Central Terminal",
    lat: 14.8430,
    lng: 120.8104,
    address: "Paseo del Congreso, Malolos City, Bulacan",
    routes: ["Malolos – Cubao (NLEX)", "Malolos – Monumento", "Malolos – Tuktukan"],
    type: "Bus / Jeepney Terminal",
  },
  {
    id: "malolos-north",
    name: "Malolos North Bus Terminal",
    lat: 14.8620,
    lng: 120.8130,
    address: "McArthur Highway, Malolos City, Bulacan",
    routes: ["Malolos – Baliuag (via McArthur Hwy)", "Malolos – Calumpit"],
    type: "Bus Terminal",
  },
  {
    id: "malolos-paombong",
    name: "Malolos – Paombong / Hagonoy Terminal",
    lat: 14.8436,
    lng: 120.8088,
    address: "Near Malolos Cathedral, Malolos City, Bulacan",
    routes: ["Malolos – Paombong", "Malolos – Hagonoy"],
    type: "Jeepney Terminal",
  },
  {
    id: "robinsons-malolos",
    name: "Robinsons Malolos Terminal",
    lat: 14.8558,
    lng: 120.8154,
    address: "McArthur Highway, Malolos City, Bulacan",
    routes: ["Robinsons Malolos – Trinoma (P2P)", "Robinsons Malolos – Monumento"],
    type: "P2P / UV Express Terminal",
  },

  // ── Plaridel ──────────────────────────────────────────────────────
  {
    id: "plaridel-terminal",
    name: "Plaridel Terminal",
    lat: 14.8851,
    lng: 120.8594,
    address: "McArthur Highway, Plaridel, Bulacan",
    routes: ["Plaridel – Malolos", "Plaridel – Monumento", "Plaridel – Trinoma (P2P)"],
    type: "Jeepney / P2P Terminal",
  },

  // ── Pulilan ────────────────────────────────────────────────────────
  {
    id: "pulilan-terminal",
    name: "Pulilan Jeepney Terminal",
    lat: 14.8994,
    lng: 120.8473,
    address: "Near 588 Shopping Mall, Pulilan, Bulacan",
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
    lat: 14.8353,
    lng: 120.7314,
    address: "Near Hagonoy Municipal Park, Hagonoy, Bulacan",
    routes: ["Hagonoy – Malolos (via BSU Crossing)", "Hagonoy – Calumpit"],
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

  // ── Meycauayan ───────────────────────────────────────────────────
  {
    id: "meycauayan-terminal",
    name: "Meycauayan Transport Terminal",
    lat: 14.7356,
    lng: 120.9604,
    address: "Valenzuela Road, Meycauayan City, Bulacan",
    routes: ["Meycauayan – Monumento", "Meycauayan – SM Fairview", "Meycauayan – Cubao"],
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
  {
    id: "meycauayan-sm",
    name: "SM Meycauayan Terminal",
    lat: 14.7443,
    lng: 120.9671,
    address: "SM City Meycauayan, Meycauayan City, Bulacan",
    routes: ["SM Meycauayan – Monumento", "SM Meycauayan – Cubao"],
    type: "UV Express Terminal",
  },

  // ── Baliuag ───────────────────────────────────────────────────────
  {
    id: "baliuag-terminal",
    name: "Baliuag Terminal",
    lat: 14.9531,
    lng: 120.8975,
    address: "Rizal Street, Baliuag, Bulacan",
    routes: ["Baliuag – Cubao (NLEX)", "Baliuag – Malolos", "Baliuag – Cabanatuan"],
    type: "Bus / Jeepney Terminal",
  },
  {
    id: "baliuag-crossing",
    name: "Baliuag Crossing Terminal",
    lat: 14.9462,
    lng: 120.9011,
    address: "NLEX Baliuag Exit, Baliuag, Bulacan",
    routes: ["Baliuag – Cubao (via NLEX)", "Baliuag – Monumento"],
    type: "Bus Terminal",
  },

  // ── Bustos ─────────────────────────────────────────────────────────
  {
    id: "bustos-terminal",
    name: "Bustos Terminal",
    lat: 14.9530,
    lng: 120.9178,
    address: "Poblacion, Bustos, Bulacan",
    routes: ["Bustos – Baliuag", "Bustos – Malolos"],
    type: "Jeepney Terminal",
  },

  // ── Angat ──────────────────────────────────────────────────────────
  {
    id: "angat-terminal",
    name: "Angat Terminal",
    lat: 14.9287,
    lng: 121.0155,
    address: "Poblacion, Angat, Bulacan",
    routes: ["Angat – Baliuag", "Angat – San Rafael"],
    type: "Jeepney Terminal",
  },

  // ── Norzagaray ─────────────────────────────────────────────────────
  {
    id: "norzagaray-terminal",
    name: "Norzagaray Terminal",
    lat: 14.9022,
    lng: 121.0523,
    address: "Poblacion, Norzagaray, Bulacan",
    routes: ["Norzagaray – Baliuag", "Norzagaray – Monumento"],
    type: "Jeepney Terminal",
  },

  // ── San Ildefonso ──────────────────────────────────────────────────
  {
    id: "san-ildefonso-terminal",
    name: "San Ildefonso Terminal",
    lat: 15.0712,
    lng: 120.9972,
    address: "Poblacion, San Ildefonso, Bulacan",
    routes: ["San Ildefonso – Baliuag", "San Ildefonso – Malolos"],
    type: "Jeepney Terminal",
  },

  // ── San Miguel ─────────────────────────────────────────────────────
  {
    id: "san-miguel-terminal",
    name: "San Miguel Terminal",
    lat: 15.1329,
    lng: 121.0212,
    address: "Poblacion, San Miguel, Bulacan",
    routes: ["San Miguel – Baliuag", "San Miguel – Cabanatuan (via Nueva Ecija)"],
    type: "Bus / Jeepney Terminal",
  },

  // ── San Rafael ─────────────────────────────────────────────────────
  {
    id: "san-rafael-terminal",
    name: "San Rafael Terminal",
    lat: 14.9851,
    lng: 121.0178,
    address: "Poblacion, San Rafael, Bulacan",
    routes: ["San Rafael – Baliuag", "San Rafael – Angat", "San Rafael – Malolos"],
    type: "Jeepney Terminal",
  },

  // ── Doña Remedios Trinidad ─────────────────────────────────────────
  {
    id: "drt-terminal",
    name: "Doña Remedios Trinidad Terminal",
    lat: 15.0167,
    lng: 121.1167,
    address: "Poblacion, Doña Remedios Trinidad, Bulacan",
    routes: ["DRT – Norzagaray", "DRT – San Ildefonso"],
    type: "Jeepney Terminal",
  },

];

// ── Haversine distance in metres ──────────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
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

export default function Track({ route, navigation }) {
  const { spot } = route.params;
  const { setActiveSpot } = useArrival();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [userLocation, setUserLocation]   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [spotData, setSpotData]           = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [followMode, setFollowMode]       = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState(null);
  const [routeInfo, setRouteInfo]         = useState(null); // { distance, time }

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

  const webViewRef            = useRef(null);
  const webViewReady          = useRef(false);
  const locationSubscription  = useRef(null);
  const isMounted             = useRef(true);

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

  /* ── Update marker + proximity via injectJavaScript ── */
  const updateMarkerRef = useRef(null);
  const updateMarkerOnMap = useCallback((coords) => {
  if (!webViewRef.current || !spotData) return;

  const nearbyIds = TERMINALS
    .filter((t) =>
      haversineDistance(coords.latitude, coords.longitude, t.lat, t.lng) <= 25
    )
    .map((t) => t.id);

  // Check proximity to the destination spot itself
  const dest = getSpotCoords(spotData);
  const nearSpot = dest
    ? haversineDistance(coords.latitude, coords.longitude, dest.lat, dest.lng) <= 99
    : false;

  webViewRef.current.injectJavaScript(`
    (function() {
      try {
        window.updateUserLocation(
          ${coords.latitude},
          ${coords.longitude},
          ${followModeRef.current}
        );
        window.updateProximity(${JSON.stringify(nearbyIds)});
        window.updateSpotProximity(${nearSpot});
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
      } else if (data.type === "route") {
        setRouteInfo({ distance: data.distance, time: data.time });
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

        if (webViewReady.current) {
          updateMarkerRef.current?.(initialCoords);
        }

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

    // Destination pin + route line follow the app's brand colour; the jeepney
    // terminal proximity rings use the yellow accent.
    const hexToRgba = (hex) => {
      const h = hex.replace("#", "");
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      return (a) => `rgba(${r},${g},${b},${a})`;
    };
    const destColor = colors.brand;
    const destRgba = hexToRgba(destColor);
    const termColor = colors.accent;
    const termRgba = hexToRgba(termColor);

    // Map chrome (page/tile background, loading overlay, popups, tooltips)
    // follows the app theme so this screen doesn't flash light-mode colors
    // when opened in dark mode.
    const mapBg      = colors.background;
    const surfaceBg  = colors.card;
    const surfaceText   = colors.textPrimary;
    const surfaceSub    = colors.textSecondary;
    const surfaceBorder = colors.cardBorder;
    const tileUrl = isDark
      ? "https://{s}.basemap.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemap.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    const terminalsJson = JSON.stringify(
      TERMINALS.map(({ id, name, lat, lng }) => ({ id, name, lat, lng }))
    );

    const boundaryJson = JSON.stringify(BULACAN_BOUNDARY);
    const bbox = BULACAN_BBOX;

    return `<!DOCTYPE html><html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        html,body { background:${mapBg}; }
        #map { width:100%; height:100vh; background:${mapBg}; }
        .leaflet-control-attribution { display:none; }
        .leaflet-container { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:${mapBg}; }
        #loading-overlay {
          position:fixed; top:0; left:0; right:0; bottom:0;
          background:${mapBg};
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          z-index:9999;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
          color:${surfaceSub}; font-size:13.5px; font-weight:600; gap:14px;
          letter-spacing:0.2px;
          transition:opacity 0.35s ease;
        }
        .spinner {
          width:34px; height:34px;
          border:3px solid ${destRgba(0.15)};
          border-top-color:${destColor};
          border-radius:50%; animation:spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        .terminal-tooltip {
          background:${surfaceBg};
          border:none;
          border-radius:9px;
          padding:6px 11px;
          font-size:11.5px;
          font-weight:600;
          color:${surfaceText};
          box-shadow:0 6px 18px rgba(11,46,49,0.16);
          white-space:nowrap;
        }
        .terminal-tooltip::before { display:none; }
        /* Cleaner popups */
        .leaflet-popup-content-wrapper {
          background:${surfaceBg};
          border-radius:14px;
          box-shadow:0 10px 30px rgba(11,46,49,0.18);
        }
        .leaflet-popup-content { font-weight:600; color:${surfaceText}; margin:11px 14px; }
        .leaflet-popup-tip { box-shadow:none; }
        /* Route line — rounded joins for a smooth modern stroke */
        .leaflet-routing-container { display:none; }
        path.leaflet-interactive { stroke-linecap:round; stroke-linejoin:round; }
        @keyframes proximity-pulse {
          0%   { opacity:0.7;  transform:scale(0.85); }
          50%  { opacity:0.15; transform:scale(1.15); }
          100% { opacity:0.7;  transform:scale(0.85); }
        }
        @keyframes proximity-ring-spin {
          0%   { opacity:0.9;  transform:scale(0.9);  }
          50%  { opacity:0.25; transform:scale(1.2);  }
          100% { opacity:0.9;  transform:scale(0.9);  }
        }
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
        const BULACAN_RING = ${boundaryJson}; // [ [lat,lng], ... ] — closed

        const bulacanBounds = L.latLngBounds(
          L.latLng(${bbox.south}, ${bbox.west}),
          L.latLng(${bbox.north}, ${bbox.east})
        );
        // maxBounds is looser than the fit target so panning doesn't rubber-band
        // right at the edge of the province.
        const panBounds = L.latLngBounds(
          L.latLng(${(bbox.south - 0.25).toFixed(4)}, ${(bbox.west - 0.25).toFixed(4)}),
          L.latLng(${(bbox.north + 0.25).toFixed(4)}, ${(bbox.east + 0.25).toFixed(4)})
        );

        window.map = L.map('map', {
          maxBounds: panBounds,
          maxBoundsViscosity: 0.9,
          minZoom: 9, maxZoom: 19, zoomControl: false,
        }).fitBounds(bulacanBounds);

        // Modern, low-clutter basemap (CARTO Voyager in light mode, CARTO Dark
        // Matter in dark mode) with a plain-OSM fallback.
        var baseTiles = L.tileLayer(
          '${tileUrl}',
          { subdomains: 'abcd', maxZoom: 20, detectRetina: true }
        );
        baseTiles.on('tileerror', function () {
          if (window._fellBackTiles) return;
          window._fellBackTiles = true;
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
          }).addTo(window.map);
        });
        baseTiles.addTo(window.map);

        // Fade the loading overlay out once (idempotent).
        function hideOverlay() {
          var o = document.getElementById('loading-overlay');
          if (!o || o._gone) return;
          o._gone = true;
          o.style.opacity = '0';
          setTimeout(function () { o.style.display = 'none'; }, 400);
        }

        // Safety net: never leave the spinner up forever if a slow network call
        // (routing) hangs — the base map itself is already usable.
        setTimeout(hideOverlay, 6000);

        window.map.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapTapped' }));
        });

        // ── Bulacan focus mask ──
        // The province outline is bundled with the app (utils/bulacanBoundary.js),
        // so the cut is always the real Bulacan shape — no live boundary fetch,
        // no rectangular fallback.
        L.polygon(
          [[ [-90,-180],[-90,180],[90,180],[90,-180],[-90,-180] ], BULACAN_RING],
          { fillColor:'${mapBg}', fillOpacity:0.55, stroke:false, interactive:false }
        ).addTo(window.map);
        L.polyline(BULACAN_RING, {
          color:'${destColor}', weight:2.5, opacity:0.65,
          dashArray:'2 8', lineCap:'round',
        }).addTo(window.map);

        // ── Destination marker — clean teardrop pin with a soft shadow ──
        const destIcon = L.divIcon({
          html: [
            '<svg width="36" height="46" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg"',
            ' style="filter:drop-shadow(0 5px 8px rgba(11,46,49,0.35));">',
            '<path d="M18 1C9 1 1.5 8.3 1.5 17.4 1.5 29 18 45 18 45s16.5-16 16.5-27.6C34.5 8.3 27 1 18 1z"',
            ' fill="${destColor}" stroke="#fff" stroke-width="2.5"/>',
            '<circle cx="18" cy="17.4" r="6" fill="#fff"/>',
            '</svg>',
          ].join(''),
          className:'', iconSize:[36,46], iconAnchor:[18,45], popupAnchor:[0,-38]
        });
        window.destMarker = L.marker([DEST_LAT, DEST_LNG], { icon: destIcon })
          .addTo(window.map).bindPopup(SPOT_NAME);

        // Core map is ready now — drop the spinner (boundary polygon keeps
        // loading in the background).
        hideOverlay();
          // ── Spot proximity ring ──
var spotPulseIcon = L.divIcon({
  html: [
    '<div class="spot-prox-wrap" style="display:none;position:relative;width:64px;height:64px;">',
      '<div style="',
        'position:absolute;inset:0;border-radius:50%;',
        'border:3px solid ${destColor};',
        'background:${destRgba(0.18)};',
        'animation:proximity-pulse 1.4s ease-in-out infinite;',
      '"></div>',
      '<div style="',
        'position:absolute;inset:8px;border-radius:50%;',
        'border:2px solid ${destRgba(0.6)};',
        'animation:proximity-ring-spin 1.4s ease-in-out infinite 0.3s;',
      '"></div>',
    '</div>',
  ].join(''),
  className: '',
  iconSize: [64, 64],
  iconAnchor: [32, 32],
});
var spotPulseMarker = L.marker([DEST_LAT, DEST_LNG], {
  icon: spotPulseIcon,
  interactive: false,
  zIndexOffset: -100,
}).addTo(window.map);

var spotFillCircle = L.circle([DEST_LAT, DEST_LNG], {
  radius: 99,
  color: '${destColor}',
  fillColor: '${destColor}',
  fillOpacity: 0,
  opacity: 0,
  weight: 2,
  interactive: false,
}).addTo(window.map);

window.updateSpotProximity = function(active) {
  spotFillCircle.setStyle({
    opacity:     active ? 0.85 : 0,
    fillOpacity: active ? 0.2  : 0,
  });
  var el = spotPulseMarker.getElement();
  if (el) {
    var wrap = el.querySelector('.spot-prox-wrap');
    if (wrap) wrap.style.display = active ? 'block' : 'none';
  }
};

        // ── Terminal markers — clean white chip with a bus glyph ──
        var busIconHtml = [
          '<div style="width:30px;height:30px;border-radius:50%;background:#fff;',
            'border:2px solid ${termColor};box-shadow:0 4px 10px rgba(11,46,49,0.22);',
            'display:flex;align-items:center;justify-content:center;">',
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
              '<path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a2 2 0 0 1-1 1.7V18a1 1 0 0 1-2 0v-1H7v1a1 1 0 0 1-2 0v-1.3A2 2 0 0 1 4 15V7z"',
              ' fill="${destColor}"/>',
              '<rect x="6" y="7" width="12" height="4" rx="1" fill="#fff"/>',
              '<circle cx="8" cy="14" r="1.3" fill="#fff"/>',
              '<circle cx="16" cy="14" r="1.3" fill="#fff"/>',
            '</svg>',
          '</div>',
        ].join('');

        const terminalIcon = L.divIcon({
          html: busIconHtml,
          className: '',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        TERMINALS.forEach(function(t) {
          const marker = L.marker([t.lat, t.lng], { icon: terminalIcon })
            .addTo(window.map);
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

        // ── Proximity pulse rings (one per terminal, hidden by default) ──
        window.proximityMarkers = {};
        TERMINALS.forEach(function(t) {
          // Outer soft fill circle (Leaflet vector — scales with zoom)
          var fillCircle = L.circle([t.lat, t.lng], {
            radius: 25,
            color: '${termColor}',
            fillColor: '${termColor}',
            fillOpacity: 0,
            opacity: 0,
            weight: 2,
            interactive: false,
          }).addTo(window.map);

          // Animated div overlay (CSS pulse)
          var pulseIcon = L.divIcon({
            html: [
              '<div class="prox-wrap" style="display:none;position:relative;width:64px;height:64px;">',
                '<div class="prox-ring prox-ring-1" style="',
                  'position:absolute;inset:0;border-radius:50%;',
                  'border:3px solid ${termColor};',
                  'background:${termRgba(0.22)};',
                  'animation:proximity-pulse 1.4s ease-in-out infinite;',
                '"></div>',
                '<div class="prox-ring prox-ring-2" style="',
                  'position:absolute;inset:8px;border-radius:50%;',
                  'border:2px solid ${termRgba(0.6)};',
                  'animation:proximity-ring-spin 1.4s ease-in-out infinite 0.3s;',
                '"></div>',
              '</div>',
            ].join(''),
            className: '',
            iconSize: [64, 64],
            iconAnchor: [32, 32],
          });

          var pulseMarker = L.marker([t.lat, t.lng], {
            icon: pulseIcon,
            interactive: false,
            zIndexOffset: -100,
          }).addTo(window.map);

          window.proximityMarkers[t.id] = { fillCircle, pulseMarker };
        });

        // Called from React Native on every location update
        window.updateProximity = function(nearbyIds) {
          Object.keys(window.proximityMarkers).forEach(function(id) {
            var entry  = window.proximityMarkers[id];
            var active = nearbyIds.indexOf(id) !== -1;

            // Toggle vector circle
            entry.fillCircle.setStyle({
              opacity:     active ? 0.85 : 0,
              fillOpacity: active ? 0.2  : 0,
            });

            // Toggle CSS pulse wrapper
            var el = entry.pulseMarker.getElement();
            if (el) {
              var wrap = el.querySelector('.prox-wrap');
              if (wrap) wrap.style.display = active ? 'block' : 'none';
            }
          });
        };

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
            lineOptions: { styles:[
              { color:'#FFFFFF', weight:10, opacity:0.95 },
              { color:'${destColor}', weight:5.5, opacity:1 },
            ] },
            createMarker: () => null,
            addWaypoints: false, routeWhileDragging: false,
            show: false, fitSelectedRoutes: false,
          }).addTo(window.map);

          // Surface distance / ETA to React Native for the floating card.
          window.routingControl.on('routesfound', function (e) {
            var r = e.routes && e.routes[0];
            if (!r || !r.summary) return;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'route',
              distance: r.summary.totalDistance,
              time: r.summary.totalTime,
            }));
          });

          if (Math.abs(lat - DEST_LAT) > 1e-5 || Math.abs(lng - DEST_LNG) > 1e-5) {
            window.map.fitBounds(
              L.latLngBounds([lat, lng], [DEST_LAT, DEST_LNG]),
              { padding:[80,80] }
            );
          } else {
            window.map.setView([DEST_LAT, DEST_LNG], 16);
          }

          window._lastRoutedAt = Date.now();
          window._lastRoutedPt = [lat, lng];
          window.mapReady = true;
        };

        window.updateUserLocation = function(lat, lng, follow) {
          if (!window.mapReady) {
            window.initUserLocation(lat, lng);
            return;
          }
          if (window.userMarker) window.userMarker.setLatLng([lat, lng]);

          // Re-route only when the user has actually moved (~45 m) and not more
          // often than every 15 s — the OSRM demo router rate-limits, and a
          // request per GPS tick makes the route line flicker / vanish.
          if (window.routingControl) {
            var far = !window._lastRoutedPt ||
              Math.hypot(lat - window._lastRoutedPt[0], lng - window._lastRoutedPt[1]) > 0.0004;
            var due = !window._lastRoutedAt || (Date.now() - window._lastRoutedAt > 15000);
            if (far && due) {
              window._lastRoutedAt = Date.now();
              window._lastRoutedPt = [lat, lng];
              window.routingControl.setWaypoints([
                L.latLng(lat, lng),
                L.latLng(DEST_LAT, DEST_LNG)
              ]);
            }
          }
          if (follow && window.map) window.map.panTo([lat, lng], { animate:true });
        };
      </script>
    </body></html>`;
  }, [spotData, colors, isDark]);

  if (loading || !spotData) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingBadge, { backgroundColor: colors.brandSoft }]}>
          <Feather name="map" size={26} color={colors.brand} />
        </View>
        <ActivityIndicator size="small" color={colors.brand} style={{ marginTop: 20 }} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {!spotData ? "Loading spot details…" : "Finding your location…"}
        </Text>
      </View>
    );
  }
  if (locationError || !getSpotCoords(spotData)) {
    const msg = locationError || "Location coordinates aren't available for this spot yet.";
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingBadge, { backgroundColor: colors.dangerBg }]}>
          <Feather name="alert-triangle" size={24} color={colors.danger} />
        </View>
        <Text style={[styles.errorText, { color: colors.textSecondary, marginTop: 18 }]}>{msg}</Text>
        <TouchableOpacity
          style={[styles.backButtonError, { backgroundColor: colors.accent }, shadow.sm]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={[styles.backButtonText, { color: colors.onAccent }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [340, 0],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: mapHTML }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleWebViewMessage}
        onError={(e) => console.error("WebView error:", e.nativeEvent)}
        onLoadStart={() => { webViewReady.current = false; }}
        onLoadEnd={() => {
          webViewReady.current = true;
          if (userLocation) {
            updateMarkerRef.current?.(userLocation);
          }
        }}
      />

      {/* Floating top bar — back button + title chip */}
      <View style={[styles.topBar, { top: insets.top + 10 }]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.circleBtn, { backgroundColor: colors.background }, shadow.md]}
          activeOpacity={0.8}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={22} color={colors.brand} />
        </TouchableOpacity>

        <View style={[styles.titleChip, { backgroundColor: colors.background }, shadow.md]}>
          <Feather name="map-pin" size={13} color={colors.brand} />
          <Text style={[styles.titleChipText, { color: colors.textPrimary }]} numberOfLines={1}>
            {spotData.name}
          </Text>
        </View>
      </View>

      {/* Floating controls — ETA card (left) + recenter FAB (right) */}
      <View
        style={[styles.controlsRow, { bottom: insets.bottom + 24 }]}
        pointerEvents="box-none"
      >
        {routeInfo ? (
          <View style={[styles.etaCard, { backgroundColor: colors.background }, shadow.lg]}>
            <View style={[styles.etaIcon, { backgroundColor: colors.brand }]}>
              <Feather name="navigation-2" size={15} color={colors.onBrand} />
            </View>
            <View style={styles.etaText}>
              <Text style={[styles.etaPrimary, { color: colors.textPrimary }]} numberOfLines={1}>
                {fmtDistance(routeInfo.distance)} · {fmtDuration(routeInfo.time)}
              </Text>
              <Text style={[styles.etaSecondary, { color: colors.textMuted }]} numberOfLines={1}>
                to {spotData.name}
              </Text>
            </View>
          </View>
        ) : (
          <View />
        )}

        <TouchableOpacity
          style={[
            styles.circleBtn,
            styles.fab,
            { backgroundColor: followMode ? colors.brand : colors.background },
            shadow.lg,
          ]}
          onPress={handleCenterOnMe}
          activeOpacity={0.85}
        >
          <Feather
            name="navigation"
            size={21}
            color={followMode ? colors.onBrand : colors.brand}
          />
        </TouchableOpacity>
      </View>

      {/* Terminal Place Sheet */}
      {selectedTerminal && (
        <>
          <TouchableOpacity
            style={[styles.scrim, { backgroundColor: colors.overlay }]}
            activeOpacity={1}
            onPress={hideSheet}
          />
          <Animated.View
            style={[styles.sheet, { backgroundColor: colors.card, transform: [{ translateY: sheetTranslateY }] }]}
            {...panResponder.panHandlers}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />

            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIconWrap, { backgroundColor: colors.brand }]}>
                <Feather name="truck" size={20} color={colors.onBrand} />
              </View>
              <View style={styles.sheetTitleBlock}>
                <Text style={[styles.sheetName, { color: colors.textPrimary }]} numberOfLines={2}>
                  {selectedTerminal.name}
                </Text>
                <Text style={[styles.sheetType, { color: colors.textSecondary }]}>{selectedTerminal.type}</Text>
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={hideSheet} hitSlop={8}>
                <Feather name="x" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetRow}>
              <Feather name="map-pin" size={15} color={colors.brand} style={styles.sheetRowIcon} />
              <Text style={[styles.sheetRowText, { color: colors.textPrimary }]}>{selectedTerminal.address}</Text>
            </View>

            <View style={[styles.sheetDivider, { backgroundColor: colors.divider }]} />
            <Text style={[styles.sheetSectionLabel, { color: colors.textMuted }]}>Routes served</Text>
            {selectedTerminal.routes.map((r, i) => (
              <View key={i} style={styles.sheetRow}>
                <Feather name="arrow-right-circle" size={15} color={colors.brand} style={styles.sheetRowIcon} />
                <Text style={[styles.sheetRowText, { color: colors.textPrimary }]}>{r}</Text>
              </View>
            ))}

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetActionBtn, { backgroundColor: colors.accent }]}
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
                <Feather name="crosshair" size={16} color={colors.onAccent} />
                <Text style={[styles.sheetActionPrimaryText, { color: colors.onAccent }]}>Show on map</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, { backgroundColor: colors.brandLight }]}
                activeOpacity={0.85}
                onPress={hideSheet}
              >
                <Text style={[styles.sheetActionSecondaryText, { color: colors.textSecondary }]}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // backgroundColor is applied at render from the active theme (see the
  // container <View> above) — no hardcoded light value here, so dark mode
  // doesn't flash a pale background.
  container: {
    flex: 1,
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
    paddingHorizontal: 40,
  },
  loadingBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  errorText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  backButtonError: {
    marginTop: 22,
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  // ── Floating top bar ──
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  titleChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  titleChipText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  // ── Floating bottom controls ──
  controlsRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  etaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    maxWidth: width - 100,
  },
  etaIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  etaText: { flexShrink: 1 },
  etaPrimary: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  etaSecondary: { fontSize: 11.5, fontWeight: "500", marginTop: 1 },

  // ── Bottom sheet ──
  // NOTE: no default backgroundColor here — the scrim, and the color values
  // below it, are supplied inline from the theme at render time so this
  // screen matches light/dark mode instead of hardcoded light-mode colors.
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
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 22,
    paddingBottom: 36,
    shadowColor: "#0B2E31",
    shadowOpacity: 0.16,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
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
    borderRadius: 14,
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
    lineHeight: 22,
  },
  sheetType: {
    fontSize: 13,
    marginTop: 2,
  },
  sheetClose: {
    padding: 4,
    flexShrink: 0,
  },
  sheetDivider: {
    height: 1,
    marginVertical: 12,
  },
  sheetSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
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
    paddingVertical: 14,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  sheetActionPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
  },
  sheetActionSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
});