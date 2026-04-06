import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';           // ← NEW
import { loadModel, runPrediction } from '../utils/missionAI';

const { width, height } = Dimensions.get('window');

// ─── Bucket List Item Configs ─────────────────────────────────────────────────
export const BUCKET_LIST_CONFIGS = {
  c2: {
    id: 'c2',
    title: 'C2 Apple Green Tea',
    product: 'C2 Apple Green Tea',
    category: 'Drink',
    resultKey: 'isC2',
    iconName: 'droplet',
    accentColor: '#2e7d32',
    hint: 'Pick up a cold C2 Apple Green Tea from any store near the spot.',
  },
  gatorade: {
    id: 'gatorade',
    title: 'Gatorade',
    product: 'Gatorade',
    category: 'Drink',
    resultKey: 'isGatorade',
    iconName: 'zap',
    accentColor: '#e65100',
    hint: 'Any Gatorade flavor counts — make sure the logo is clearly visible.',
  },
  cocacola: {
    id: 'cocacola',
    title: 'Coca-Cola',
    product: 'Coca-Cola',
    category: 'Drink',
    resultKey: 'isCocaCola',
    iconName: 'coffee',
    accentColor: '#b71c1c',
    hint: 'Classic, Zero, or Light — just make sure the red label is in frame.',
  },
};

// ─── Spot → Bucket List Mapping ───────────────────────────────────────────────
export const DEFAULT_BUCKET_LIST = ['c2', 'gatorade', 'cocacola'];

export const SPOT_BUCKET_LISTS = {
  // 'spot-id-here': ['c2', 'gatorade', 'cocacola'],
};

