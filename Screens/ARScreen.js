import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

// ─── Config ───────────────────────────────────────────────────────────────────
const AR_URL       = 'https://ar-web-lemon.vercel.app/index.html';
const API_URL      = 'https://libotbackend.onrender.com/api/spots';
const COLLECT_URL  = 'https://libotbackend.onrender.com/api/collections';
const RANGE_METERS = 999999; // TODO: set back to 500 for production

// ─── Haversine distance ───────────────────────────────────────────────────────
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

// ─── Map API spot → AR location object ───────────────────────────────────────
function mapLandmarkToARLocation(item) {
  const rawUrl =
    item.ARModelUrl    ||
    item.AR3DModelURL  ||
    item.arModelUrl    ||
    '';
  const modelUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!modelUrl) return [];

  const mc = item.modelsCoordinates;
  const co = item.coordinates;

  const mcArr = Array.isArray(mc) ? mc : (mc ? [mc] : []);
  const fallback = co ? [co] : [];
  const coordList = mcArr.length ? mcArr : fallback;

  const rangeLat = parseFloat(co?.lat);
  const rangeLng = parseFloat(co?.lng);

  return coordList.map((coord, i) => {
    const arLat = parseFloat(coord?.lat);
    const arLng = parseFloat(coord?.lng);
    if (isNaN(arLat) || isNaN(arLng)) return null;

    return {
      id:          `${String(item._id ?? item.name)}_${i}`,
      name:        item.name ?? 'Unknown',
      modelUrl,
      latitude:    arLat,
      longitude:   arLng,
      landmarkLat: isNaN(rangeLat) ? arLat : rangeLat,
      landmarkLng: isNaN(rangeLng) ? arLng : rangeLng,
    };
  }).filter(Boolean);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ARScreen({ navigation }) {
  const webviewRef = useRef(null);
  const { user }   = useAuth();

  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError,    setPermissionError]    = useState(null);

  const [webviewLoaded, setWebviewLoaded] = useState(false);
  const [arReady,       setArReady]       = useState(false);

  const [locations,  setLocations]  = useState([]);
  const [nearbyLocs, setNearbyLocs] = useState([]);

  const [fetchError,   setFetchError]   = useState(null);
  const [collectedIds, setCollectedIds] = useState(new Set());

  const [showInfoModal, setShowInfoModal] = useState(true);

  // ─── Auth header helper ───────────────────────────────────────────────────
  const authHeaders = useCallback(async () => {
    const token = await AsyncStorage.getItem('userToken');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  // ─── Permissions ─────────────────────────────────────────────────────────
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
      fetchLocations();
      fetchCollectedIds();
    } catch (err) {
      setPermissionError('Failed to request permissions: ' + err.message);
    }
  };

  // ─── Fetch landmarks ──────────────────────────────────────────────────────
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

      const mapped = raw.flatMap(mapLandmarkToARLocation);
      console.log('[AR] Total spots from API:', raw.length, '| With AR model:', mapped.length);
      console.log('[AR] Mapped spots:', JSON.stringify(mapped));
      setLocations(mapped);
      if (!mapped.length) setFetchError('No AR models found. Check ARModelUrl field in DB.');
    } catch (err) {
      setFetchError('Could not load AR locations: ' + err.message);
    }
  };

  // ─── Fetch collected IDs ──────────────────────────────────────────────────
  const fetchCollectedIds = async () => {
    if (!user) return;
    try {
      const headers = await authHeaders();
      const res     = await fetch(COLLECT_URL, { headers });
      if (!res.ok) return;
      const json  = await res.json();
      const items = Array.isArray(json)      ? json
                  : Array.isArray(json.data) ? json.data
                  : [];
      setCollectedIds(new Set(items.map((i) => i.spotId ?? i._id ?? String(i))));
    } catch (_) {}
  };

  // ─── Range check ─────────────────────────────────────────────────────────
  const checkRange = useCallback(async (locs) => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude: uLat, longitude: uLng } = pos.coords;
      const nearby = locs.filter((loc) => {
        if (isNaN(loc.landmarkLat) || isNaN(loc.landmarkLng)) return false;
        return getDistanceMeters(uLat, uLng, loc.landmarkLat, loc.landmarkLng) <= RANGE_METERS;
      });
      console.log('[AR] Nearby spots within range:', nearby.length, 'of', locs.length);
      setNearbyLocs(nearby);
    } catch (_) {
      // If location check fails, show all locations
      console.log('[AR] Location check failed — showing all', locs.length, 'spots');
      setNearbyLocs(locs);
    }
  }, []);

  useEffect(() => {
    if (permissionsGranted && locations.length) {
      checkRange(locations);
    }
  }, [permissionsGranted, locations, checkRange]);

  // ─── Inject locations into WebView ───────────────────────────────────────
  // ✅ FIX: Use injectJavaScript to call window.receiveARConfig directly.
  // The window.postMessage / dispatchEvent approach is unreliable in React
  // Native WebView because the injected JS runs in a different context.
  // Calling a pre-defined global function is the most reliable method.
  const injectLocations = useCallback((locs, alreadyCollected) => {
    if (!webviewRef.current) return;

    const fresh = locs.filter((l) => !alreadyCollected.has(l.id));
    if (!fresh.length) return;

    const locJson = JSON.stringify(fresh);

    // Primary: call the global function defined in the HTML
    const script = `
      (function() {
        try {
          if (typeof window.receiveARConfig === 'function') {
            window.receiveARConfig(${locJson});
          } else {
            // Fallback: dispatch a MessageEvent
            window.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify({ type: 'AR_CONFIG', locations: ${locJson} })
            }));
          }
        } catch(e) {
          console.error('[ARScreen inject error]', e);
        }
      })();
      true;
    `;

    webviewRef.current.injectJavaScript(script);
  }, []);

  // ─── WebView load handler ─────────────────────────────────────────────────
  const onWebViewLoad = useCallback(() => {
    setWebviewLoaded(true);
    // Don't inject here — wait for AR_READY signal from the scene
    // to ensure A-Frame and GPS are fully initialised first.
  }, []);

  // ─── Inject when both arReady + nearbyLocs are available ─────────────────
  useEffect(() => {
    if (arReady && nearbyLocs.length) {
      injectLocations(nearbyLocs, collectedIds);
    }
  }, [arReady, nearbyLocs, collectedIds, injectLocations]);

  // Safety timeout: mark AR ready after 12s even if AR_READY never arrives
  useEffect(() => {
    if (!webviewLoaded) return;
    const timer = setTimeout(() => {
      setArReady(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [webviewLoaded]);

  // ─── Save collection to backend ──────────────────────────────────────────
  const saveCollection = useCallback(async (modelId) => {
    if (!user) return;
    try {
      const headers = await authHeaders();
      await fetch(COLLECT_URL, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ spotId: modelId }),
      });
      setCollectedIds((prev) => new Set([...prev, modelId]));
    } catch (_) {}
  }, [user, authHeaders]);

  // ─── Messages from WebView ────────────────────────────────────────────────
  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'AR_READY') {
        setArReady(true);
        // Inject immediately on AR_READY — this is the most reliable timing
        if (nearbyLocs.length) {
          injectLocations(nearbyLocs, collectedIds);
        }
      }

      if (data.type === 'AR_COLLECTED') {
        saveCollection(data.modelId);
      }
    } catch (_) {}
  }, [nearbyLocs, collectedIds, injectLocations, saveCollection]);

  // ─── Permission error screen ──────────────────────────────────────────────
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

  // ─── Render ───────────────────────────────────────────────────────────────
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
          // ✅ Required for Android: allows WebView to access camera & location
          androidLayerType="hardware"
          mixedContentMode="always"
          onError={(e) =>
            setFetchError('WebView error: ' + e.nativeEvent.description)
          }
        />
      )}

      {/* Loading overlay */}
      {!arReady && permissionsGranted && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00ff88" />
          <Text style={styles.loadingText}>Loading AR scene…</Text>
          {fetchError && (
            <Text style={styles.warnText}>⚠️ {fetchError}</Text>
          )}
        </View>
      )}

      {/* One-time info modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>📍</Text>
            <Text style={styles.modalTitle}>AR Mode Active</Text>
            <Text style={styles.modalMsg}>
              3D models will only appear when you are within range of a selected landmark area.
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  warnText: {
    color: '#ffcc00', fontSize: 12, textAlign: 'center', paddingHorizontal: 24,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 28,
    marginHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalIcon:  { fontSize: 44, marginBottom: 14 },
  modalTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700',
    marginBottom: 10, textAlign: 'center',
  },
  modalMsg: {
    color: '#aaa', fontSize: 13, textAlign: 'center',
    lineHeight: 20, marginBottom: 28, paddingHorizontal: 8,
  },
  modalBtn: {
    backgroundColor: '#00ff88',
    paddingVertical: 12, paddingHorizontal: 48, borderRadius: 24,
  },
  modalBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },

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