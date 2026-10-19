import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import SpotPicker from "../components/SpotPicker";
import Icon from "../components/Icon";
import { useArrival } from "../context/ArrivalContext";
import { useMissions } from "../context/MissionContext";
import { usePoints } from "../context/PointsContext";
import { useTheme, fonts, radius, MAX_FONT_SCALE } from "../context/ThemeContext";
import { spotSteps } from "../utils/missionTiers";
import { spotImage } from "../utils/image";

// The Bakit List quick action: where the traveler stands on every spot's list
// (QA 2026-10-16: "a way to see Bakit List progress from the quick action").
// It used to be a "2/5 done" chip on each photo, which didn't say what the 5
// were (user, 2026-10-20: "the ui is so confusing"). Now: a summary, the spots
// divided into In progress / Not started / Finished, and each spot's items by
// name, ticked off — the same items, in the same order, as its spot page
// (utils/missionTiers.js spotSteps).
const THUMB = 64;

const SECTIONS = [
  { key: "started",  title: "In progress", sub: "Pick up where you left off." },
  { key: "todo",     title: "Not started", sub: "Arriving at the spot ticks the first item." },
  { key: "finished", title: "Finished",    sub: "Every item done." },
];

const stateOf = ({ done, total }) => (done === 0 ? "todo" : done === total ? "finished" : "started");