export function getBucketListForSpot(spotId) {
  return (SPOT_BUCKET_LISTS[spotId] ?? DEFAULT_BUCKET_LIST)
    .map(id => BUCKET_LIST_CONFIGS[id])
    .filter(Boolean);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Mission({ navigation, route }) {
  const { spot, missionId = 'c2' } = route.params;
  const config = BUCKET_LIST_CONFIGS[missionId] ?? BUCKET_LIST_CONFIGS.c2;

  const { getToken } = useAuth();  // ← NEW: get Clerk token function

  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen]     = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [modelReady, setModelReady]     = useState(false);
  const [status, setStatus]             = useState('pending'); // pending | scanning | approved | failed
  const [confidence, setConfidence]     = useState(0);
  const [attempts, setAttempts]         = useState(0);
  const [facing, setFacing]             = useState('back');

  useEffect(() => {
    (async () => {
      // loadModel is now a no-op on mobile — always returns true immediately
      const m = await loadModel(missionId);
      setModelReady(!!m);
    })();
  }, []);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera Required', 'Camera access is needed to scan the product.');
        return;
      }
    }
    setCapturedImage(null);
    setStatus('pending');
    setCameraOpen(true);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,      // base64 conversion now happens inside runPrediction
        skipProcessing: false,
      });

      setCameraOpen(false);
      setCapturedImage(photo.uri);
      setStatus('scanning');
      setAttempts(prev => prev + 1);

      // ← Pass getToken so missionAI can authenticate the backend request
      const result = await runPrediction(photo.uri, missionId, getToken);

      if (!result) {
        Alert.alert('Error', 'Could not analyze image. Please try again.');
        setStatus('failed');
        return;
      }

      setConfidence(result.confidence);
      setStatus(result[config.resultKey] ? 'approved' : 'failed');
    } catch (error) {
      console.error('Camera error:', error);
      setStatus('failed');
    }
  };

  const flipCamera  = () => setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  const closeCamera = () => { setCameraOpen(false); setStatus('pending'); };

  const completeMission = () => {
    Alert.alert(
      'Item Complete',
      `${config.product} verified. Bucket list item marked as done.`,
      [{ text: 'Back to List', onPress: () => navigation.goBack() }]
    );
  };

  // ─── CAMERA VIEW ────────────────────────────────────────
  if (cameraOpen) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          <SafeAreaView style={styles.cameraTopBar}>
            <TouchableOpacity onPress={closeCamera} style={styles.cameraIconBtn}>
              <Feather name="x" size={22} color="white" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>{config.product}</Text>
            <TouchableOpacity onPress={flipCamera} style={styles.cameraIconBtn}>
              <Feather name="refresh-cw" size={20} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Scan frame corners */}
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <Text style={styles.scanHint}>Center the label inside the frame</Text>

          <View style={styles.cameraBottomBar}>
            <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  // ─── MAIN SCREEN ────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="chevron-left" size={22} color="#3a2a28" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bucket List</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Spot Badge */}
        {spot?.name && (
          <View style={styles.spotBadge}>
            <Feather name="map-pin" size={12} color="#6b4b45" />
            <Text style={styles.spotBadgeText}>{spot.name}</Text>
          </View>
        )}

        {/* Item Header Card */}
        <View style={[styles.itemCard, { borderLeftColor: config.accentColor }]}>
          <View style={[styles.iconWrap, { backgroundColor: config.accentColor + '15' }]}>
            <Feather name={config.iconName} size={26} color={config.accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemCategory}>{config.category}</Text>
            <Text style={styles.itemTitle}>{config.title}</Text>
          </View>
          {attempts > 0 && (
            <View style={styles.attemptsBadge}>
              <Text style={styles.attemptsText}>{attempts}</Text>
              <Text style={styles.attemptsLabel}>tries</Text>
            </View>
          )}
        </View>

        {/* AI loading */}
        {!modelReady && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#6b4b45" size="small" />
            <Text style={styles.loadingText}>Preparing scanner…</Text>
          </View>
        )}

        {/* Steps */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>How to verify</Text>
          {[
            { icon: 'camera',       text: 'Open the camera below' },
            { icon: 'crosshair',    text: `Point at the ${config.product} label` },
            { icon: 'maximize',     text: 'Keep it inside the frame' },
            { icon: 'circle',       text: 'Tap the shutter button' },
            { icon: 'check-circle', text: 'AI verifies automatically' },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Feather name={step.icon} size={14} color="#888" style={{ marginRight: 10 }} />
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}

          {config.hint ? (
            <View style={styles.hintRow}>
              <Feather name="info" size={13} color="#6b4b45" style={{ marginRight: 8 }} />
              <Text style={styles.hintText}>{config.hint}</Text>
            </View>
          ) : null}
        </View>

        {/* Status Box */}
        <View style={styles.statusBox}>

          {/* PENDING */}
          {status === 'pending' && (
            <View style={styles.statusInner}>
              <View style={styles.statusIconWrap}>
                <Feather name="camera" size={32} color="#6b4b45" />
              </View>
              <Text style={styles.statusTitle}>Ready to scan</Text>
              <Text style={styles.statusDesc}>
                Scan the product to check off this bucket list item.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, !modelReady && styles.disabledBtn]}
                onPress={openCamera}
                disabled={!modelReady}
              >
                <Feather name="camera" size={17} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>
                  {modelReady ? 'Open Camera' : 'Loading…'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* SCANNING */}
          {status === 'scanning' && (
            <View style={styles.statusInner}>
              <ActivityIndicator size="large" color="#6b4b45" style={{ marginBottom: 16 }} />
              <Text style={styles.statusTitle}>Analyzing photo</Text>
              <Text style={styles.statusDesc}>AI is checking your image…</Text>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
            </View>
          )}

          {/* APPROVED */}
          {status === 'approved' && (
            <View style={styles.statusInner}>
              <View style={[styles.statusIconWrap, { backgroundColor: config.accentColor + '15' }]}>
                <Feather name="check-circle" size={32} color={config.accentColor} />
              </View>
              <Text style={[styles.statusTitle, { color: config.accentColor }]}>
                Verified
              </Text>
              <Text style={styles.confidence}>{confidence}% confidence</Text>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: config.accentColor }]}
                onPress={completeMission}
              >
                <Feather name="check" size={17} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Mark as Done</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={openCamera}>
                <Feather name="refresh-cw" size={15} color="#6b4b45" style={{ marginRight: 6 }} />
                <Text style={styles.outlineBtnText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* FAILED */}
          {status === 'failed' && (
            <View style={styles.statusInner}>
              <View style={[styles.statusIconWrap, { backgroundColor: '#fce8e6' }]}>
                <Feather name="x-circle" size={32} color="#c62828" />
              </View>
              <Text style={[styles.statusTitle, { color: '#c62828' }]}>
                Not recognized
              </Text>
              <Text style={styles.confidence}>{confidence}% confidence</Text>
              <Text style={styles.statusDesc}>
                Make sure the {config.product} label is clearly visible and well-lit.
              </Text>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
              <TouchableOpacity style={styles.primaryBtn} onPress={openCamera}>
                <Feather name="camera" size={17} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdf5f3' },
  scroll: { padding: 20, alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#3a2a28', letterSpacing: 0.2 },

  spotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 14,
    gap: 5,
    borderWidth: 1,
    borderColor: '#edddd9',
  },
  spotBadgeText: { fontSize: 12, color: '#6b4b45', fontWeight: '600' },

  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 12,
    borderLeftWidth: 4,
    gap: 14,
    shadowColor: '#6b4b45',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCategory: { fontSize: 11, color: '#aaa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  itemTitle: { fontSize: 17, fontWeight: '700', color: '#3a2a28' },
  attemptsBadge: { alignItems: 'center' },
  attemptsText: { fontSize: 18, fontWeight: '700', color: '#6b4b45' },
  attemptsLabel: { fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    alignSelf: 'flex-start',
    gap: 8,
  },
  loadingText: { fontSize: 13, color: '#aaa' },

  stepsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    marginBottom: 16,
    shadowColor: '#6b4b45',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  stepsTitle: { fontSize: 13, fontWeight: '700', color: '#3a2a28', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f0e8e6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumText: { fontSize: 11, fontWeight: '700', color: '#6b4b45' },
  stepText: { fontSize: 13, color: '#555', flex: 1 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    backgroundColor: '#fdf0ec',
    borderRadius: 8,
    padding: 12,
  },
  hintText: { fontSize: 12, color: '#7a5248', lineHeight: 18, flex: 1 },

  statusBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    shadowColor: '#6b4b45',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  statusInner: { alignItems: 'center' },
  statusIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#f0e8e6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statusTitle: { fontSize: 20, fontWeight: '700', color: '#3a2a28', marginBottom: 6, textAlign: 'center' },
  statusDesc: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  confidence: { fontSize: 12, color: '#aaa', marginBottom: 12 },
  preview: { width: 200, height: 200, borderRadius: 10, marginBottom: 16 },

  primaryBtn: {
    backgroundColor: '#6b4b45',
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabledBtn: { backgroundColor: '#d9ccc9' },
  primaryBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },

  outlineBtn: {
    borderWidth: 1.5,
    borderColor: '#d0b8b4',
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  outlineBtnText: { color: '#6b4b45', fontSize: 14, fontWeight: '600' },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraIconBtn: { padding: 8 },
  cameraTitle: { color: 'white', fontSize: 16, fontWeight: '600' },

  scanFrame: {
    position: 'absolute',
    top: height * 0.22,
    left: width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
  },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: 'white' },
  topLeft:     { top: 0,    left: 0,  borderTopWidth: 2.5,    borderLeftWidth: 2.5 },
  topRight:    { top: 0,    right: 0, borderTopWidth: 2.5,    borderRightWidth: 2.5 },
  bottomLeft:  { bottom: 0, left: 0,  borderBottomWidth: 2.5, borderLeftWidth: 2.5 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 2.5, borderRightWidth: 2.5 },

  scanHint: {
    position: 'absolute',
    bottom: height * 0.22,
    alignSelf: 'center',
    color: 'white',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 44,
    width: '100%',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'white' },
});