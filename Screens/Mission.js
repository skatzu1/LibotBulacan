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
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { loadModel, runPrediction } from '../utils/missionAI';

const { width, height } = Dimensions.get('window');

const COLORS = {
  bg:           '#F9F4F2',
  surface:      '#FFFFFF',
  border:       '#EDE3DF',
  textPrimary:  '#1E1410',
  textSub:      '#8A7570',
  textMuted:    '#B8ABA7',
  brand:        '#7C4F45',
  brandLight:   '#F2E8E5',
  danger:       '#C0392B',
  dangerLight:  '#FDEEEC',
  success:      '#2E7D32',
  successLight: '#EBF5EB',
};

const TYPE_CONFIG = {
  checkin: {
    iconName:    'map-pin',
    accentColor: '#6b4b45',
    hint:        'Visit this location and check in to complete the mission.',
  },
  photo: {
    iconName:    'camera',
    accentColor: '#4a7c59',
    hint:        'Take a clear photo to verify this mission.',
  },
  ar: {
    iconName:    'aperture',
    accentColor: '#2e4a7c',
    hint:        'Use the AR feature to complete this mission.',
  },
  quiz: {
    iconName:    'help-circle',
    accentColor: '#7c4a2e',
    hint:        'Answer the quiz question correctly to complete this mission.',
  },
};

