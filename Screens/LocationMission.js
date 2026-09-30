// Geofenced "location" mission — a food recommendation pinned near the spot
// (set by a moderator/admin in the spot's edit form, subject to admin review).
// Unlike the AI/photo missions, there's no camera step: the user just needs
// to physically be within the pinned radius, verified server-side on
// completion. A live map (components/MissionMap.js) shows them and the eatery
// so they can walk there.
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Image, StyleSheet, ActivityIndicator, StatusBar, ScrollView,
  TouchableOpacity, Linking, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { showAlert, showToast } from "../components/AppAlert";
import { useMissions } from "../context/MissionContext";
import {
  useTheme, spacing, radius, typography, shadow, fonts, MAX_FONT_SCALE,
} from "../context/ThemeContext";
import { ScreenHeader, PrimaryButton, H_PAD } from "../components/ui";
import Icon from "../components/Icon";
import MissionMap from "../components/MissionMap";
import { spotImage } from "../utils/image";
import { getSpotCoords } from "../utils/arLocationGate";
import { GpsSmoother, isBetterFix, MAX_USABLE_ACCURACY_M } from "../utils/gpsFilter";

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 83 m · 1.4 km · 31 km
function fmtDistance(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
}

// Live distance readout floated over the map's bottom-left corner.
function MapStatus({ distance, inRange, radiusMeters }) {
  const { colors } = useTheme();
  const locating = distance == null;
  const primary = locating ? "Finding you…" : inRange ? "You're here!" : `${fmtDistance(distance)} away`;
  const secondary = locating ? "Checking your location" : `Get within ${radiusMeters} m`;
  return (
    <View
      style={[styles.statusChip, { backgroundColor: colors.card }, shadow.md]}
      accessible
      accessibilityLabel={`${primary}. ${secondary}.`}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.statusIcon, { backgroundColor: inRange ? colors.success : colors.brand }]}>
        {locating ? (
          <ActivityIndicator size="small" color={colors.onBrand} />
        ) : (
          <Icon
            name={inRange ? "check" : "navigation"}
            size={15}
            color={inRange ? colors.card : colors.onBrand}
            weight={inRange ? "bold" : "fill"}
          />
        )}
      </View>
      <View style={styles.statusText}>
        <Text
          style={[styles.statusPrimary, { color: inRange ? colors.success : colors.textPrimary }]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        >
          {primary}
        </Text>
        <Text
          style={[styles.statusSecondary, { color: colors.textMuted }]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        >
          {secondary}
        </Text>
      </View>
    </View>
  );
}

