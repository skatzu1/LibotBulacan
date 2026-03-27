import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';

// ─── Config ──────────────────────────────────────────────────────────────────
const AR_URL  = 'https://ar-web-lemon.vercel.app/index.html';
const API_URL = 'https://your-api.com/ar-locations';

// ──────────────────────
//
//  API shape per landmark:
//  {
//    _id:              { $oid: "..." },
//    name:             "Barasoain Church",
//    description:      "...",
//    image:            "https://...",
//    coordinates:      { lat: 14.846306, lng: 120.812528 },  ← landmark GPS
//    modelUrl:         "https://res.cloudinary.com/.../model.glb",
//    modelCoordinates: { lat: 14.846320, lng: 120.812545 },  ← model spawn GPS
//    Badge:            "https://...",
//    visitCount:       0,
//  }
function mapLandmarkToARLocation(item) {
  const mc = item.modelCoordinates;

  if (!mc || mc.lat == null || mc.lng == null) return null;

  if (!item.modelUrl) return null;

  return {
    id:          item._id?.$oid ?? String(item._id) ?? item.name,
    name:        item.name ?? 'Unknown',
    modelUrl:    item.modelUrl,
    latitude:    mc.lat,   // ← model spawns HERE, not at landmark coordinates
    longitude:   mc.lng,
    landmarkLat: item.coordinates?.lat ?? null,
    landmarkLng: item.coordinates?.lng ?? null,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ARScreen({ navigation }) {
  const webviewRef = useRef(null);

  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError,    setPermissionError]    = useState(null);
  const [arReady,            setArReady]            = useState(false);
  const [locations,          setLocations]          = useState([]);
  const [fetchError,         setFetchError]         = useState(null);
  const [score,              setScore]              = useState(0);
  const [collected,          setCollected]          = useState([]);
  const [total,              setTotal]              = useState(0);

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastScale   = useRef(new Animated.Value(0.8)).current;

  // ─── Permissions ─────────────────────────────────────────────────────────
  useEffect(() => { requestPermissions(); }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        const allGranted = Object.values(granted).every(
          (v) => v === PermissionsAndroid.RESULTS.GRANTED
        );
        if (allGranted) {
          setPermissionsGranted(true);
          fetchLocations();
        } else {
          setPermissionError('Camera and location permissions are required for AR.');
        }
      } catch (err) {
        setPermissionError('Failed to request permissions: ' + err.message);
      }
    } else {
      // iOS handles permissions via Info.plist
      setPermissionsGranted(true);
      fetchLocations();
    }
  };

  // ─── Fetch landmarks from API ─────────────────────────────────────────────
  const fetchLocations = async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();

      // Map + filter: only landmarks with valid modelCoordinates & modelUrl survive
      const mapped = raw.map(mapLandmarkToARLocation).filter(Boolean);

      setLocations(mapped);
      setTotal(mapped.length);

      if (mapped.length === 0) {
        setFetchError('No landmarks have modelCoordinates set yet — add them in the backend.');
      }
    } catch (err) {
      setFetchError('Could not load AR locations: ' + err.message);
    }
  };

  // ─── Send locations to WebView ────────────────────────────────────────────
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

  const onWebViewLoad = useCallback(() => {
    if (locations.length) injectLocations(locations);
  }, [locations, injectLocations]);

  // Re-inject when locations arrive after WebView already loaded
  useEffect(() => {
    if (arReady && locations.length) injectLocations(locations);
  }, [locations, arReady, injectLocations]);

  // ─── Handle messages from WebView ────────────────────────────────────────
  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'AR_READY') {
        setArReady(true);
      }

      if (data.type === 'AR_COLLECTED') {
        const { modelId } = data;
        setCollected((prev) => {
          if (prev.includes(modelId)) return prev;
          const next = [...prev, modelId];
          setScore(next.length * 10);
          showScoreToast();
          return next;
        });
      }
    } catch (_) {}
  }, []);

  // ─── Score toast ──────────────────────────────────────────────────────────
  const showScoreToast = () => {
    toastOpacity.setValue(0);
    toastScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(toastScale,   { toValue: 1, friction: 5,   useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      }, 1200);
    });
  };

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

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* AR WebView */}
      {permissionsGranted && (
        <WebView
          ref={webviewRef}
          source={{ uri: AR_URL }}
          style={styles.webview}
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

      {/* Loading overlay */}
      {!arReady && permissionsGranted && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00ff88" />
          <Text style={styles.loadingText}>Acquiring GPS signal…</Text>
          {fetchError && (
            <Text style={styles.warnText}>⚠️ {fetchError}</Text>
          )}
        </View>
      )}

      {/* HUD — score & progress */}
      {arReady && (
        <View style={styles.hud}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
          <View style={styles.progressBox}>
            <Text style={styles.progressLabel}>
              {collected.length} / {total} collected
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: total > 0 ? `${(collected.length / total) * 100}%` : '0%' },
                ]}
              />
            </View>
          </View>
        </View>
      )}

      {/* Score toast */}
      <Animated.View
        style={[
          styles.scoreToast,
          { opacity: toastOpacity, transform: [{ scale: toastScale }] },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.scoreToastText}>+10 pts 🎉</Text>
      </Animated.View>

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
  webview:   { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center', alignItems: 'center', gap: 14,
  },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '500', marginTop: 10 },
  warnText:    { color: '#ffcc00', fontSize: 12, textAlign: 'center', paddingHorizontal: 24 },

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

  hud: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  scoreBox: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14, paddingVertical: 8, paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)',
  },
  scoreLabel: { color: '#00ff88', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  scoreValue: { color: '#fff', fontSize: 26, fontWeight: '800' },

  progressBox: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14, paddingVertical: 8, paddingHorizontal: 16,
    minWidth: 140,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  progressLabel: { color: '#ccc', fontSize: 12, marginBottom: 6 },
  progressBar: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#00ff88', borderRadius: 3 },

  scoreToast: {
    position: 'absolute', alignSelf: 'center', top: '42%',
    backgroundColor: 'rgba(0,255,136,0.9)',
    paddingVertical: 12, paddingHorizontal: 28, borderRadius: 30,
  },
  scoreToastText: { color: '#000', fontWeight: '800', fontSize: 20 },

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