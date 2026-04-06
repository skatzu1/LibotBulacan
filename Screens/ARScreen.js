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
import * as Location from 'expo-location'; // ← Expo-compatible geolocation

// ─── Config ──────────────────────────────────────────────────────────────────
const AR_URL       = 'https://ar-web-lemon.vercel.app/index.html';
const API_URL      = 'https://libotbackend.onrender.com/api/spots';
const RANGE_METERS = 500;

// ─── Haversine distance ───────────────────────────────────────────────────────
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R  = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 +
             Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Map API landmark → AR location ──────────────────────────────────────────
function mapLandmarkToARLocation(item) {
  const mc = item.modelsCoordinates;
  if (!mc || mc.lat == null || mc.lng == null) return null;
  if (!item.modelUrl) return null;

  return {
    id:          item._id?.$oid ?? String(item._id) ?? item.name,
    name:        item.name ?? 'Unknown',
    modelUrl:    item.modelUrl,
    latitude:    parseFloat(mc.lat),
    longitude:   parseFloat(mc.lng),
    landmarkLat: item.coordinates?.lat ?? null,
    landmarkLng: item.coordinates?.lng ?? null,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ARScreen({ navigation }) {
  const webviewRef = useRef(null);

  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError,    setPermissionError]    = useState(null);

  // Fix #2: separate "webview loaded" from "AR scene ready"
  const [webviewLoaded, setWebviewLoaded] = useState(false);
  const [arReady,       setArReady]       = useState(false);

  const [locations,   setLocations]   = useState([]);
  const [fetchError,  setFetchError]  = useState(null);
  const [outOfRange,  setOutOfRange]  = useState(false);
  const [rangeChecked, setRangeChecked] = useState(false);

  // ─── Permissions ───────────────────────────────────────────────────────────
  useEffect(() => { requestPermissions(); }, []);

  const requestPermissions = async () => {
    try {
      // Camera permission (Android only — iOS uses Info.plist)
      if (Platform.OS === 'android') {
        const cameraResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        if (cameraResult !== PermissionsAndroid.RESULTS.GRANTED) {
          setPermissionError('Camera permission is required for AR.');
          return;
        }
      }

      // Location permission via expo-location (Expo-compatible, iOS + Android)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionError('Location permission is required for AR.');
        return;
      }

      setPermissionsGranted(true);
      fetchLocations();
    } catch (err) {
      setPermissionError('Failed to request permissions: ' + err.message);
    }
  };

  // ─── Fetch landmarks ────────────────────────────────────────────────────────
  const fetchLocations = async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const raw = Array.isArray(json)        ? json
                : Array.isArray(json.data)   ? json.data
                : Array.isArray(json.spots)  ? json.spots
                : Array.isArray(json.result) ? json.result
                : null;

      if (!raw) {
        throw new Error(
          `Unexpected API shape — got keys: ${JSON.stringify(Object.keys(json))}`
        );
      }

      const mapped = raw.map(mapLandmarkToARLocation).filter(Boolean);
      setLocations(mapped);

      if (mapped.length === 0) {
        setFetchError('No landmarks with modelCoordinates found.');
      }
    } catch (err) {
      setFetchError('Could not load AR locations: ' + err.message);
    }
  };

  // ─── Inject locations into WebView ──────────────────────────────────────────
  const injectLocations = useCallback((locs) => {
    if (!locs.length || !webviewRef.current) return;
    const script = `
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'AR_CONFIG',
          locations: ${JSON.stringify(locs)}
        })
      }));
      true;
    `;
    webviewRef.current.injectJavaScript(script);
  }, []);

  // Fix #4: inject as soon as webview loads (don't wait for arReady)
  const onWebViewLoad = useCallback(() => {
    setWebviewLoaded(true);
    if (locations.length) injectLocations(locations);
  }, [locations, injectLocations]);

  // Re-inject if locations arrive after webview loaded
  useEffect(() => {
    if (webviewLoaded && locations.length) injectLocations(locations);
  }, [locations, webviewLoaded, injectLocations]);

  // Fix #5: if WebView never sends AR_READY, auto-show AR after 10s timeout
  useEffect(() => {
    if (!webviewLoaded) return;
    const timer = setTimeout(() => {
      setArReady(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [webviewLoaded]);

  // ─── Range check using expo-location ──────────────────────────────────────
  const checkRange = useCallback(async (locs) => {
    setRangeChecked(false);
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude: uLat, longitude: uLng } = pos.coords;
      const anyInRange = locs.some((loc) => {
        const dLat = parseFloat(loc.landmarkLat);
        const dLng = parseFloat(loc.landmarkLng);
        if (isNaN(dLat) || isNaN(dLng)) return false;
        return getDistanceMeters(uLat, uLng, dLat, dLng) <= RANGE_METERS;
      });
      setOutOfRange(!anyInRange);
    } catch (_err) {
      // GPS failed → don't block, just show AR
      setOutOfRange(false);
    } finally {
      setRangeChecked(true);
    }
  }, []);

  // Fix #7: run range check as soon as permissions + locations are ready
  // (don't gate on arReady — that's what was causing the deadlock)
  useEffect(() => {
    if (permissionsGranted && locations.length && !rangeChecked) {
      checkRange(locations);
    }
  }, [permissionsGranted, locations, rangeChecked, checkRange]);

  // ─── Messages from WebView ──────────────────────────────────────────────────
  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'AR_READY') {
        setArReady(true);
      }
    } catch (_) {}
  }, []);

  // ─── Permission error ───────────────────────────────────────────────────────
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

  // ─── Decide what loading overlay to show ────────────────────────────────────
  // Fix #8: show out-of-range BEFORE arReady, as a gate; show spinner while checking
  const showLoadingOverlay = !arReady && permissionsGranted;
  const showOutOfRange     = rangeChecked && outOfRange;
  const showSpinner        = !rangeChecked || (!arReady && !outOfRange);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* AR WebView — fills entire screen edge-to-edge */}
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
              <Text style={styles.outOfRangeTitle}>You're not near any landmark</Text>
              <Text style={styles.outOfRangeMsg}>
                Move within {RANGE_METERS}m of a landmark to see AR models.
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => checkRange(locations)}
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
    justifyContent: 'center', alignItems: 'center', gap: 14,
  },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '500', marginTop: 10 },

  outOfRangeIcon:  { fontSize: 52, marginBottom: 8 },
  outOfRangeTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  outOfRangeMsg:   { color: '#aaa', fontSize: 13, textAlign: 'center', paddingHorizontal: 32, marginBottom: 24 },
  warnText:        { color: '#ffcc00', fontSize: 12, textAlign: 'center', paddingHorizontal: 24 },

  errorContainer: {
    flex: 1, backgroundColor: '#0a0a0a',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  errorIcon:  { fontSize: 56, marginBottom: 16 },
  errorTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  errorMsg:   { color: '#aaa', fontSize: 14, textAlign: 'center', marginBottom: 28 },
  retryBtn: {
    backgroundColor: '#00ff88', paddingVertical: 12,
    paddingHorizontal: 32, borderRadius: 24,
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