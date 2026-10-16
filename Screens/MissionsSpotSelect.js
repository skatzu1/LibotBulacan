import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import SpotPicker from "../components/SpotPicker";
import Icon from "../components/Icon";
import { useArrival } from "../context/ArrivalContext";
import { useMissions } from "../context/MissionContext";
import { usePoints } from "../context/PointsContext";
import { useTheme, fonts, radius } from "../context/ThemeContext";
import { spotProgress } from "../utils/missionTiers";

// Each card shows how much of that spot's Bakit List is done, as a fraction
// ("2/5"), with a summary of every spot on top (QA 2026-10-16: a way to see
// Bakit List progress from the quick action). Same count as the progress bar
// on the spot page: arriving, then each activity (utils/missionTiers.js).
export default function MissionsSpotSelect() {
  const { allSpots } = useArrival();
  const { getMissionsForSpot, completedMissions } = useMissions();
  const { hasVisited } = usePoints();
  const { colors } = useTheme();

  const progressOf = (spot) => spotProgress(getMissionsForSpot(spot._id), completedMissions, hasVisited(spot._id));

  const summary = useMemo(() => {
    const all = allSpots.map((s) => spotProgress(getMissionsForSpot(s._id), completedMissions, hasVisited(s._id)));
    return {
      finished: all.filter((p) => p.done === p.total).length,
      started:  all.filter((p) => p.done > 0 && p.done < p.total).length,
      total:    all.length,
    };
  }, [allSpots, getMissionsForSpot, completedMissions, hasVisited]);

  const renderProgress = (spot) => {
    const { done, total } = progressOf(spot);
    const complete = done === total;
    return (
      <View
        style={[styles.chip, { backgroundColor: complete ? colors.success : "rgba(11,30,32,0.72)" }]}
        accessible
        accessibilityLabel={complete ? "Bakit List complete" : `${done} of ${total} done`}
      >
        {complete && <Icon name="check" size={11} color="#fff" />}
        <Text style={styles.chipText}>{done}/{total}{complete ? "" : " done"}</Text>
      </View>
    );
  };

  const header = summary.total > 0 ? (
    <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[styles.summaryIcon, { backgroundColor: colors.brandLight }]}>
        <Icon name="flag" size={18} color={colors.brand} />
      </View>
      <View style={styles.summaryBody}>
        <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
          {summary.finished} of {summary.total} spots finished
        </Text>
        <Text style={[styles.summarySub, { color: colors.textSecondary }]}>
          {summary.started > 0
            ? `${summary.started} more ${summary.started === 1 ? "is" : "are"} in progress.`
            : "Each card shows how much of its list you've done."}
        </Text>
      </View>
    </View>
  ) : null;

  return (
    <SpotPicker
      title="Bakit List"
      subtitle="Pick a spot to see its Bakit List and start an activity"
      cta="Bakit List"
      header={header}
      renderRight={renderProgress}
      // The Mission screen needs both a spot AND a chosen activity, so route
      // through the spot's detail page, opening straight on its Bakit List tab.
      onPick={(spot, navigation) =>
        navigation.navigate("InformationScreen", { spot, tab: "BucketList" })
      }
    />
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
  },
  chipText: { color: "#fff", fontSize: 11.5, fontFamily: fonts.sansBold },

  summary: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: radius.card, borderWidth: 1, padding: 14, marginBottom: 14,
  },
  summaryIcon:  { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  summaryBody:  { flex: 1 },
  summaryTitle: { fontSize: 15, fontFamily: fonts.sansBold },
  summarySub:   { fontSize: 12.5, fontFamily: fonts.sansMedium, marginTop: 2 },
});