export default function LocationMission({ navigation, route }) {
  const { spot, mission } = route.params;
  const { colors, isDark } = useTheme();
  const { height: winH } = useWindowDimensions();
  const { completeMission, completedMissions } = useMissions();
  const alreadyCompleted = completedMissions?.includes(mission._id);

  const radiusMeters = mission.radiusMeters || 60;
  const configured   = !!mission.locationConfigured;
  const target        = mission.coordinates;
  const hasPin = configured && Number.isFinite(target?.lat) && Number.isFinite(target?.lng);
  const placeName = mission.locationName || "Recommended spot";

  // "83 m from Barasoain Church" — places the eatery relative to the spot
  // the user came here for.
  const spotAt = getSpotCoords(spot);
  const spotName = spot?.name?.trim() || "";
  const fromSpot = hasPin && spotAt && spotName
    ? distanceMeters(spotAt.lat, spotAt.lng, target.lat, target.lng)
    : null;

  // Tall enough to walk by, short enough to leave the details on screen.
  const mapHeight = Math.round(Math.min(360, Math.max(220, winH * 0.38)));

  const [coords, setCoords]       = useState(null);
  const [locError, setLocError]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const watchRef = useRef(null);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;

    const start = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) setLocError("Location permission is needed to check how close you are.");
          return;
        }
        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;
        setCoords({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });

        // These coordinates are what the server checks against the mission's
        // radius, so filter them like the AR screen does (utils/gpsFilter.js):
        // skip vague fixes, never swap a GPS fix for a worse network one, and
        // smooth the jitter so "in range" doesn't flicker at the edge.
        let best = {
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
          accuracy: initial.coords.accuracy,
          timestamp: initial.timestamp || Date.now(),
        };
        const smoother = new GpsSmoother();
        smoother.push(best);

        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 3 },
          (loc) => {
            if (cancelled) return;
            const next = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
              timestamp: loc.timestamp || Date.now(),
            };
            if (Number.isFinite(next.accuracy) && next.accuracy > MAX_USABLE_ACCURACY_M) return;
            if (!isBetterFix(best, next)) return;
            best = next;
            const s = smoother.push(next);
            setCoords({ latitude: s.latitude, longitude: s.longitude });
          }
        );
      } catch {
        if (!cancelled) setLocError("Unable to get your location. Please try again.");
      }
    };

    start();
    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [configured]);

  const distance = coords && hasPin
    ? distanceMeters(coords.latitude, coords.longitude, target.lat, target.lng)
    : null;
  const inRange = distance != null && distance <= radiusMeters;

  // Turn-by-turn is handed to Google Maps (app if installed, else browser).
  const openDirections = async () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=walking`;
    try {
      await Linking.openURL(url);
    } catch {
      showToast("Couldn't open directions on this device.", { type: "error" });
    }
  };

  const handleComplete = async () => {
    if (!coords) {
      showAlert("Location not ready", "Still finding your location — try again in a moment.");
      return;
    }
    setSubmitting(true);
    const data = await completeMission(mission._id, {
      lat: coords.latitude,
      lng: coords.longitude,
    });
    setSubmitting(false);

    if (!data) {
      showAlert("Error", "Could not reach the server. Please try again.");
      return;
    }
    if (data.noLocation) {
      showAlert("Not Ready Yet", `The location for "${mission.title}" isn't set up yet. Check back soon!`);
      return;
    }
    if (data.tooFar) {
      showAlert(
        "You're not close enough",
        `You're about ${data.distance}m away — get within ${data.radiusMeters}m to complete this activity.`,
        undefined,
        { tone: "warning", icon: "map-pin" },
      );
      return;
    }
    showAlert(
      "Nice work!",
      data.alreadyCompleted
        ? "You've already completed this activity."
        : `"${mission.title}" is confirmed and logged as complete.`,
      [{ text: "Back to Bakit List", onPress: () => navigation.goBack() }],
    );
  };

  return (
    // ScreenHeader pads for the top inset itself, so only the bottom edge here.
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      <ScreenHeader title={mission.title} onBack={() => navigation.goBack()} />

      {/* Outside the ScrollView on purpose: a map inside one fights it for
          every drag. */}
      {hasPin && (
        <MissionMap
          target={target}
          radiusMeters={radiusMeters}
          placeName={mission.locationName}
          user={coords}
          inRange={inRange}
          height={mapHeight}
          style={styles.map}
        >
          <View style={styles.mapFooter} pointerEvents="box-none">
            {!locError && (
              <MapStatus distance={distance} inRange={inRange} radiusMeters={radiusMeters} />
            )}
            {!inRange && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Walking directions to ${placeName} in Google Maps`}
                onPress={openDirections}
                style={[styles.dirPill, { backgroundColor: colors.card }, shadow.md]}
                activeOpacity={0.85}
              >
                <Icon name="arrow-up-right" size={15} color={colors.brand} weight="bold" />
                <Text
                  style={[styles.dirText, { color: colors.textPrimary }]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                >
                  Directions
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </MissionMap>
      )}

      {/* Scrolls so a long description or large font setting can't push
          anything off a small screen. */}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.placeRow}>
          {mission.image ? (
            <Image
              source={{ uri: spotImage(mission.image, 160, 160) }}
              style={[styles.thumb, { backgroundColor: colors.brandSoft }]}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.brandSoft }]}>
              <Icon name="map-pin" size={26} color={colors.brand} />
            </View>
          )}
          <View style={styles.placeText}>
            <Text style={[typography.label, styles.kicker, { color: colors.textMuted }]}>NEARBY EATS</Text>
            <Text style={[typography.h2, { color: colors.brandDark }]} numberOfLines={2}>
              {placeName}
            </Text>
            {fromSpot != null && (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
                {fmtDistance(fromSpot)} from {spotName}
              </Text>
            )}
          </View>
        </View>

        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.lg }]}>
          {mission.description}
        </Text>

        {!!mission.locationInfo && (
          <View style={[styles.infoCard, { backgroundColor: colors.brandSoft }]}>
            <Text style={[typography.body, { color: colors.textPrimary }]}>
              {mission.locationInfo}
            </Text>
          </View>
        )}

        {!configured ? (
          <View style={[styles.statusCard, { backgroundColor: colors.card }]}>
            <Icon name="clock" size={24} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
            <Text style={[typography.title, { color: colors.textPrimary }]}>Not ready yet</Text>
            <Text style={[typography.body, styles.center, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              This mission's location hasn't been set up yet. Check back soon!
            </Text>
          </View>
        ) : locError ? (
          <View style={[styles.statusCard, { backgroundColor: colors.dangerBg }]}>
            <Icon name="alert-triangle" size={24} color={colors.danger} style={{ marginBottom: spacing.sm }} />
            <Text style={[typography.body, styles.center, { color: colors.danger }]}>{locError}</Text>
          </View>
        ) : null}

        {alreadyCompleted && (
          <View style={[styles.doneNote, { backgroundColor: colors.successBg }]}>
            <Icon name="check-circle" size={13} color={colors.success} />
            <Text style={[typography.caption, { color: colors.success, marginLeft: spacing.xs }]}>
              Already logged — you can still check in again.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Pinned, so it's reachable without scrolling while walking. */}
      {configured && !locError && (
        <View style={[styles.footer, { borderTopColor: colors.divider }]}>
          <PrimaryButton
            title="Complete Activity"
            onPress={handleComplete}
            loading={submitting}
            disabled={!coords}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { textAlign: "center" },

  map: { marginHorizontal: H_PAD, marginTop: spacing.xs },
  mapFooter: {
    position: "absolute", left: 10, right: 10, bottom: 10,
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
  },
  statusChip: {
    flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: radius.lg,
  },
  statusIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },
  statusText: { flexShrink: 1 },
  statusPrimary: { fontSize: 15, fontFamily: fonts.sansBold, letterSpacing: -0.2 },
  statusSecondary: { fontSize: 11.5, fontFamily: fonts.sansMedium, marginTop: 1 },
  // marginLeft:auto keeps it right-aligned even when the status chip is hidden.
  dirPill: {
    marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6,
    height: 40, paddingHorizontal: 14, borderRadius: radius.pill,
  },
  dirText: { fontSize: 13.5, fontFamily: fonts.sansSemi },

  body: { flexGrow: 1, paddingHorizontal: H_PAD, paddingTop: spacing.lg, paddingBottom: spacing.xl },

  placeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 76, height: 76, borderRadius: radius.md },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  placeText: { flex: 1 },
  kicker: { letterSpacing: 1.2, marginBottom: 2 },

  infoCard: {
    borderRadius: radius.card, padding: spacing.md,
    marginTop: spacing.md,
  },

  statusCard: {
    borderRadius: radius.card, padding: spacing.xl,
    alignItems: "center", marginTop: spacing.xl,
  },

  doneNote: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.lg,
  },

  footer: {
    paddingHorizontal: H_PAD, paddingTop: spacing.md, paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
