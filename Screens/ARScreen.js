import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext'; // adjust path as needed

// ─── Config ───────────────────────────────────────────────────────────────────
const AR_URL        = 'https://ar-web-lemon.vercel.app/index.html';
const API_URL       = 'https://libotbackend.onrender.com/api/spots';
// POST   /api/collections        { spotId }   → save collection
// GET    /api/collections        → [{ spotId, collectedAt }]
const COLLECT_URL   = 'https://libotbackend.onrender.com/api/collections';
const RANGE_METERS  = 500; // must be within 500 m of landmark to see its model

// ─── Haversine distance ────────────────────────────────────────────────────────
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R  = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a  =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Map API spot → AR location object ────────────────────────────────────────
// Both modelsCoordinates and coordinates are plain numbers in the DB.
// We use coordinates for the range check and modelsCoordinates for AR
// placement, falling back to the other if either is missing.
function mapLandmarkToARLocation(item) {
  if (!item.modelUrl) return null;

  const mc = item.modelsCoordinates;
  const co = item.coordinates;

  const arLat    = mc?.lat ?? co?.lat;
  const arLng    = mc?.lng ?? co?.lng;
  const rangeLat = co?.lat ?? arLat;
  const rangeLng = co?.lng ?? arLng;

  if (arLat == null || arLng == null) return null;

  return {
    id:          item._id?.$oid ?? String(item._id) ?? item.name,
    name:        item.name ?? 'Unknown',
    modelUrl:    item.modelUrl,
    latitude:    (mc.lat),
    longitude:   (mc.lng),
    landmarkLat: item.coordinates?.lat ?? null,
    landmarkLng: item.coordinates?.lng ?? null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ARScreen({ navigation }) {
  const webviewRef = useRef(null);
  const { user }   = useAuth(); // { _id, token, … }

  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError,    setPermissionError]    = useState(null);

  const [webviewLoaded, setWebviewLoaded] = useState(false);
  const [arReady,       setArReady]       = useState(false);

  // All landmark locations from API
  const [locations,  setLocations]  = useState([]);
  // Only the ones within RANGE_METERS of the user
  const [nearbyLocs, setNearbyLocs] = useState([]);

  const [fetchError,   setFetchError]   = useState(null);
  const [outOfRange,   setOutOfRange]   = useState(false);
  const [rangeChecked, setRangeChecked] = useState(false);

  // IDs already collected by this user (loaded from backend on mount)
  const [collectedIds, setCollectedIds] = useState(new Set());

  // ─── Auth header helper ──────────────────────────────────────────────────────
  const authHeaders = useCallback(async () => {
    const token = await AsyncStorage.getItem('userToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  // ─── Permissions ─────────────────────────────────────────────────────────────
  useEffect(() => { requestPermissions(); }, []);

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const cam = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        if (cam !== PermissionsAndroid.RESULTS.GRANTED) {
          setPermissionError('Camera permission is required for AR.');
          return;
        }
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionError('Location permission is required for AR.');
        return;
      }
      setPermissionsGranted(true);
      // Kick off both fetches in parallel
      fetchLocations();
      fetchCollectedIds();
    } catch (err) {
      setPermissionError('Failed to request permissions: ' + err.message);
    }
  };

  // ─── Fetch landmarks from API ─────────────────────────────────────────────────
  const fetchLocations = async () => {
    try {
      const res  = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const raw = Array.isArray(json)        ? json
                : Array.isArray(json.data)   ? json.data
                : Array.isArray(json.spots)  ? json.spots
                : Array.isArray(json.result) ? json.result
                : null;

      if (!raw) throw new Error(`Unexpected API shape — keys: ${Object.keys(json)}`);

      const mapped = raw.map(mapLandmarkToARLocation).filter(Boolean);
      setLocations(mapped);
      if (!mapped.length) setFetchError('No landmarks with model coordinates found.');
    } catch (err) {
      setFetchError('Could not load AR locations: ' + err.message);
    }
  };

  // ─── Fetch already-collected IDs for this user ────────────────────────────────
  const fetchCollectedIds = async () => {
    if (!user) return; // not logged in → nothing to load
    try {
      const headers = await authHeaders();
      const res     = await fetch(COLLECT_URL, { headers });
      if (!res.ok) return; // silently ignore — don't block AR
      const json = await res.json();
      const items = Array.isArray(json)      ? json
                  : Array.isArray(json.data) ? json.data
                  : [];
      setCollectedIds(new Set(items.map((i) => i.spotId ?? i._id ?? String(i))));
    } catch (_) {
      // Non-critical — if this fails, the user may re-see already-collected models.
      // They simply can't re-collect them (backend will reject the duplicate).
    }
  };

  // ─── Range check: filter to nearby landmarks ──────────────────────────────────
  const checkRange = useCallback(async (locs) => {
    setRangeChecked(false);
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude: uLat, longitude: uLng } = pos.coords;

      const nearby = locs.filter((loc) => {
        // landmarkLat/Lng are guaranteed floats from mapLandmarkToARLocation
        if (isNaN(loc.landmarkLat) || isNaN(loc.landmarkLng)) return false;
        return getDistanceMeters(uLat, uLng, loc.landmarkLat, loc.landmarkLng) <= RANGE_METERS;
      });

      setNearbyLocs(nearby);
      setOutOfRange(nearby.length === 0);
    } catch (_) {
      // GPS failed → fall back to showing all locations
      setNearbyLocs(locs);
      setOutOfRange(false);
    } finally {
      setRangeChecked(true);
    }
  }, []);

  // Run range check once we have permissions + locations
  useEffect(() => {
    if (permissionsGranted && locations.length && !rangeChecked) {
      checkRange(locations);
    }
  }, [permissionsGranted, locations, rangeChecked, checkRange]);

  // ─── Inject ONLY nearby, uncollected locations into the WebView ──────────────
  const injectLocations = useCallback((locs, alreadyCollected) => {
    if (!webviewRef.current) return;

    // Strip out anything the user has already collected
    const fresh = locs.filter((l) => !alreadyCollected.has(l.id));

    const script = `
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'AR_CONFIG',
          locations: ${JSON.stringify(fresh)}
        })
      }));
      true;
    `;
    webviewRef.current.injectJavaScript(script);
  }, []);

  const onWebViewLoad = useCallback(() => {
    setWebviewLoaded(true);
    // Inject whatever we have at load time (may be empty if still fetching)
    if (nearbyLocs.length) injectLocations(nearbyLocs, collectedIds);
  }, [nearbyLocs, collectedIds, injectLocations]);

  // Re-inject whenever nearby locations or collected IDs update after load
  useEffect(() => {
    if (webviewLoaded && nearbyLocs.length) {
      injectLocations(nearbyLocs, collectedIds);
    }
  }, [nearbyLocs, collectedIds, webviewLoaded, injectLocations]);

  // Safety timeout: show AR after 10 s even if AR_READY never fires
  useEffect(() => {
    if (!webviewLoaded) return;
    const timer = setTimeout(() => setArReady(true), 10000);
    return () => clearTimeout(timer);
  }, [webviewLoaded]);

  // ─── Save a collected model to the backend ────────────────────────────────────
  const saveCollection = useCallback(async (modelId) => {
    if (!user) return; // not logged in → skip persistence
    try {
      const headers = await authHeaders();
      await fetch(COLLECT_URL, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ spotId: modelId }),
      });
      // Update local set so a re-inject won't show the model again
      setCollectedIds((prev) => new Set([...prev, modelId]));
    } catch (_) {
      // Non-critical — collected state is already tracked in the WebView
    }
  }, [user, authHeaders]);

  // ─── Messages from WebView ────────────────────────────────────────────────────
  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'AR_READY') {
        setArReady(true);
        // Now that AR is ready, inject locations (in case they arrived first)
        if (nearbyLocs.length) injectLocations(nearbyLocs, collectedIds);
      }

      if (data.type === 'AR_COLLECTED') {
        saveCollection(data.modelId);
      }
    } catch (_) {}
  }, [nearbyLocs, collectedIds, injectLocations, saveCollection]);

  // ─── Permission error screen ──────────────────────────────────────────────────
  if (permissionError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>📵</Text>
        <Text style={styles.errorTitle}>Permissions Required</Text>
        <Text style={styles.errorMsg}>{permissionError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={requestPermissions}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Overlay logic ────────────────────────────────────────────────────────────
  // Show overlay until AR is confirmed ready
  const showLoadingOverlay = !arReady && permissionsGranted;
  const showOutOfRange     = rangeChecked && outOfRange;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* AR WebView — full screen */}
      {permissionsGranted && (
        <WebView
          ref={webviewRef}
          source={{ uri: AR_URL }}
          style={StyleSheet.absoluteFill}
          onLoad={onWebViewLoad}
          onMessage={onMessage}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          geolocationEnabled={true}
          originWhitelist={['*']}
          allowsProtectedMedia={true}
          backgroundColor="black"
          onError={(e) =>
            setFetchError('WebView error: ' + e.nativeEvent.description)
          }
        />
      )}

      {/* Loading / out-of-range overlay */}
      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          {showOutOfRange ? (
            <>
              <Text style={styles.outOfRangeIcon}>📍</Text>
              <Text style={styles.outOfRangeTitle}>
                No landmarks nearby
              </Text>
              <Text style={styles.outOfRangeMsg}>
                Move within {RANGE_METERS} m of a landmark to see AR models.
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setRangeChecked(false);
                  checkRange(locations);
                }}
              >
                <Text style={styles.retryText}>Check Again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#00ff88" />
              <Text style={styles.loadingText}>
                {!rangeChecked ? 'Acquiring GPS signal…' : 'Loading AR scene…'}
              </Text>
              {fetchError && (
                <Text style={styles.warnText}>⚠️ {fetchError}</Text>
              )}
            </>
          )}
        </View>
      )}

      {/* Back button */}
      {navigation && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '500', marginTop: 10 },

  outOfRangeIcon:  { fontSize: 52, marginBottom: 8 },
  outOfRangeTitle: {
    color: '#fff', fontSize: 20, fontWeight: '700',
    marginBottom: 8, textAlign: 'center',
  },
  outOfRangeMsg: {
    color: '#aaa', fontSize: 13, textAlign: 'center',
    paddingHorizontal: 32, marginBottom: 24,
  },
  warnText: {
    color: '#ffcc00', fontSize: 12, textAlign: 'center', paddingHorizontal: 24,
  },

  errorContainer: {
    flex: 1, backgroundColor: '#0a0a0a',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  errorIcon:  { fontSize: 56, marginBottom: 16 },
  errorTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  errorMsg:   { color: '#aaa', fontSize: 14, textAlign: 'center', marginBottom: 28 },

  retryBtn: {
    backgroundColor: '#00ff88',
    paddingVertical: 12, paddingHorizontal: 32, borderRadius: 24,
  },
  retryText: { color: '#000', fontWeight: '700', fontSize: 15 },

  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  backButtonText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
});
