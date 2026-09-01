import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Animated,
  PanResponder,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { loadModel, runPrediction } from '../utils/missionAI';

const { width, height } = Dimensions.get('window');

// ─── Palette ────────────────────────────────────────────────────────────────
// Warm, sun-worn paper + rust/terracotta — a field-journal feel for a
// location-hunting mission, rather than a generic SaaS card look.
const COLORS = {
  bg:           '#F7F1E8',
  surface:      '#FFFFFF',
  border:       '#E9DDD1',
  ink:          '#241811',
  inkSub:       '#8C7A6D',
  inkMuted:     '#C1B2A4',
  brand:        '#B85C2E',
  brandDeep:    '#8F4520',
  brandTint:    '#F4E3D3',
  gold:         '#C89A4B',
  danger:       '#B23B2E',
  dangerTint:   '#FBE9E5',
  success:      '#3C7A4E',
  successTint:  '#E7F2E8',
};

const TYPE_CONFIG = {
  checkin: {
    iconName:    'map-pin',
    accentColor: '#6b4b45',
    hint:        'Head to this spot in person, then check in to log it.',
  },
  photo: {
    iconName:    'camera',
    accentColor: '#4a7c59',
    hint:        'Snap a clear photo so the sighting can be confirmed.',
  },
  ar: {
    iconName:    'aperture',
    accentColor: '#2e4a7c',
    hint:        'Line it up in AR to log this sighting.',
  },
  quiz: {
    iconName:    'help-circle',
    accentColor: '#7c4a2e',
    hint:        'Answer correctly to log this sighting.',
  },
};

// ─── Scan frame geometry (must match scanFrame style below) ───────────────────
const FRAME_TOP_RATIO  = 0.22;  // matches scanFrame.top: height * 0.22
const FRAME_LEFT_RATIO = 0.1;   // matches scanFrame.left: width * 0.1
const FRAME_SIZE_RATIO = 0.8;   // matches scanFrame.width/height: width * 0.8

// Crops the captured photo down to exactly the region the user saw inside
// the on-screen scan frame, correcting for the camera preview's "cover" fit
// (the raw photo's aspect ratio usually differs from the screen's).
async function cropToScanFrame(photo) {
  try {
    const photoW = photo.width;
    const photoH = photo.height;
    if (!photoW || !photoH) return photo.uri;

    const screenAspect = width / height;
    const photoAspect   = photoW / photoH;

    let visibleW = photoW;
    let visibleH = photoH;
    let offsetX  = 0;
    let offsetY  = 0;

    if (photoAspect > screenAspect) {
      visibleW = photoH * screenAspect;
      offsetX  = (photoW - visibleW) / 2;
    } else {
      visibleH = photoW / screenAspect;
      offsetY  = (photoH - visibleH) / 2;
    }

    const scaleX = visibleW / width;
    const scaleY = visibleH / height;

    const frameLeft = FRAME_LEFT_RATIO * width;
    const frameTop  = FRAME_TOP_RATIO * height;
    const frameSize = FRAME_SIZE_RATIO * width;

    const cropOriginX = Math.round(offsetX + frameLeft * scaleX);
    const cropOriginY = Math.round(offsetY + frameTop * scaleY);
    const cropWidth   = Math.round(frameSize * scaleX);
    const cropHeight  = Math.round(frameSize * scaleY);

    const result = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{
        crop: {
          originX: Math.max(0, cropOriginX),
          originY: Math.max(0, cropOriginY),
          width:   Math.min(cropWidth, photoW - Math.max(0, cropOriginX)),
          height:  Math.min(cropHeight, photoH - Math.max(0, cropOriginY)),
        },
      }],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
    );

    return result.uri;
  } catch (err) {
    console.error('Crop error:', err);
    return photo.uri;
  }
}

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
        <Feather name={icon} size={13} color={COLORS.inkMuted} style={{ marginRight: 8, marginTop: 1 }} />
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
    backgroundColor: COLORS.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },
  numText:   { fontSize: 11, fontWeight: '700', color: COLORS.brandDeep },
  connector: { width: 1.5, flex: 1, backgroundColor: COLORS.border, marginTop: 4 },
  content:   { flexDirection: 'row', alignItems: 'flex-start', flex: 1, paddingTop: 3 },
  text:      { fontSize: 13.5, color: COLORS.inkSub, flex: 1, lineHeight: 20 },
});

