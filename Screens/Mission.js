// AI Scan — the photo mission. The traveler photographs the spot's object (the
// Philippine flag at a historical spot, a cross at a religious one); the server
// checks the photo and where it was taken, and completes the mission and pays
// its points in the same step (app.js POST /api/verify).
//
// Kept simple on purpose (2026-10-20, "make the AI mission UI simple"): one
// line saying what to photograph, the photo once taken, one status line, one
// button. The greeting, the ticket card, the four-step guide, the confidence
// meter (and any "AI match" percentage — the user asked for it gone), the
// zoom slider and the extra "Mark as Done" tap are gone — the server has
// already completed the mission by the time the photo is accepted.
import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  StatusBar,
  Animated,
  PanResponder,
} from 'react-native';
// Not React Native's own SafeAreaView: that one only pads on iOS, so on
// Android (edge to edge) the camera's close and flip buttons sat under the
// status bar.
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from "../components/AppAlert";
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { runPrediction } from '../utils/missionAI';
import { celebrateResult } from '../utils/rewards';
import { ensureAtSpotForPhoto, currentCoords } from '../utils/arLocationGate';
import { ensureCameraAccess } from '../utils/cameraAccess';
import { missionKind } from '../utils/missionTiers';
import * as Haptics from "expo-haptics";
import { useTheme, fonts, typography, spacing, radius, MAX_FONT_SCALE } from '../context/ThemeContext';
import { useMissions } from '../context/MissionContext';
import { ScreenHeader, PrimaryButton, H_PAD } from '../components/ui';
import Icon from "../components/Icon";

const { width, height } = Dimensions.get('window');

// ─── Scan frame geometry (must match scanFrame style below) ───────────────────
const FRAME_TOP_RATIO  = 0.22;  // matches scanFrame.top: height * 0.22
const FRAME_LEFT_RATIO = 0.1;   // matches scanFrame.left: width * 0.1
const FRAME_SIZE_RATIO = 0.8;   // matches scanFrame.width/height: width * 0.8

// Crops the captured photo down to exactly the square region the user saw
// inside the on-screen scan frame. Two things make this fiddly:
//
//  1. The camera preview is displayed "cover" — scaled uniformly to fill the
//     screen with the overflow clipped — so the raw photo's aspect ratio
//     differs from what was visible on screen.
//  2. On Android, vision-camera returns the photo as raw *sensor* pixels
//     (usually landscape) plus an EXIF rotation flag; it does NOT rotate the
//     pixels. expo-image-manipulator bakes that rotation in before applying
//     any op, so we must measure the image AFTER an orientation-normalising
//     round-trip — never from the width/height vision-camera reports.
//
// The first pass also shrinks the photo to WORK_WIDTH_PX. A phone camera's full
// 12–64 MP took seconds to re-encode, twice, and the AI only ever looks at a
// 448-pixel copy (utils/missionAI.js) — 1280 is plenty for that and for the
// preview, which is as wide as the phone.
const WORK_WIDTH_PX = 1280;

