import React from "react";
import { View, Text, StyleSheet } from "react-native";
import SpotPicker from "../components/SpotPicker";
import Icon from "../components/Icon";
import { ensureAtSpotForAR } from "../utils/arLocationGate";
import { useMissions } from "../context/MissionContext";
import { useTheme, fonts } from "../context/ThemeContext";

export default function ARSpotSelect() {
  const { getMissionsForSpot, completedMissions } = useMissions();
  const { colors } = useTheme();

  const arMissionFor = (spot) => getMissionsForSpot(spot._id).find((m) => m.type === "ar");

  const handlePick = async (spot, navigation) => {
    // AR models are anchored to real places at the spot — warn the user if
    // they're not physically there before launching.
    if (await ensureAtSpotForAR(spot)) {
      navigation.navigate("ar", { spot, arMissionId: arMissionFor(spot)?._id ?? null });
    }
  };

  // Finished spots stay tappable — the badge is a record, not a lock.
  const renderDone = (spot) => {
    const mission = arMissionFor(spot);
    if (!mission || !completedMissions?.includes(mission._id)) return null;
    return (
      <View
        style={[styles.doneBadge, { backgroundColor: colors.success }]}
        accessibilityLabel="AR activity completed"
      >
        <Icon name="check" size={11} color="#fff" />
        <Text style={styles.doneText}>Done</Text>
      </View>
    );
  };

  return (
    <SpotPicker
      title="AR Experience"
      subtitle="Choose a landmark to view in augmented reality"
      onPick={handlePick}
      renderRight={renderDone}
    />
  );
}

const styles = StyleSheet.create({
  doneBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
  },
  doneText: { color: "#fff", fontSize: 11.5, fontFamily: fonts.sansBold },
});
