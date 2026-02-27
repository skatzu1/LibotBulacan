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
import { loadModel, runPrediction } from '../utils/modelAI';

const { width, height } = Dimensions.get('window');

// ─── Mission Configs ──────────────────────────────────────────────────────────
//
// Each mission config defines:
//   id         – unique key, also passed as route.params.missionId
//   title      – display name shown in the header card
//   product    – human-readable product name used in copy
//   resultKey  – the boolean key returned by runPrediction() (e.g. result.isC2)
//   emoji      – decorative emoji for the mission card
//   accentColor – hex used for the "approved" success state
//   hint       – extra tip shown in the instructions box
//
// To add more missions, push another object here. It will automatically
// appear in MissionsScreen without any other changes.
//
export const MISSION_CONFIGS = {
  c2: {
    id: 'c2',
    title: 'C2 Green Tea Mission',
    product: 'C2 Apple Green Tea',
    resultKey: 'isC2',
    emoji: '🍵',
    accentColor: '#2e7d32',
    hint: 'Buy a C2 Apple Green Tea!',
  },
  gatorade: {
    id: 'gatorade',
    title: 'Gatorade Mission',
    product: 'Gatorade',
    resultKey: 'isGatorade',
    emoji: '⚡',
    accentColor: '#f57c00',
    hint: 'Any Gatorade flavor counts — make sure the logo is clearly visible.',
  },
  cocacola: {
    id: 'cocacola',
    title: 'Coca-Cola Mission',
    product: 'Coca-Cola',
    resultKey: 'isCocaCola', // TODO: implement in runPrediction() when model is ready
    emoji: '🥤',
    accentColor: '#c62828',
    hint: 'Any Coca-Cola variant counts (Classic, Zero, Light) — make sure the red label is clearly visible.',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Mission({ navigation, route }) {
  const { spot, missionId = 'c2' } = route.params;
  const config = MISSION_CONFIGS[missionId] ?? MISSION_CONFIGS.c2;

  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [status, setStatus] = useState('pending');
  // pending | scanning | approved | failed
  const [confidence, setConfidence] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [facing, setFacing] = useState('back');

  // Load AI model on mount
  useEffect(() => {
    (async () => {
      const m = await loadModel();
      setModelReady(!!m);
    })();
  }, []);

  // ─── Open Camera ────────────────────────────────────────
  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to scan the product.');
        return;
      }
    }
    setCapturedImage(null);
    setStatus('pending');
    setCameraOpen(true);
  };

  // ─── Take Photo ─────────────────────────────────────────
  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: false,
      });

      setCameraOpen(false);
      setCapturedImage(photo.uri);
      setStatus('scanning');
      setAttempts(prev => prev + 1);

      const result = await runPrediction(photo.uri);

      if (!result) {
        Alert.alert('Error', 'Could not analyze image. Try again.');
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

  const flipCamera = () => setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  const closeCamera = () => { setCameraOpen(false); setStatus('pending'); };
  const resetScan = () => { setCapturedImage(null); setStatus('pending'); setConfidence(0); };

  const completeMission = () => {
    Alert.alert(
      '🎉 Mission Complete!',
      `${config.product} verified! Mission marked as complete!`,
      [{ text: 'Back to Home', onPress: () => navigation.goBack() }]
    );
  };

  // ─── CAMERA VIEW ────────────────────────────────────────
  if (cameraOpen) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          <SafeAreaView style={styles.cameraTopBar}>
            <TouchableOpacity onPress={closeCamera} style={styles.cameraIconBtn}>
              <Feather name="x" size={28} color="white" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Scan {config.product}</Text>
            <TouchableOpacity onPress={flipCamera} style={styles.cameraIconBtn}>
              <Feather name="refresh-cw" size={24} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <Text style={styles.scanHint}>
            Place the {config.product} bottle inside the frame
          </Text>

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
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="chevron-left" size={28} color="#4a4a4a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Daily Mission</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Model loading indicator */}
        {!modelReady && (
          <View style={styles.modelLoading}>
            <ActivityIndicator color="#6b4b45" size="small" />
            <Text style={styles.modelLoadingText}>  Loading AI...</Text>
          </View>
        )}

        {attempts > 0 && (
          <Text style={styles.attempts}>Attempts: {attempts}</Text>
        )}

        {/* Mission Card */}
        <View style={styles.missionCard}>
          <Text style={styles.missionCardEmoji}>{config.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.missionCardTitle}>{config.title}</Text>
            <Text style={styles.missionCardDesc}>
              Find a {config.product} and scan it to complete this mission!
            </Text>
          </View>
        </View>

        {/* Spot Badge */}
        {spot?.name && (
          <View style={styles.spotBadge}>
            <Feather name="map-pin" size={13} color="#6b4b45" />
            <Text style={styles.spotBadgeText}>{spot.name}</Text>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>📌 How to complete:</Text>
          <Text style={styles.hintText}>
            1. Tap "Open Camera" below{'\n'}
            2. Point at a {config.product} bottle{'\n'}
            3. Center it in the frame{'\n'}
            4. Tap the capture button{'\n'}
            5. AI will verify it automatically!
          </Text>
          {config.hint ? (
            <View style={styles.tipRow}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipText}>{config.hint}</Text>
            </View>
          ) : null}
        </View>

        {/* Status Box */}
        <View style={styles.statusBox}>

          {/* PENDING */}
          {status === 'pending' && (
            <>
              <Text style={styles.emoji}>📸</Text>
              <Text style={styles.statusTitle}>Ready to Scan</Text>
              <Text style={styles.statusDesc}>
                Open the camera and point it at a {config.product} bottle.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, !modelReady && styles.disabledBtn]}
                onPress={openCamera}
                disabled={!modelReady}
              >
                <Feather name="camera" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>
                  {modelReady ? 'Open Camera' : 'Loading AI...'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* SCANNING */}
          {status === 'scanning' && (
            <>
              <ActivityIndicator size="large" color="#6b4b45" />
              <Text style={styles.statusTitle}>🔍 Analyzing...</Text>
              <Text style={styles.statusDesc}>AI is checking your photo...</Text>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
            </>
          )}

          {/* APPROVED ✅ */}
          {status === 'approved' && (
            <>
              <Text style={styles.emoji}>✅</Text>
              <Text style={[styles.statusTitle, { color: config.accentColor }]}>
                {config.product} Detected!
              </Text>
              <Text style={styles.confidence}>Confidence: {confidence}%</Text>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
              <TouchableOpacity
                style={[styles.completeBtn, { backgroundColor: config.accentColor }]}
                onPress={completeMission}
              >
                <Text style={styles.primaryBtnText}>🏆 Complete Mission</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={openCamera}>
                <Text style={styles.outlineBtnText}>📸 Scan Again</Text>
              </TouchableOpacity>
            </>
          )}

          {/* FAILED ❌ */}
          {status === 'failed' && (
            <>
              <Text style={styles.emoji}>❌</Text>
              <Text style={[styles.statusTitle, { color: '#c62828' }]}>
                Not a {config.product}
              </Text>
              <Text style={styles.confidence}>Confidence: {confidence}%</Text>
              <Text style={styles.statusDesc}>
                Make sure the {config.product} bottle is clearly visible and well-lit, then try again!
              </Text>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
              <TouchableOpacity style={styles.primaryBtn} onPress={openCamera}>
                <Feather name="camera" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7cfc9' },
  scroll: { padding: 20, alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#4a4a4a' },

  modelLoading: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  modelLoadingText: { color: '#6b4b45', fontSize: 14 },
  attempts: { fontSize: 13, color: '#999', marginBottom: 8 },

  missionCard: {
    backgroundColor: '#6b4b45',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  missionCardEmoji: { fontSize: 36 },
  missionCardTitle: { fontSize: 17, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  missionCardDesc: { fontSize: 13, color: '#f7cfc9', lineHeight: 19 },

  spotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
    gap: 5,
  },
  spotBadgeText: { fontSize: 13, color: '#6b4b45', fontWeight: '600' },

  hintBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    width: '100%',
    marginBottom: 20,
  },
  hintTitle: { fontSize: 15, fontWeight: 'bold', color: '#6b4b45', marginBottom: 8 },
  hintText: { fontSize: 14, color: '#555', lineHeight: 22 },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  tipIcon: { fontSize: 14 },
  tipText: { fontSize: 13, color: '#795548', lineHeight: 18, flex: 1 },

  statusBox: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 25,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emoji: { fontSize: 60, marginBottom: 10 },
  statusTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#6b4b45',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  confidence: { fontSize: 14, color: '#888', marginBottom: 10 },
  preview: { width: 220, height: 220, borderRadius: 12, marginBottom: 15 },

  primaryBtn: {
    backgroundColor: '#6b4b45',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabledBtn: { backgroundColor: '#ccc' },
  primaryBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  completeBtn: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: '#6b4b45',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  outlineBtnText: { color: '#6b4b45', fontSize: 15, fontWeight: '600' },

  // ── Camera ──
  cameraContainer: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cameraIconBtn: { padding: 8 },
  cameraTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  scanFrame: {
    position: 'absolute',
    top: height * 0.2,
    left: width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
  },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: 'white' },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  scanHint: {
    position: 'absolute',
    bottom: height * 0.22,
    alignSelf: 'center',
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white' },
});