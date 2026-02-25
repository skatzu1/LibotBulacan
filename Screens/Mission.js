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
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { loadModel, runPrediction } from '../utils/modelAI';

const { width, height } = Dimensions.get('window');

export default function Mission({ navigation, route }) {
  const { spot } = route.params;
  const cameraRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [status, setStatus] = useState('pending');
  // pending | camera | scanning | approved | failed
  const [confidence, setConfidence] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [facing, setFacing] = useState('back');

  // Load AI model when screen opens
  useEffect(() => {
    const prepareModel = async () => {
      const m = await loadModel();
      setModelReady(!!m);
    };
    prepareModel();
  }, []);

  // ─── Open Camera ──────────────────────────────────────────
  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Permission Required',
          'Camera access is needed to scan the product.'
        );
        return;
      }
    }
    setCapturedImage(null);
    setStatus('camera');
    setCameraOpen(true);
  };

  // ─── Take Photo ───────────────────────────────────────────
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
      setLoading(true);
      setAttempts(prev => prev + 1);

      // Run AI prediction
      const result = await runPrediction(photo.uri);
      setLoading(false);

      if (!result) {
        Alert.alert('Error', 'Could not analyze image. Try again.');
        setStatus('failed');
        return;
      }

      setConfidence(result.confidence);

      if (result.isC2) {
        setStatus('approved'); // ✅ C2 detected!
      } else {
        setStatus('failed');   // ❌ Not C2
      }
    } catch (error) {
      console.error('Camera error:', error);
      setLoading(false);
      setStatus('failed');
    }
  };

  // ─── Flip Camera ──────────────────────────────────────────
  const flipCamera = () => {
    setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  };

  // ─── Close Camera ─────────────────────────────────────────
  const closeCamera = () => {
    setCameraOpen(false);
    setStatus('pending');
  };

  // ─── Reset ────────────────────────────────────────────────
  const resetScan = () => {
    setCapturedImage(null);
    setStatus('pending');
    setConfidence(0);
  };

  // ─── Complete Mission ─────────────────────────────────────
  const completeMission = () => {
    Alert.alert(
      '🎉 Mission Complete!',
      'C2 bottle verified! Mission marked as complete!',
      [{ text: 'Back to Home', onPress: () => navigation.goBack() }]
    );
  };

  // ─── CAMERA VIEW ──────────────────────────────────────────
  if (cameraOpen) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        >
          {/* Top bar */}
          <SafeAreaView style={styles.cameraTopBar}>
            <TouchableOpacity onPress={closeCamera} style={styles.cameraCloseBtn}>
              <Feather name="x" size={28} color="white" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Scan C2 Bottle</Text>
            <TouchableOpacity onPress={flipCamera} style={styles.cameraFlipBtn}>
              <Feather name="refresh-cw" size={24} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Scan frame guide */}
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <Text style={styles.scanHint}>
            Place the C2 bottle inside the frame
          </Text>

          {/* Capture button */}
          <View style={styles.cameraBottomBar}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePhoto}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>

        </CameraView>
      </View>
    );
  }

  // ─── MAIN SCREEN ──────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="chevron-left" size={28} color="#4a4a4a" />
          </TouchableOpacity>
          <Text style={styles.header_title}>Daily Mission</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Model loading */}
        {!modelReady && (
          <View style={styles.modelLoading}>
            <ActivityIndicator color="#6b4b45" size="small" />
            <Text style={styles.modelLoadingText}>  Loading AI...</Text>
          </View>
        )}

        {/* Attempts */}
        {attempts > 0 && (
          <Text style={styles.attempts}>Attempts: {attempts}</Text>
        )}

        {/* Mission Card */}
        <View style={styles.missionCard}>
          <Text style={styles.missionCardTitle}>🎯 {spot?.name} Mission</Text>
          <Text style={styles.missionCardDesc}>
            Find a C2 Green Tea bottle and scan it to complete this mission!
          </Text>
        </View>

        {/* Instructions */}
        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>📌 How to complete:</Text>
          <Text style={styles.hintText}>
            1. Tap "Open Camera" below{'\n'}
            2. Point at a C2 Green Tea bottle{'\n'}
            3. Center it in the frame{'\n'}
            4. Tap the capture button{'\n'}
            5. AI will verify it automatically!
          </Text>
        </View>

        {/* Status Box */}
        <View style={styles.statusBox}>

          {/* PENDING */}
          {status === 'pending' && (
            <>
              <Text style={styles.emoji}>📸</Text>
              <Text style={styles.statusTitle}>Ready to Scan</Text>
              <Text style={styles.statusDesc}>
                Open the camera and point it at a C2 bottle.
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
              <Text style={[styles.statusTitle, { color: '#2e7d32' }]}>
                C2 Bottle Detected!
              </Text>
              <Text style={styles.confidence}>
                Confidence: {confidence}%
              </Text>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
              <TouchableOpacity style={styles.completeBtn} onPress={completeMission}>
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
                Not a C2 Bottle
              </Text>
              <Text style={styles.confidence}>
                Confidence: {confidence}%
              </Text>
              <Text style={styles.statusDesc}>
                Make sure the C2 bottle is clearly visible and well-lit, then try again!
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

const styles = StyleSheet.create({
  // ── Main Screen ──
  container: { flex: 1, backgroundColor: '#f7cfc9' },
  scroll: { padding: 20, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  header_title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a4a4a',
  },
  modelLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modelLoadingText: { color: '#6b4b45', fontSize: 14 },
  attempts: { fontSize: 13, color: '#999', marginBottom: 8 },
  missionCard: {
    backgroundColor: '#6b4b45',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 15,
  },
  missionCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 6,
  },
  missionCardDesc: {
    fontSize: 14,
    color: '#f7cfc9',
    lineHeight: 20,
  },
  hintBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    width: '100%',
    marginBottom: 20,
  },
  hintTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#6b4b45',
    marginBottom: 8,
  },
  hintText: { fontSize: 14, color: '#555', lineHeight: 22 },
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
  preview: {
    width: 220,
    height: 220,
    borderRadius: 12,
    marginBottom: 15,
  },
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
    backgroundColor: '#2e7d32',
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

  // ── Camera Screen ──
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
  cameraCloseBtn: { padding: 8 },
  cameraFlipBtn: { padding: 8 },
  cameraTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Scan frame corners
  scanFrame: {
    position: 'absolute',
    top: height * 0.2,
    left: width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: 'space-between',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: 'white',
  },
  topLeft: {
    top: 0, left: 0,
    borderTopWidth: 3, borderLeftWidth: 3,
  },
  topRight: {
    top: 0, right: 0,
    borderTopWidth: 3, borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0, left: 0,
    borderBottomWidth: 3, borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0, right: 0,
    borderBottomWidth: 3, borderRightWidth: 3,
  },
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

  // Capture button
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
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
});