export default function MissionsSpotSelect() {
  const { allSpots } = useArrival();
  const { getMissionsForSpot, completedMissions } = useMissions();
  const { hasVisited } = usePoints();
  const { colors } = useTheme();

  // Per spot: its steps, and how many are done.
  const progress = useMemo(() => {
    const out = new Map();
    for (const spot of allSpots) {
      const steps = spotSteps(getMissionsForSpot(spot._id), completedMissions, hasVisited(spot._id));
      out.set(String(spot._id), { steps, done: steps.filter((st) => st.done).length, total: steps.length });
    }
    return out;
  }, [allSpots, getMissionsForSpot, completedMissions, hasVisited]);
  const progressOf = useCallback((spot) => progress.get(String(spot._id)) || { steps: [], done: 0, total: 0 }, [progress]);

  const summary = useMemo(() => {
    const all = [...progress.values()];
    const count = (state) => all.filter((p) => stateOf(p) === state).length;
    return {
      spots:    all.length,
      done:     all.reduce((n, p) => n + p.done, 0),
      total:    all.reduce((n, p) => n + p.total, 0),
      started:  count("started"),
      todo:     count("todo"),
      finished: count("finished"),
    };
  }, [progress]);

  // In progress first, furthest along on top; the rest keep the list's order.
  const sections = useCallback((spots) => SECTIONS.map((sec) => {
    const data = spots.filter((s) => stateOf(progressOf(s)) === sec.key);
    if (sec.key === "started") {
      data.sort((a, b) => {
        const pa = progressOf(a), pb = progressOf(b);
        return pb.done / pb.total - pa.done / pa.total;
      });
    }
    return { ...sec, data };
  }), [progressOf]);

  const header = summary.spots > 0 ? (
    <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Text style={[styles.summaryKicker, { color: colors.textMuted }]}>YOUR BAKIT LIST</Text>
      <Text style={[styles.summaryTitle, { color: colors.textPrimary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {summary.done} of {summary.total} things done
      </Text>
      <ProgressBar done={summary.done} total={summary.total} color={colors.brand} track={colors.brandLight} height={8} />
      <View style={styles.counts}>
        <Count n={summary.started}  label="In progress" color={colors.brand} />
        <View style={[styles.countSep, { backgroundColor: colors.divider }]} />
        <Count n={summary.todo}     label="Not started" color={colors.textSecondary} />
        <View style={[styles.countSep, { backgroundColor: colors.divider }]} />
        <Count n={summary.finished} label="Finished"    color={colors.success} />
      </View>
    </View>
  ) : null;

  return (
    <SpotPicker
      title="Bakit List"
      subtitle="Every spot's list of things to do there. Tap a spot to see its list and start one."
      header={header}
      sections={sections}
      renderCard={(spot, onPress) => <BakitCard spot={spot} progress={progressOf(spot)} onPress={onPress} />}
      // The Mission screen needs both a spot AND a chosen activity, so route
      // through the spot's detail page, opening straight on its Bakit List tab.
      onPick={(spot, navigation) =>
        navigation.navigate("InformationScreen", { spot, tab: "BucketList" })
      }
    />
  );
}

function Count({ n, label, color }) {
  const { colors } = useTheme();
  return (
    <View style={styles.count} accessible accessibilityLabel={`${n} ${label.toLowerCase()}`}>
      <Text style={[styles.countN, { color }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{n}</Text>
      <Text style={[styles.countLabel, { color: colors.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label}</Text>
    </View>
  );
}

function ProgressBar({ done, total, color, track, height = 6 }) {
  const ratio = total > 0 ? done / total : 0;
  return (
    <View
      style={[styles.track, { backgroundColor: track, height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      <View style={{ width: `${ratio * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

// One spot: photo, name and town, a bar, and its items by name — done ones
// filled with a tick, the rest outlined with what they are.
function BakitCard({ spot, progress, onPress }) {
  const { colors } = useTheme();
  const { steps, done, total } = progress;
  const finished = total > 0 && done === total;
  const tint = finished ? colors.success : colors.brand;
  const label = [
    spot.name, spot.city,
    finished ? "Bakit List finished" : `${done} of ${total} done`,
    ...steps.map((st) => `${st.label} ${st.done ? "done" : "not done"}`),
  ].filter(Boolean).join(", ");

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: finished ? colors.success : colors.cardBorder }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens this spot's Bakit List"
    >
      <View style={styles.cardTop}>
        {spot.image ? (
          <Image source={{ uri: spotImage(spot.image, THUMB * 2, THUMB * 2) }} style={[styles.thumb, { backgroundColor: colors.brandLight }]} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.brandLight }]}>
            <Icon name="image" size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {spot.name}
          </Text>
          {!!spot.city && (
            <Text style={[styles.city, { color: colors.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {spot.city}
            </Text>
          )}
          <View style={styles.barRow}>
            <View style={styles.barWrap}>
              <ProgressBar done={done} total={total} color={tint} track={finished ? colors.successBg : colors.brandLight} />
            </View>
            <Text style={[styles.barText, { color: tint }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {finished ? "All done" : `${done} of ${total}`}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textMuted} />
      </View>

      <View style={styles.steps}>
        {steps.map((st) => (
          <View
            key={st.key}
            style={[
              styles.step,
              st.done
                ? { backgroundColor: finished ? colors.successBg : colors.brandLight, borderColor: "transparent" }
                : { backgroundColor: "transparent", borderColor: colors.cardBorder },
            ]}
          >
            <Icon
              name={st.done ? "check" : st.icon}
              size={13}
              color={st.done ? tint : colors.textMuted}
              weight={st.done ? "bold" : "regular"}
            />
            <Text
              style={[styles.stepText, { color: st.done ? tint : colors.textSecondary }]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            >
              {st.label}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  summary: {
    borderRadius: radius.card, borderWidth: 1, padding: 16, marginBottom: 14, gap: 10,
  },
  summaryKicker: { fontSize: 11, fontFamily: fonts.sansBold, letterSpacing: 1.2 },
  summaryTitle:  { fontSize: 23, lineHeight: 28, letterSpacing: -0.2, fontFamily: fonts.display, marginTop: -4 },
  counts:        { flexDirection: "row", alignItems: "stretch", marginTop: 2 },
  count:         { flex: 1, alignItems: "center" },
  countN:        { fontSize: 20, fontFamily: fonts.sansBold },
  countLabel:    { fontSize: 11.5, fontFamily: fonts.sansMedium, marginTop: 1 },
  countSep:      { width: 1, marginVertical: 4 },

  track: { width: "100%", overflow: "hidden" },

  card:     { borderRadius: radius.card, borderWidth: 1, padding: 12, gap: 12 },
  cardTop:  { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb:    { width: THUMB, height: THUMB, borderRadius: 14 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, minWidth: 0 },
  name:     { fontSize: 15.5, lineHeight: 20, fontFamily: fonts.sansBold },
  city:     { fontSize: 12.5, fontFamily: fonts.sansMedium, marginTop: 1 },
  barRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  barWrap:  { flex: 1 },
  barText:  { fontSize: 12, fontFamily: fonts.sansBold },

  steps:    { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  step: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  stepText: { fontSize: 12, fontFamily: fonts.sansSemi },
});