// ─── Step Row ─────────────────────────────────────────────────────────────────
function StepRow({ number, icon, text, isLast }) {
  return (
    <View style={[stepStyles.row, isLast && { marginBottom: 0 }]}>
      <View style={stepStyles.left}>
        <View style={stepStyles.numCircle}>
          <Text style={stepStyles.numText}>{number}</Text>
        </View>
        {!isLast && <View style={stepStyles.connector} />}
      </View>
      <View style={stepStyles.content}>
        <Feather name={icon} size={13} color={COLORS.textMuted} style={{ marginRight: 8, marginTop: 1 }} />
        <Text style={stepStyles.text}>{text}</Text>
      </View>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row:       { flexDirection: 'row', marginBottom: 18 },
  left:      { alignItems: 'center', marginRight: 14 },
  numCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center',
  },
  numText:   { fontSize: 11, fontWeight: '700', color: COLORS.brand },
  connector: { width: 1.5, flex: 1, backgroundColor: COLORS.border, marginTop: 4 },
  content:   { flexDirection: 'row', alignItems: 'flex-start', flex: 1, paddingTop: 3 },
  text:      { fontSize: 13.5, color: COLORS.textSub, flex: 1, lineHeight: 20 },
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function Mission({ navigation, route }) {
  const { spot, mission } = route.params;

  const typeConfig = TYPE_CONFIG[mission.type] || TYPE_CONFIG.checkin;

  const config = {
    id:          mission._id,
    title:       mission.title,
    product:     mission.title,
    category:    mission.type.charAt(0).toUpperCase() + mission.type.slice(1),
    iconName:    mission.icon || typeConfig.iconName,
    accentColor: typeConfig.accentColor,
    hint:        mission.description || typeConfig.hint,
    type:        mission.type,
  };

  const { getToken } = useAuth();

  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen]     = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [modelReady, setModelReady]     = useState(false);
  const [status, setStatus]             = useState('pending');
  const [attempts, setAttempts]         = useState(0);
  const [facing, setFacing]             = useState('back');

  useEffect(() => {
    (async () => {
      const m = await loadModel(mission._id);
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
      base64: false,
      skipProcessing: false,
    });

    setCameraOpen(false);
    setCapturedImage(photo.uri);
    setStatus('scanning');
    setAttempts(prev => prev + 1);

    const result = await runPrediction(photo.uri, mission._id, getToken);

    if (!result) {
      Alert.alert('Error', 'Could not analyze image. Please try again.');
      setStatus('failed');
      return;
    }

    // If backend says no model exists yet for this mission
    if (result.noModel) {
      Alert.alert(
        'No AI Model Yet',
        `Verification for "${mission.title}" is not available yet. Check back soon!`
      );
      setStatus('pending');
      return;
    }

    setStatus(result.verified ? 'approved' : 'failed');
  } catch (error) {
    console.error('Camera error:', error);
    setStatus('failed');
  }
};

  const flipCamera  = () => setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  const closeCamera = () => { setCameraOpen(false); setStatus('pending'); };

  const completeMission = () => {
    Alert.alert(
      '🎉 Mission Complete',
      `"${mission.title}" has been verified and marked as done!`,
      [{ text: 'Back to Missions', onPress: () => navigation.goBack() }]
    );
  };

  // ─── CAMERA VIEW ──────────────────────────────────────────────────────────
  if (cameraOpen) {
    return (
      <View style={styles.cameraContainer}>
        <StatusBar barStyle="light-content" />
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>

          <SafeAreaView style={styles.cameraTopBar}>
            <TouchableOpacity onPress={closeCamera} style={styles.cameraIconBtn}>
              <Feather name="x" size={20} color="white" />
            </TouchableOpacity>
            <View style={styles.cameraTitleWrap}>
              <Text style={styles.cameraLabel}>SCANNING</Text>
              <Text style={styles.cameraTitle}>{config.product}</Text>
            </View>
            <TouchableOpacity onPress={flipCamera} style={styles.cameraIconBtn}>
              <Feather name="refresh-cw" size={18} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <View style={styles.scanLineWrapper}>
              <View style={styles.scanLine} />
            </View>
          </View>

          <View style={styles.scanHintWrap}>
            <Feather name="maximize" size={12} color="rgba(255,255,255,0.8)" style={{ marginRight: 6 }} />
            <Text style={styles.scanHint}>Center the label inside the frame</Text>
          </View>

          <View style={styles.cameraBottomBar}>
            <TouchableOpacity style={styles.captureButton} onPress={takePhoto} activeOpacity={0.8}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>

        </CameraView>
      </View>
    );
  }

  // ─── MAIN SCREEN ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="chevron-left" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{config.category} Mission</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Spot badge */}
        {spot?.name && (
          <View style={styles.spotBadge}>
            <Feather name="map-pin" size={11} color={COLORS.brand} />
            <Text style={styles.spotBadgeText}>{spot.name}</Text>
          </View>
        )}

        {/* Mission card */}
        <View style={[styles.itemCard, { borderLeftColor: config.accentColor }]}>
          <View style={[styles.iconWrap, { backgroundColor: config.accentColor + '18' }]}>
            <Feather name={config.iconName} size={24} color={config.accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemCategory}>{config.category}</Text>
            <Text style={styles.itemTitle}>{config.title}</Text>
          </View>
          {attempts > 0 && (
            <View style={styles.attemptsBadge}>
              <Text style={styles.attemptsNum}>{attempts}</Text>
              <Text style={styles.attemptsLabel}>tries</Text>
            </View>
          )}
        </View>

        {/* Model loading */}
        {!modelReady && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.brand} size="small" />
            <Text style={styles.loadingText}>Preparing scanner…</Text>
          </View>
        )}

        {/* Steps */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>HOW TO VERIFY</Text>
          {[
            { icon: 'camera',       text: 'Open the camera below' },
            { icon: 'crosshair',    text: `Point at the ${config.product}` },
            { icon: 'maximize',     text: 'Keep it inside the frame' },
            { icon: 'circle',       text: 'Tap the shutter button' },
            { icon: 'check-circle', text: 'AI verifies automatically' },
          ].map((step, i, arr) => (
            <StepRow
              key={i}
              number={i + 1}
              icon={step.icon}
              text={step.text}
              isLast={i === arr.length - 1}
            />
          ))}

          {config.hint && (
            <View style={styles.hintBox}>
              <Feather name="info" size={13} color={COLORS.brand} style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.hintText}>{config.hint}</Text>
            </View>
          )}
        </View>

        {/* Status card */}
        <View style={styles.card}>

          {/* PENDING */}
          {status === 'pending' && (
            <View style={styles.statusInner}>
              <View style={styles.statusIconCircle}>
                <Feather name="camera" size={28} color={COLORS.brand} />
              </View>
              <Text style={styles.statusTitle}>Ready to Scan</Text>
              <Text style={styles.statusDesc}>
                Point your camera at the subject to verify this mission.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, !modelReady && styles.disabledBtn]}
                onPress={openCamera}
                disabled={!modelReady}
                activeOpacity={0.85}
              >
                <Feather name="camera" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>
                  {modelReady ? 'Open Camera' : 'Loading Scanner…'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* SCANNING */}
          {status === 'scanning' && (
            <View style={styles.statusInner}>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
              <View style={styles.scanningRow}>
                <ActivityIndicator size="small" color={COLORS.brand} style={{ marginRight: 10 }} />
                <Text style={styles.scanningText}>Analyzing photo…</Text>
              </View>
            </View>
          )}

          {/* APPROVED */}
          {status === 'approved' && (
            <View style={styles.statusInner}>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
              <View style={[styles.statusBanner, { backgroundColor: COLORS.successLight }]}>
                <Feather name="check-circle" size={18} color={COLORS.success} style={{ marginRight: 8 }} />
                <Text style={[styles.statusBannerText, { color: COLORS.success }]}>Mission Verified</Text>
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: config.accentColor }]}
                onPress={completeMission}
                activeOpacity={0.85}
              >
                <Feather name="check" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Mark as Done</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={openCamera} activeOpacity={0.8}>
                <Feather name="refresh-cw" size={14} color={COLORS.brand} style={{ marginRight: 6 }} />
                <Text style={styles.outlineBtnText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* FAILED */}
          {status === 'failed' && (
            <View style={styles.statusInner}>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
              <View style={[styles.statusBanner, { backgroundColor: COLORS.dangerLight }]}>
                <Feather name="x-circle" size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
                <Text style={[styles.statusBannerText, { color: COLORS.danger }]}>Not Recognized</Text>
              </View>
              <Text style={styles.failedTip}>
                Make sure the <Text style={{ fontWeight: '700' }}>{config.product}</Text> is clearly visible and well-lit.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={openCamera} activeOpacity={0.85}>
                <Feather name="camera" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll:    { paddingHorizontal: 20, paddingTop: 8, alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%', marginBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 0.2 },

  spotBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: COLORS.brandLight, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, marginBottom: 14, gap: 5,
  },
  spotBadgeText: { fontSize: 12, color: COLORS.brand, fontWeight: '600' },

  itemCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, width: '100%', marginBottom: 12,
    borderLeftWidth: 4, gap: 14,
    shadowColor: '#1E1410', shadowOpacity: 0.06,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  iconWrap: {
    width: 50, height: 50, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  itemCategory: {
    fontSize: 10, color: COLORS.textMuted, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3,
  },
  itemTitle:     { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  attemptsBadge: { alignItems: 'center', paddingLeft: 8 },
  attemptsNum:   { fontSize: 20, fontWeight: '800', color: COLORS.brand },
  attemptsLabel: { fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },

  loadingRow: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start', marginBottom: 10, gap: 8,
  },
  loadingText: { fontSize: 13, color: COLORS.textMuted },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 20, width: '100%', marginBottom: 12,
    shadowColor: '#1E1410', shadowOpacity: 0.05,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 20,
  },

  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.brandLight, borderRadius: 10, padding: 12, marginTop: 4,
  },
  hintText: { fontSize: 12.5, color: COLORS.brand, lineHeight: 18, flex: 1 },

  statusInner:    { alignItems: 'center', width: '100%' },
  statusIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.brandLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20, fontWeight: '800', color: COLORS.textPrimary,
    marginBottom: 8, textAlign: 'center',
  },
  statusDesc: {
    fontSize: 13.5, color: COLORS.textSub, textAlign: 'center',
    marginBottom: 24, lineHeight: 21, maxWidth: 260,
  },

  preview: {
    width: '100%', height: 220, borderRadius: 12,
    marginBottom: 16, backgroundColor: COLORS.border,
  },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
    marginBottom: 18, width: '100%', justifyContent: 'center',
  },
  statusBannerText: { fontSize: 15, fontWeight: '700' },

  failedTip: {
    fontSize: 13, color: COLORS.textSub,
    textAlign: 'center', marginBottom: 20, lineHeight: 20,
  },

  scanningRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    backgroundColor: COLORS.brandLight, paddingHorizontal: 16,
    paddingVertical: 10, borderRadius: 10, width: '100%', justifyContent: 'center',
  },
  scanningText: { fontSize: 14, color: COLORS.brand, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: COLORS.brand, paddingVertical: 14,
    paddingHorizontal: 28, borderRadius: 12, marginBottom: 10,
    width: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  disabledBtn:     { backgroundColor: COLORS.border },
  primaryBtnText:  { color: 'white', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  outlineBtn: {
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12,
    width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  outlineBtnText: { color: COLORS.brand, fontSize: 14, fontWeight: '600' },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera:          { flex: 1 },

  cameraTopBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cameraIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraTitleWrap: { alignItems: 'center' },
  cameraLabel: {
    fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2,
  },
  cameraTitle: { color: 'white', fontSize: 15, fontWeight: '700' },

  scanFrame: {
    position: 'absolute', top: height * 0.22,
    left: width * 0.1, width: width * 0.8, height: width * 0.8,
    justifyContent: 'center', alignItems: 'center',
  },
  corner:      { position: 'absolute', width: 24, height: 24, borderColor: 'white' },
  topLeft:     { top: 0,    left: 0,  borderTopWidth: 3,    borderLeftWidth: 3,  borderTopLeftRadius: 4 },
  topRight:    { top: 0,    right: 0, borderTopWidth: 3,    borderRightWidth: 3, borderTopRightRadius: 4 },
  bottomLeft:  { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3,  borderBottomLeftRadius: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanLineWrapper: { width: '88%', alignItems: 'center' },
  scanLine: { width: '100%', height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 1 },

  scanHintWrap: {
    position: 'absolute', bottom: height * 0.21, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  scanHint: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5 },

  cameraBottomBar: { position: 'absolute', bottom: 48, width: '100%', alignItems: 'center' },
  captureButton: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3, borderColor: 'white',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'white' },
});