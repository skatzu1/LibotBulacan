// Geofenced "location" mission — a food recommendation pinned near the spot
// (set by a moderator/admin in the spot's edit form, subject to admin review).
// Unlike the AI/photo missions, there's no camera step: the user just needs
// to physically be within the pinned radius, verified server-side on
// completion.
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Image, StyleSheet, ActivityIndicator, StatusBar, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { showAlert } from "../components/AppAlert";
import { useMissions } from "../context/MissionContext";
import { useTheme, spacing, radius, typography, shadow, fonts } from "../context/ThemeContext";
import { ScreenHeader, PrimaryButton, H_PAD } from "../components/ui";
import Icon from "../components/Icon";
import { spotImage } from "../utils/image";
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

export default function LocationMission({ navigation, route }) {
  const { spot, mission } = route.params;
  const { colors, isDark } = useTheme();
  const { completeMission, completedMissions } = useMissions();
  const alreadyCompleted = completedMissions?.includes(mission._id);

  const radiusMeters = mission.radiusMeters || 60;
  const configured   = !!mission.locationConfigured;
  const target        = mission.coordinates;

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

  const distance = coords && target?.lat != null
    ? distanceMeters(coords.latitude, coords.longitude, target.lat, target.lng)
    : null;
  const inRange = distance != null && distance <= radiusMeters;

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

      {/* Scrolls so a long description or large font setting can't push the
          Complete button off a small screen. */}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {mission.image ? (
          <Image source={{ uri: spotImage(mission.image, 400, 200) }} style={[styles.restaurantImage, shadow.md]} resizeMode="cover" />
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: colors.brandSoft }]}>
            <Icon name="map-pin" size={30} color={colors.brand} />
          </View>
        )}

        <Text style={[typography.h2, styles.center, { color: colors.brandDark }]}>
          {mission.locationName || "Recommended spot"}
        </Text>
        <Text style={[typography.body, styles.center, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          {mission.description}
        </Text>

        {!!mission.locationInfo && (
          <View style={[styles.infoCard, { backgroundColor: colors.brandSoft }]}>
            <Text style={[typography.body, styles.center, { color: colors.textPrimary }]}>
              {mission.locationInfo}
            </Text>
          </View>
        )}

        {!configured ? (
          <View style={[styles.statusCard, { backgroundColor: colors.card, marginTop: spacing.xl }]}>
            <Icon name="clock" size={24} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
            <Text style={[typography.title, { color: colors.textPrimary }]}>Not ready yet</Text>
            <Text style={[typography.body, styles.center, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              This mission's location hasn't been set up yet. Check back soon!
            </Text>
          </View>
        ) : locError ? (
          <View style={[styles.statusCard, { backgroundColor: colors.dangerBg, marginTop: spacing.xl }]}>
            <Icon name="alert-triangle" size={24} color={colors.danger} style={{ marginBottom: spacing.sm }} />
            <Text style={[typography.body, styles.center, { color: colors.danger }]}>{locError}</Text>
          </View>
        ) : (
          <View style={[
            styles.statusCard,
            { backgroundColor: inRange ? colors.successBg : colors.card, marginTop: spacing.xl },
          ]}>
            {distance == null ? (
              <>
                <ActivityIndicator color={colors.brand} style={{ marginBottom: spacing.sm }} />
                <Text style={[typography.body, { color: colors.textSecondary }]}>Finding your location…</Text>
              </>
            ) : (
              <>
                <Icon
                  name={inRange ? "check-circle" : "navigation"}
                  size={28}
                  color={inRange ? colors.success : colors.brand}
                  style={{ marginBottom: spacing.sm }}
                />
                <Text style={[styles.distanceText, { color: inRange ? colors.success : colors.brandDark }]}>
                  {inRange ? "You're here!" : `${Math.round(distance)} m away`}
                </Text>
                <Text style={[typography.caption, styles.center, { color: colors.textMuted, marginTop: spacing.xs }]}>
                  {inRange
                    ? "You're within range — complete the activity below."
                    : `Get within ${radiusMeters} m of ${mission.locationName || "this spot"} to complete it.`}
                </Text>
              </>
            )}
          </View>
        )}

        {alreadyCompleted && (
          <View style={[styles.doneNote, { backgroundColor: colors.successBg }]}>
            <Icon name="check-circle" size={13} color={colors.success} />
            <Text style={[typography.caption, { color: colors.success, marginLeft: spacing.xs }]}>
              Already logged — you can still check in again.
            </Text>
          </View>
        )}

        <View style={styles.spacer} />

        {configured && !locError && (
          <PrimaryButton
            title="Complete Activity"
            onPress={handleComplete}
            loading={submitting}
            disabled={!coords}
            style={styles.completeBtn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1, paddingHorizontal: H_PAD, alignItems: "center" },
  center: { textAlign: "center" },

  iconWrap: {
    width: 68, height: 68, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginTop: spacing.lg, marginBottom: spacing.lg,
  },
  restaurantImage: {
    width: "100%", height: 160, borderRadius: radius.card,
    marginTop: spacing.lg, marginBottom: spacing.lg,
  },
  infoCard: {
    width: "100%", borderRadius: radius.card, padding: spacing.md,
    marginTop: spacing.md,
  },

  statusCard: {
    width: "100%", borderRadius: radius.card, padding: spacing.xl,
    alignItems: "center",
  },
  distanceText: { fontSize: 24, fontFamily: fonts.sansBold, letterSpacing: -0.4 },

  doneNote: {
    flexDirection: "row", alignItems: "center", borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.lg,
  },

  // Pushes the button to the bottom when there's room, keeps a gap when not.
  spacer:      { flexGrow: 1, minHeight: spacing.xl },
  completeBtn: { alignSelf: "stretch", marginBottom: spacing.xl },
});