async function cropToScanFrame(uri) {
  try {
    // Normalises EXIF orientation as it shrinks, so width/height and the crop
    // rect below are all in the same (upright) coordinate space.
    const normalized = await ImageManipulator.manipulateAsync(
      uri, [{ resize: { width: WORK_WIDTH_PX } }], { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
    );

    const photoW = normalized.width;
    const photoH = normalized.height;
    if (!photoW || !photoH) return normalized.uri;

    const screenAspect = width / height;
    const photoAspect  = photoW / photoH;

    // The portion of the photo that was actually visible on screen under the
    // "cover" fit.
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

    // Photo pixels per screen point — uniform on both axes for a "cover" fit.
    const scale = visibleW / width;

    const originX = Math.max(0, Math.round(offsetX + FRAME_LEFT_RATIO * width  * scale));
    const originY = Math.max(0, Math.round(offsetY + FRAME_TOP_RATIO  * height * scale));
    // Keep it square, and never run past the image edges.
    const size = Math.round(
      Math.min(FRAME_SIZE_RATIO * width * scale, photoW - originX, photoH - originY)
    );

    const result = await ImageManipulator.manipulateAsync(
      normalized.uri,
      [{ crop: { originX, originY, width: size, height: size } }],
      { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
    );

    return result.uri;
  } catch (err) {
    console.error('Crop error:', err);
    return uri;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Mission({ navigation, route }) {
  const { spot, mission } = route.params;

  // "the Philippine flag" — computed server-side from the spot's category
  // (missionRoutes.js), so it can't drift from the model that checks the photo.
  const target = mission.aiTargetPhrase || mission.title;
  const heading = mission.aiTargetPhrase ? `Take a photo of ${mission.aiTargetPhrase}` : mission.title;
  const cameraTitle = mission.aiTargetLabel || mission.title;

  const { getToken } = useAuth();
  const { completedMissions, markCompleted } = useMissions();
  const alreadyCompleted = completedMissions?.includes(mission._id);
  const { colors, isDark } = useTheme();

  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  // Where the phone was when the camera opened — the fallback if a fresh fix
  // can't be had at the moment the photo is taken.
  const photoCoordsRef = useRef(null);
  // True from the shutter until the photo's answer is in.
  const shootingRef = useRef(false);
  const { hasPermission } = useCameraPermission();
  const isFocused = useIsFocused();
  const [cameraOpen, setCameraOpen]       = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  // True while openCamera checks the user is at the spot, so the button says
  // so instead of looking like it ignored the tap.
  const [checkingSpot, setCheckingSpot] = useState(false);
  // pending · scanning · approved · failed
  const [status, setStatus]             = useState('pending');
  const [pointsEarned, setPointsEarned] = useState(0);
  const [facing, setFacing]             = useState('back');
  const device = useCameraDevice(facing);

  // `zoom` is a 0–1 fraction set by pinching; it's mapped onto the device's
  // real zoom-factor range before being handed to <Camera>. Capping at
  // neutralZoom×8 keeps pinching usable on devices that report an enormous
  // maxZoom (e.g. 128×). The ref lets the pinch handler, created once, start
  // each pinch from the current zoom rather than from the first render's.
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  const applyZoom = (z) => { zoomRef.current = z; setZoom(z); };
  const zoomFactor = useMemo(() => {
    if (!device) return 1;
    const max = Math.min(device.maxZoom, device.neutralZoom * 8);
    return device.neutralZoom + zoom * (max - device.neutralZoom);
  }, [device, zoom]);

  // Reticle position is plain state (just drives style, not mount/unmount) —
  // the reticle View below is ALWAYS mounted. Android's CameraView is backed
  // by a SurfaceView, which composites via a "hole punch" outside RN's normal
  // view diffing. Conditionally mounting/unmounting a sibling view on top of
  // it forces Android to re-punch that hole and recomposite for a frame —
  // since the buffer swap isn't synced with the surrounding layout pass, you
  // get a torn frame where part of the screen still shows the old camera image
  // and part shows raw black. Keeping the view permanently mounted and only
  // animating its opacity/position avoids that entirely.
  const [reticlePos, setReticlePos] = useState({ x: 0, y: 0 });
  const reticleAnim       = useRef(new Animated.Value(0)).current;
  const flashAnim         = useRef(new Animated.Value(0)).current;
  const zoomStartRef      = useRef(0);
  const pinchStartDistRef = useRef(null);
  const touchStartRef     = useRef({ time: 0, touches: 1 });

  const openCamera = async () => {
    // Asks the phone's permission prompt if it hasn't been answered, and
    // explains a refusal with a way to Settings (utils/cameraAccess.js).
    if (!hasPermission && !(await ensureCameraAccess('to take mission photos'))) return;
    // The photo only counts if it's taken at the spot (the server checks the
    // position sent with it), so say so now rather than after the photo.
    if (checkingSpot) return;
    setCheckingSpot(true);
    let coords;
    try {
      coords = await ensureAtSpotForPhoto(spot);
    } finally {
      setCheckingSpot(false);
    }
    if (!coords) return;
    photoCoordsRef.current = coords;

    setCapturedImage(null);
    setStatus('pending');
    applyZoom(0);
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

  // ── One responder for BOTH tap-to-focus and pinch-to-zoom ───────────────
  // Combined so the two gestures don't fight over the responder (a separate
  // TouchableWithoutFeedback + PanResponder pair on the same view clobber
  // each other's touch handlers).
  const gestureResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        touchStartRef.current = { time: Date.now(), touches: touches.length };
        pinchStartDistRef.current = null;
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length !== 2) return;
        touchStartRef.current.touches = 2;
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (!pinchStartDistRef.current) {
          pinchStartDistRef.current = dist;
          zoomStartRef.current = zoomRef.current;
          return;
        }
        const delta = (dist - pinchStartDistRef.current) / width;
        applyZoom(Math.max(0, Math.min(1, zoomStartRef.current + delta)));
      },
      onPanResponderRelease: (evt) => {
        const { time, touches } = touchStartRef.current;
        // A quick single-finger tap (no pinch involved) focuses there.
        if (touches === 1 && Date.now() - time < 300) {
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

  const takePhoto = async () => {
    // A second tap while a photo is on its way does nothing.
    if (!cameraRef.current || shootingRef.current) return;
    shootingRef.current = true;
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

      // The photo is taken: leave the camera now. Cropping it, finding where
      // the phone is and the server's check all happen behind "Checking your
      // photo…". They used to happen first, on a frozen camera, and the wait
      // for a brand-new GPS fix alone had no limit (2026-10-20, "a lag").
      setCameraOpen(false);
      setCapturedImage(null);
      setStatus('scanning');

      const [croppedUri, coords] = await Promise.all([
        // Exactly what the user saw inside the scan frame, so the AI analyzes
        // the same region the guide shows.
        cropToScanFrame(photoUri),
        // Where the photo was taken: a reading from the last 15 s if the
        // phone has one, else a fresh one for up to 4 s, else where it was
        // when the camera opened (just checked to be at the spot).
        currentCoords({ maxAgeMs: 15000, timeoutMs: 4000 }).then((c) => c || photoCoordsRef.current),
      ]);
      setCapturedImage(croppedUri);

      const result = await runPrediction(croppedUri, mission._id, getToken, coords);

      if (!result) {
        showAlert('Error', 'Could not analyze image. Please try again.');
        setStatus('failed');
        return;
      }

      if (result.error) {
        showAlert('Not accepted', result.error);
        setStatus('pending');
        return;
      }

      // If backend says no model exists yet for this mission
      if (result.noModel) {
        showAlert(
          'Not Ready Yet',
          `Verification for "${mission.title}" isn't set up yet. Check back soon!`
        );
        setStatus('pending');
        return;
      }

      if (result.tooFar) {
        const away = result.distance >= 1000
          ? `${(result.distance / 1000).toFixed(1)} km`
          : `${result.distance} m`;
        showAlert(
          `You're not at ${spot?.name || 'the spot'}`,
          `This photo was taken about ${away} away. Photo missions only count when the photo is taken at the spot itself.`
        );
        setStatus('pending');
        return;
      }

      if (result.noLocation) {
        showAlert(
          'Not Ready Yet',
          `This spot's location isn't set up yet, so its photo mission can't be checked. Check back soon!`
        );
        setStatus('pending');
        return;
      }

      setStatus(result.verified ? 'approved' : 'failed');
      if (result.verified) {
        setPointsEarned(result.pointsAwarded || 0);
        // One of the few genuine reward moments in the app: it should register
        // physically, not just visually.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      // The server completed the mission and awarded its points along with the
      // verification — reflect that straight away.
      if (result.completed) markCompleted(mission._id);
      // The spot's badge (and more) if that was the last step; otherwise how
      // far along the spot is.
      if (result.verified) celebrateResult(result);
    } catch (error) {
      console.error('Camera error:', error);
      setStatus('failed');
    } finally {
      shootingRef.current = false;
    }
  };

  const flipCamera  = () => setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  const closeCamera = () => { setCameraOpen(false); setStatus('pending'); };

  // ─── CAMERA VIEW ──────────────────────────────────────────────────────────
  if (cameraOpen) {
    return (
      <View style={styles.cameraContainer}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1 }} {...gestureResponder.panHandlers}>
          {device == null ? (
            <View style={[StyleSheet.absoluteFill, styles.noCamera]}>
              <Icon name="camera-off" size={28} color="rgba(255,255,255,0.7)" />
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
              // The fastest capture. "quality" made the shutter slow, and the
              // AI only looks at a 448-pixel copy of the photo anyway.
              photoQualityBalance="speed"
              enableZoomGesture={false}
            />
          )}

          <SafeAreaView edges={['top']} style={styles.cameraTopBar}>
            <TouchableOpacity
              accessibilityRole="button" accessibilityLabel="Close camera" onPress={closeCamera} style={styles.cameraIconBtn}>
              <Icon name="x" size={20} color="white" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {cameraTitle}
            </Text>
            <TouchableOpacity
              accessibilityRole="button" accessibilityLabel="Switch camera" onPress={flipCamera} style={styles.cameraIconBtn}>
              <Icon name="refresh-cw" size={18} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.scanFrame} pointerEvents="none">
            <View style={[styles.corner, styles.topLeft,     { borderColor: colors.accent }]} />
            <View style={[styles.corner, styles.topRight,    { borderColor: colors.accent }]} />
            <View style={[styles.corner, styles.bottomLeft,  { borderColor: colors.accent }]} />
            <View style={[styles.corner, styles.bottomRight, { borderColor: colors.accent }]} />
          </View>

          {/* Focus reticle — ALWAYS mounted; see the note above reticlePos. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.focusReticle,
              {
                borderColor: colors.accent,
                left: reticlePos.x - 32,
                top:  reticlePos.y - 32,
                opacity: reticleAnim,
                transform: [{
                  scale: reticleAnim.interpolate({ inputRange: [0, 1], outputRange: [1.3, 1] }),
                }],
              },
            ]}
          />

          {/* Custom shutter flash (replaces native flash animation) */}
          <Animated.View
            pointerEvents="none"
            style={[styles.shutterFlash, { backgroundColor: colors.brand, opacity: flashAnim }]}
          />

          <View style={styles.scanHintWrap} pointerEvents="none">
            <Text style={styles.scanHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Keep {target} inside the frame
            </Text>
          </View>

          <View style={[styles.cameraBottomBar, { bottom: Math.max(48, insets.bottom + 24) }]}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Take the photo"
              accessibilityHint="Checks it against this mission"
              style={styles.captureButton} onPress={takePhoto} activeOpacity={0.8}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ─── MAIN SCREEN ──────────────────────────────────────────────────────────
  const done = status === 'approved' || alreadyCompleted;
  const result =
    status === 'scanning' ? {
      icon: null, bg: colors.brandSoft, fg: colors.brandDark,
      text: 'Checking your photo…',
    } : status === 'approved' ? {
      icon: 'check-circle', bg: colors.successBg, fg: colors.success,
      text: pointsEarned > 0 ? `Found it! +${pointsEarned} points` : 'Found it! This one is done.',
    } : status === 'failed' ? {
      icon: 'x-circle', bg: colors.dangerBg, fg: colors.danger,
      text: `Couldn't find ${target}. Get closer, in good light, and try again.`,
    } : alreadyCompleted ? {
      icon: 'check-circle', bg: colors.successBg, fg: colors.success,
      text: 'Already done. You can scan again for fun.',
    } : null;

  return (
    // ScreenHeader pads for the top inset itself, so only the bottom edge here.
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* The step's name from the Bakit List ("AI Scan"), like Nearby Eats. */}
      <ScreenHeader title={missionKind(mission).label} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.headRow}>
          <View style={[styles.tile, { backgroundColor: done ? colors.successBg : colors.brandSoft }]}>
            <Icon name={done ? 'check' : 'camera'} size={26} color={done ? colors.success : colors.brand} />
          </View>
          <View style={styles.headText}>
            <Text style={[typography.h2, { color: colors.brandDark }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {heading}
            </Text>
            <Text
              style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
              numberOfLines={2}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            >
              {[spot?.name, mission.points ? `${mission.points} points` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        {/* Square, like the scan frame it was cropped to. Before a photo it
            holds the frame itself, so the screen isn't empty and the photo
            lands in the same place. */}
        {capturedImage ? (
          <Image
            source={{ uri: capturedImage }}
            style={[styles.preview, { backgroundColor: colors.brandSoft }]}
            resizeMode="cover"
            accessibilityLabel="The photo you took"
          />
        ) : (
          <View style={[styles.preview, styles.slot, { backgroundColor: colors.brandSoft }]}>
            <View style={[styles.slotCorner, styles.topLeft,     { borderColor: colors.brand }]} />
            <View style={[styles.slotCorner, styles.topRight,    { borderColor: colors.brand }]} />
            <View style={[styles.slotCorner, styles.bottomLeft,  { borderColor: colors.brand }]} />
            <View style={[styles.slotCorner, styles.bottomRight, { borderColor: colors.brand }]} />
            {status === 'scanning' ? (
              // The photo is taken and being cropped; it shows in a moment.
              <ActivityIndicator size="large" color={colors.brand} />
            ) : (
              <>
                <Icon name="camera" size={40} color={colors.brand} />
                <Text style={[typography.body, styles.center, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                  Your photo shows here
                </Text>
              </>
            )}
          </View>
        )}

        {!!result && (
          <View
            style={[styles.result, { backgroundColor: result.bg }]}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={result.text}
          >
            {result.icon
              ? <Icon name={result.icon} size={18} color={result.fg} />
              : <ActivityIndicator size="small" color={result.fg} />}
            <Text style={[styles.resultText, { color: result.fg }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {result.text}
            </Text>
          </View>
        )}

        {/* What makes a photo count — the usual reasons one is turned down. */}
        {status !== 'approved' && (
          <View style={styles.tips}>
            {[
              { icon: 'map-pin',  text: `Take it at ${spot?.name || 'the spot'}. Photos from anywhere else don't count.` },
              { icon: 'maximize', text: `Fit ${target} inside the frame.` },
              { icon: 'sun',      text: 'Use good light and hold the phone still.' },
            ].map((tip) => (
              <View key={tip.icon} style={styles.tip}>
                <Icon name={tip.icon} size={18} color={colors.brand} />
                <Text style={[typography.body, styles.tipText, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {tip.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Pinned, so it's in reach with the phone held up at the spot. */}
      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        {status === 'approved' ? (
          <PrimaryButton title="Back to Bakit List" onPress={() => navigation.goBack()} />
        ) : (
          <PrimaryButton
            title={status === 'failed' ? 'Try Again' : 'Open Camera'}
            icon="camera"
            onPress={openCamera}
            loading={checkingSpot || status === 'scanning'}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  body:   { flexGrow: 1, paddingHorizontal: H_PAD, paddingTop: spacing.lg, paddingBottom: spacing.xl },

  headRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tile:     { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1 },

  preview: { width: '100%', aspectRatio: 1, borderRadius: radius.card, marginTop: spacing.lg },
  slot:       { alignItems: 'center', justifyContent: 'center' },
  // The camera's frame corners, inset into the empty slot.
  slotCorner: { position: 'absolute', width: 34, height: 34, margin: 18 },
  center:     { textAlign: 'center' },

  tips:    { marginTop: spacing.lg, gap: spacing.md },
  tip:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  tipText: { flex: 1 },

  result: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.card, paddingHorizontal: spacing.md, paddingVertical: 12,
    marginTop: spacing.md,
  },
  resultText: { flex: 1, fontSize: 14.5, lineHeight: 20, fontFamily: fonts.sansSemi },

  footer: {
    paddingHorizontal: H_PAD, paddingTop: spacing.md, paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  noCamera:        { alignItems: 'center', justifyContent: 'center', gap: 10 },
  noCameraText:    { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: fonts.sansMedium },

  cameraTopBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cameraIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraTitle: { flex: 1, textAlign: 'center', color: 'white', fontSize: 15, fontFamily: fonts.sansBold },

  scanFrame: {
    position: 'absolute', top: height * 0.22,
    left: width * 0.1, width: width * 0.8, height: width * 0.8,
  },
  corner:      { position: 'absolute', width: 26, height: 26 },
  topLeft:     { top: 0,    left: 0,  borderTopWidth: 3,    borderLeftWidth: 3,  borderTopLeftRadius: 6 },
  topRight:    { top: 0,    right: 0, borderTopWidth: 3,    borderRightWidth: 3, borderTopRightRadius: 6 },
  bottomLeft:  { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3,  borderBottomLeftRadius: 6 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },

  focusReticle: {
    position: 'absolute', width: 64, height: 64, borderRadius: 8, borderWidth: 2,
  },

  shutterFlash: { ...StyleSheet.absoluteFillObject },

  scanHintWrap: {
    position: 'absolute', bottom: height * 0.21, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    maxWidth: '80%',
  },
  scanHint: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontFamily: fonts.sansMedium, textAlign: 'center' },

  // `bottom` comes from the insets at render: clear of the navigation bar.
  cameraBottomBar: { position: 'absolute', width: '100%', alignItems: 'center' },
  captureButton: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3, borderColor: 'white',
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'white' },
});