// ─── Confidence Meter ───────────────────────────────────────────────────────────
function ConfidenceMeter({ confidence, color }) {
  if (confidence === null || confidence === undefined) return null;
  const pct = Math.max(0, Math.min(100, confidence));

  return (
    <View style={meterStyles.wrap}>
      <View style={meterStyles.labelRow}>
        <Text style={meterStyles.label}>Match confidence</Text>
        <Text style={[meterStyles.value, { color }]}>{pct.toFixed(1)}%</Text>
      </View>
      <View style={meterStyles.track}>
        <View style={[meterStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const meterStyles = StyleSheet.create({
  wrap:     { width: '100%', marginBottom: 18 },
  labelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.inkMuted },
  value: { fontSize: 13, fontWeight: '800' },
  track: {
    width: '100%', height: 8, borderRadius: 4,
    backgroundColor: COLORS.border, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
});

// ─── Zoom geometry ──────────────────────────────────────────────────────────
const ZOOM_TRACK_HEIGHT = 160;
const ZOOM_THUMB_SIZE   = 24;

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
  const { hasPermission, requestPermission } = useCameraPermission();
  const isFocused = useIsFocused();
  const [cameraOpen, setCameraOpen]     = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [modelReady, setModelReady]     = useState(false);
  const [status, setStatus]             = useState('pending');
  const [attempts, setAttempts]         = useState(0);
  const [facing, setFacing]             = useState('back');
  const [confidence, setConfidence]     = useState(null);

  // ── Focus & zoom state ──────────────────────────────────────────────────
  // `facing` is declared above; useCameraDevice must come after it.
  const device = useCameraDevice(facing);

  // `zoom` is a 0–1 user fraction (driven by the slider + pinch gesture); it's
  // mapped onto the device's real zoom-factor range before being handed to
  // <Camera>. Capping at neutralZoom×8 keeps the slider usable on devices that
  // report an enormous maxZoom (e.g. 128×). vision-camera does continuous
  // autofocus by default; tap-to-focus is handled explicitly via camera.focus().
  const [zoom, setZoom]             = useState(0);
  const zoomFactor = useMemo(() => {
    if (!device) return 1;
    const max = Math.min(device.maxZoom, device.neutralZoom * 8);
    return device.neutralZoom + zoom * (max - device.neutralZoom);
  }, [device, zoom]);

  // Reticle position is plain state (just drives style, not mount/unmount) —
  // the reticle View below is ALWAYS mounted. Android's CameraView is backed
  // by a SurfaceView, which composites via a "hole punch" outside RN's normal
  // view diffing. Conditionally mounting/unmounting a sibling view on top of
  // it (as this used to do) forces Android to re-punch that hole and
  // recomposite for a frame — since the buffer swap isn't synced with the
  // surrounding layout pass, you get a torn frame where part of the screen
  // still shows the old camera image and part shows raw black. That's the
  // "half the screen goes black" flash. Keeping the view permanently mounted
  // and only animating its opacity/position avoids that entirely.
  const [reticlePos, setReticlePos] = useState({ x: 0, y: 0 });
  const reticleAnim       = useRef(new Animated.Value(0)).current;
  const flashAnim         = useRef(new Animated.Value(0)).current;
  const zoomStartRef      = useRef(0);
  const pinchStartDistRef = useRef(null);
  const touchStartRef     = useRef({ time: 0, touches: 1 });

  useEffect(() => {
    (async () => {
      const m = await loadModel(mission._id);
      setModelReady(!!m);
    })();
  }, []);

  const openCamera = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Camera Required', 'Camera access is needed to spot this one.');
        return;
      }
    }
    setCapturedImage(null);
    setStatus('pending');
    setConfidence(null);
    setZoom(0);
    setCameraOpen(true);
  };

  // ── Tap-to-focus: animate the reticle AND focus the lens on that point ──
  const triggerFocusReticle = (x, y) => {
    setReticlePos({ x, y });
    reticleAnim.setValue(0);
    Animated.sequence([
      Animated.timing(reticleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(reticleAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    // Real point-of-interest focus. Not every device/lens supports it, and
    // focus() rejects if a capture is already in flight — best-effort, so
    // swallow any rejection rather than surfacing it.
    if (device?.supportsFocus && cameraRef.current) {
      cameraRef.current.focus({ x, y }).catch(() => {});
    }
  };

  // ── Single responder for BOTH tap-to-focus and pinch-to-zoom ────────────
  // Combined into one PanResponder so the two gestures stop fighting over
  // the responder (a separate TouchableWithoutFeedback + PanResponder pair
  // on the same view clobber each other's touch handlers).
  const gestureResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        touchStartRef.current = { time: Date.now(), touches: touches.length };
        if (touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
          zoomStartRef.current = zoom;
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          if (!pinchStartDistRef.current) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
            zoomStartRef.current = zoom;
            return;
          }
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const delta = (dist - pinchStartDistRef.current) / width;
          const next = Math.max(0, Math.min(1, zoomStartRef.current + delta));
          setZoom(next);
        }
      },
      onPanResponderRelease: (evt) => {
        const { time, touches } = touchStartRef.current;
        const elapsed = Date.now() - time;
        // A quick single-finger tap (no pinch involved) triggers focus.
        if (touches === 1 && elapsed < 300) {
          const { locationX, locationY } = evt.nativeEvent;
          triggerFocusReticle(locationX, locationY);
        }
        pinchStartDistRef.current = null;
      },
      onPanResponderTerminate: () => {
        pinchStartDistRef.current = null;
      },
    })
  ).current;

  // ── Zoom slider ──────────────────────────────────────────────────────────
  const zoomSliderResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const y = evt.nativeEvent.locationY;
        const next = Math.max(0, Math.min(1, 1 - y / ZOOM_TRACK_HEIGHT));
        setZoom(next);
      },
      onPanResponderMove: (evt) => {
        const y = evt.nativeEvent.locationY;
        const next = Math.max(0, Math.min(1, 1 - y / ZOOM_TRACK_HEIGHT));
        setZoom(next);
      },
    })
  ).current;

  const takePhoto = async () => {
  if (!cameraRef.current) return;
  try {
    // Custom (non-native) shutter flash
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    const photo = await cameraRef.current.takePhoto({ enableShutterSound: false });
    // vision-camera returns a bare filesystem path; <Image>, fetch() and
    // ImageManipulator all need the file:// scheme.
    const photoUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;

    // Crop down to exactly what the user saw inside the scan frame,
    // so the AI analyzes the same region the guide shows.
    const croppedUri = await cropToScanFrame({ uri: photoUri, width: photo.width, height: photo.height });

    setCameraOpen(false);
    setCapturedImage(croppedUri);
    setStatus('scanning');
    setConfidence(null);
    setAttempts(prev => prev + 1);

    const result = await runPrediction(croppedUri, mission._id, getToken);

    if (!result) {
      Alert.alert('Error', 'Could not analyze image. Please try again.');
      setStatus('failed');
      return;
    }

    // If backend says no model exists yet for this mission
    if (result.noModel) {
      Alert.alert(
        'Not Ready Yet',
        `Verification for "${mission.title}" isn't set up yet. Check back soon!`
      );
      setStatus('pending');
      return;
    }

    setConfidence(typeof result.confidence === 'number' ? result.confidence : null);
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
      '🎉 Nice spotting!',
      `"${mission.title}" is confirmed and logged as complete.`,
      [{ text: 'Back to Missions', onPress: () => navigation.goBack() }]
    );
  };

  // ─── CAMERA VIEW ──────────────────────────────────────────────────────────
  if (cameraOpen) {
    return (
      <View style={styles.cameraContainer}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1 }} {...gestureResponder.panHandlers}>
          {device == null ? (
            <View style={[StyleSheet.absoluteFill, styles.noCamera]}>
              <Feather name="camera-off" size={28} color="rgba(255,255,255,0.7)" />
              <Text style={styles.noCameraText}>Camera unavailable</Text>
            </View>
          ) : (
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isFocused}
              photo={true}
              zoom={zoomFactor}
              photoQualityBalance="quality"
              enableZoomGesture={false}
            />
          )}

            <SafeAreaView style={styles.cameraTopBar}>
              <TouchableOpacity onPress={closeCamera} style={styles.cameraIconBtn}>
                <Feather name="x" size={20} color="white" />
              </TouchableOpacity>
              <View style={styles.cameraTitleWrap}>
                <Text style={styles.cameraLabel}>On the hunt</Text>
                <Text style={styles.cameraTitle}>{config.product}</Text>
              </View>
              <TouchableOpacity onPress={flipCamera} style={styles.cameraIconBtn}>
                <Feather name="refresh-cw" size={18} color="white" />
              </TouchableOpacity>
            </SafeAreaView>

            <View style={styles.scanFrame} pointerEvents="none">
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <View style={styles.scanLineWrapper}>
                <View style={styles.scanLine} />
              </View>
            </View>

            {/*
              Focus reticle — ALWAYS mounted (never conditionally rendered).
              Visibility is driven purely by reticleAnim's opacity, and
              position by reticlePos via style. See the note above `zoom`
              state for why mount/unmount over a SurfaceView-backed
              CameraView caused the black flash.
            */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.focusReticle,
                {
                  left: reticlePos.x - 32,
                  top:  reticlePos.y - 32,
                  opacity: reticleAnim,
                  transform: [{
                    scale: reticleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1.3, 1],
                    }),
                  }],
                },
              ]}
            />

            {/* Custom shutter flash (replaces native flash animation) */}
            <Animated.View
              pointerEvents="none"
              style={[styles.shutterFlash, { opacity: flashAnim }]}
            />

            <View style={styles.scanHintWrap} pointerEvents="none">
              <Feather name="maximize" size={12} color="rgba(255,255,255,0.85)" style={{ marginRight: 6 }} />
              <Text style={styles.scanHint}>Keep {config.product} inside the frame</Text>
            </View>

            {/* Zoom slider */}
            <View style={styles.zoomTrackWrap}>
              <Feather name="zoom-in" size={14} color="rgba(255,255,255,0.8)" />
              <View style={styles.zoomTrack} {...zoomSliderResponder.panHandlers}>
                <View
                  style={[
                    styles.zoomFill,
                    { height: `${zoom * 100}%` },
                  ]}
                />
                <View
                  style={[
                    styles.zoomThumb,
                    { bottom: `${zoom * 100}%`, marginBottom: -ZOOM_THUMB_SIZE / 2 },
                  ]}
                />
              </View>
              <Feather name="zoom-out" size={14} color="rgba(255,255,255,0.8)" />
            </View>

            <View style={styles.cameraBottomBar}>
              <TouchableOpacity style={styles.captureButton} onPress={takePhoto} activeOpacity={0.8}>
                <View style={styles.captureInner} />
              </TouchableOpacity>
            </View>

        </View>
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
            <Feather name="chevron-left" size={20} color={COLORS.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mission</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Greeting */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingHello}>Hello there, traveler!</Text>
          <Text style={styles.greetingSub}>Time for a hunting mission.</Text>
        </View>

        {/* Mission ticket */}
        <View style={styles.ticketCard}>
          <View style={styles.ticketMain}>
            <View style={[styles.iconWrap, { backgroundColor: config.accentColor + '18' }]}>
              <Feather name={config.iconName} size={24} color={config.accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ticketCategory}>{config.category} sighting</Text>
              <Text style={styles.ticketTitle}>{config.title}</Text>
            </View>
            {attempts > 0 && (
              <View style={styles.attemptsBadge}>
                <Text style={styles.attemptsNum}>{attempts}</Text>
                <Text style={styles.attemptsLabel}>tries</Text>
              </View>
            )}
          </View>

          <View style={styles.ticketDividerRow}>
            <View style={[styles.ticketNotch, styles.ticketNotchLeft]} />
            <View style={styles.ticketDividerLine} />
            <View style={[styles.ticketNotch, styles.ticketNotchRight]} />
          </View>

          <Text style={styles.ticketBrief}>
            Spot <Text style={styles.ticketBriefStrong}>{config.product}</Text> to complete this mission.
          </Text>

          {spot?.name && (
            <View style={styles.spotRow}>
              <Feather name="map-pin" size={12} color={COLORS.inkSub} />
              <Text style={styles.spotRowText}>{spot.name}</Text>
            </View>
          )}
        </View>

        {/* Model loading */}
        {!modelReady && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.brand} size="small" />
            <Text style={styles.loadingText}>Getting the scanner ready…</Text>
          </View>
        )}

        {/* Steps */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>What to do</Text>
          {[
            { icon: 'compass',      text: `Keep an eye out for ${config.product}` },
            { icon: 'camera',       text: 'Tap "Open Camera" and line up your shot' },
            { icon: 'maximize',     text: 'Keep it fully inside the frame' },
            { icon: 'check-circle', text: 'Hold still — verification takes a few seconds' },
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
              <Feather name="info" size={13} color={COLORS.brandDeep} style={{ marginRight: 8, marginTop: 1 }} />
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
                <Feather name="compass" size={28} color={COLORS.brand} />
              </View>
              <Text style={styles.statusTitle}>Ready when you are</Text>
              <Text style={styles.statusDesc}>
                Open the camera and point it at {config.product.toLowerCase()} to log the sighting.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, !modelReady && styles.disabledBtn]}
                onPress={openCamera}
                disabled={!modelReady}
                activeOpacity={0.85}
              >
                <Feather name="camera" size={16} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>
                  {modelReady ? 'Open Camera' : 'Loading scanner…'}
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
                <Text style={styles.scanningText}>Checking your photo…</Text>
              </View>
            </View>
          )}

          {/* APPROVED */}
          {status === 'approved' && (
            <View style={styles.statusInner}>
              {capturedImage && (
                <Image source={{ uri: capturedImage }} style={styles.preview} />
              )}
              <ConfidenceMeter confidence={confidence} color={COLORS.success} />
              <View style={[styles.statusBanner, { backgroundColor: COLORS.successTint }]}>
                <Feather name="check-circle" size={18} color={COLORS.success} style={{ marginRight: 8 }} />
                <Text style={[styles.statusBannerText, { color: COLORS.success }]}>Sighting confirmed</Text>
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
              <ConfidenceMeter confidence={confidence} color={COLORS.danger} />
              <View style={[styles.statusBanner, { backgroundColor: COLORS.dangerTint }]}>
                <Feather name="x-circle" size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
                <Text style={[styles.statusBannerText, { color: COLORS.danger }]}>No match yet</Text>
              </View>
              <Text style={styles.failedTip}>
                Make sure <Text style={{ fontWeight: '700' }}>{config.product}</Text> is clearly visible and well-lit, then try again.
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
  scroll:    { paddingHorizontal: 20, paddingTop: 5, alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%',
    height: 64,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 15, fontWeight: '600', color: COLORS.inkSub },

  greetingBlock: { width: '100%', marginBottom: 18, marginTop: 4 },
  greetingHello: {
    fontSize: 26, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.3,
    marginBottom: 4,
  },
  greetingSub: { fontSize: 15, color: COLORS.brand, fontWeight: '600' },

  // ── Mission "ticket" — the one signature visual moment on this screen ──
  ticketCard: {
    backgroundColor: COLORS.surface, borderRadius: 18,
    padding: 20, width: '100%', marginBottom: 12,
    shadowColor: COLORS.ink, shadowOpacity: 0.08,
    shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  ticketMain: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: {
    width: 50, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  ticketCategory: {
    fontSize: 12, color: COLORS.inkMuted, fontWeight: '600', marginBottom: 3,
  },
  ticketTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
  attemptsBadge: { alignItems: 'center', paddingLeft: 8 },
  attemptsNum:   { fontSize: 20, fontWeight: '800', color: COLORS.brand },
  attemptsLabel: { fontSize: 10, color: COLORS.inkMuted },

  ticketDividerRow: { position: 'relative', marginVertical: 16 },
  ticketDividerLine: {
    borderBottomWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
  },
  ticketNotch: {
    position: 'absolute', top: -10, width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.bg,
  },
  ticketNotchLeft:  { left: -32 },
  ticketNotchRight: { right: -32 },

  ticketBrief: { fontSize: 14.5, color: COLORS.inkSub, lineHeight: 21 },
  ticketBriefStrong: { color: COLORS.ink, fontWeight: '700' },

  spotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
  },
  spotRowText: { fontSize: 12.5, color: COLORS.inkSub, fontWeight: '500' },

  loadingRow: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start', marginBottom: 10, gap: 8,
  },
  loadingText: { fontSize: 13, color: COLORS.inkMuted },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 18,
    padding: 20, width: '100%', marginBottom: 12,
    shadowColor: COLORS.ink, shadowOpacity: 0.05,
    shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 20,
  },

  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.brandTint, borderRadius: 12, padding: 12, marginTop: 4,
  },
  hintText: { fontSize: 12.5, color: COLORS.brandDeep, lineHeight: 18, flex: 1 },

  statusInner:    { alignItems: 'center', width: '100%' },
  statusIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.brandTint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20, fontWeight: '800', color: COLORS.ink,
    marginBottom: 8, textAlign: 'center',
  },
  statusDesc: {
    fontSize: 13.5, color: COLORS.inkSub, textAlign: 'center',
    marginBottom: 24, lineHeight: 21, maxWidth: 260,
  },

  preview: {
    width: '100%', height: 220, borderRadius: 14,
    marginBottom: 16, backgroundColor: COLORS.border,
  },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    marginBottom: 18, width: '100%', justifyContent: 'center',
  },
  statusBannerText: { fontSize: 15, fontWeight: '700' },

  failedTip: {
    fontSize: 13, color: COLORS.inkSub,
    textAlign: 'center', marginBottom: 20, lineHeight: 20,
  },

  scanningRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    backgroundColor: COLORS.brandTint, paddingHorizontal: 16,
    paddingVertical: 10, borderRadius: 12, width: '100%', justifyContent: 'center',
  },
  scanningText: { fontSize: 14, color: COLORS.brandDeep, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: COLORS.brand, paddingVertical: 14,
    paddingHorizontal: 28, borderRadius: 14, marginBottom: 10,
    width: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  disabledBtn:     { backgroundColor: COLORS.border },
  primaryBtnText:  { color: 'white', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  outlineBtn: {
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14,
    width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  outlineBtnText: { color: COLORS.brand, fontSize: 14, fontWeight: '600' },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera:          { flex: 1 },
  noCamera:        { alignItems: 'center', justifyContent: 'center', gap: 10 },
  noCameraText:    { color: 'rgba(255,255,255,0.7)', fontSize: 14 },

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
    fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600', marginBottom: 2,
  },
  cameraTitle: { color: 'white', fontSize: 15, fontWeight: '700' },

  scanFrame: {
    position: 'absolute', top: height * 0.22,
    left: width * 0.1, width: width * 0.8, height: width * 0.8,
    justifyContent: 'center', alignItems: 'center',
  },
  corner:      { position: 'absolute', width: 26, height: 26, borderColor: COLORS.gold },
  topLeft:     { top: 0,    left: 0,  borderTopWidth: 3,    borderLeftWidth: 3,  borderTopLeftRadius: 6 },
  topRight:    { top: 0,    right: 0, borderTopWidth: 3,    borderRightWidth: 3, borderTopRightRadius: 6 },
  bottomLeft:  { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3,  borderBottomLeftRadius: 6 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  scanLineWrapper: { width: '88%', alignItems: 'center' },
  scanLine: { width: '100%', height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 1 },

  focusReticle: {
    position: 'absolute', width: 64, height: 64, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.gold,
  },

  shutterFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.brand,
  },

  scanHintWrap: {
    position: 'absolute', bottom: height * 0.21, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    maxWidth: '80%',
  },
  scanHint: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5 },

  zoomTrackWrap: {
    position: 'absolute', right: 16, top: '30%',
    alignItems: 'center', gap: 8,
  },
  zoomTrack: {
    width: 4, height: ZOOM_TRACK_HEIGHT, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'flex-end',
  },
  zoomFill: {
    width: '100%', borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  zoomThumb: {
    position: 'absolute', alignSelf: 'center',
    width: ZOOM_THUMB_SIZE, height: ZOOM_THUMB_SIZE, borderRadius: ZOOM_THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2, borderColor: COLORS.brand,
  },

  cameraBottomBar: { position: 'absolute', bottom: 48, width: '100%', alignItems: 'center' },
  captureButton: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3, borderColor: 'white',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'white' },
});