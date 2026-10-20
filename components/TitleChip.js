import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import { titleName } from "../utils/titles";
import { starPath } from "../utils/townEmblem";

/*
 * A traveler's title (utils/titles.js) as a small badge of rank: the Libot star
 * and the name in spaced capitals. GOAT Traveler, the top one, is a solid gold
 * plate; the others are the soft gold of anything earned. Renders nothing for
 * a traveler without a title.
 */
function TitleChip({ title, size = "md", style }) {
  const { colors } = useTheme();
  const name = titleName(title);
  if (!name) return null;
  const top = (typeof title === "string" ? title : title?.key) === "goat";
  const sm = size === "sm";
  const fg = top ? colors.onAccent : colors.accentDark;
  return (
    <View
      style={[s.chip, sm && s.chipSm, { backgroundColor: top ? colors.accent : colors.accentSoft }, style]}
      accessible
      accessibilityLabel={`Title: ${name}`}
    >
      <Svg width={sm ? 10 : 12} height={sm ? 10 : 12} viewBox="0 0 24 24">
        <Path d={starPath(12, 12, 12, 7, 3.2)} fill={top ? colors.onAccent : colors.accent} stroke={fg} strokeWidth={top ? 0 : 1.2} />
      </Svg>
      <Text style={[s.text, sm && s.textSm, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {name.toUpperCase()}
      </Text>
    </View>
  );
}

export default React.memo(TitleChip);

const s = StyleSheet.create({
  chip:   { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipSm: { gap: 4, paddingHorizontal: 7, paddingVertical: 2 },
  text:   { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.1 },
  textSm: { fontSize: 9.5, letterSpacing: 0.8 },
});
