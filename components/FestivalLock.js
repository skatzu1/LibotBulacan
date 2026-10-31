import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import { showAlert } from "./AppAlert";
import Icon from "./Icon";
import { isOpenNow, nextRun, formatRun, lockedText } from "../utils/festivalDates";

// A festival on another day is locked (utils/festivalDates.js): its cards say
// when it opens, and tapping one says so instead of opening it.

/** The chip on a locked festival's photo, e.g. "Opens May 14–15". Nothing when it's open. */
export function FestivalLockChip({ spot, style }) {
  if (isOpenNow(spot)) return null;
  return (
    <View style={[s.chip, style]} accessible accessibilityLabel={lockedText(spot)}>
      <Icon name="lock" size={11} color="#fff" weight="bold" />
      <Text style={s.text} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {lockedText(spot, Date.now(), { short: true })}
      </Text>
    </View>
  );
}

/** The pop-up for a tap on a locked festival. */
export function explainLockedFestival(spot) {
  const run = nextRun(spot);
  showAlert(
    "This festival isn't on yet",
    run
      ? `${spot?.name || "This festival"} opens on ${formatRun(run)}. You can visit it and earn its badge then.`
      : `${spot?.name || "This festival"} has no dates set yet. Check back closer to the festival.`,
    undefined,
    { tone: "info", icon: "calendar" },
  );
}

/**
 * `onPress` for a spot card: a locked festival explains itself, anything else
 * does `open`.
 */
export const openUnlessLocked = (spot, open) => () => (isOpenNow(spot) ? open() : explainLockedFestival(spot));

const s = StyleSheet.create({
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "rgba(6,20,22,0.72)",
  },
  text: { color: "#fff", fontFamily: fonts.sansBold, fontSize: 11.5 },
});
