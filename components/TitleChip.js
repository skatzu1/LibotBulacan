import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import { titleInfo, tierColors } from "../utils/titles";
import { starPath } from "../utils/townEmblem";

/*
 * A traveler's title (utils/titles.js) as a small badge of rank: the Libot star
 * and the name in spaced capitals, in its tier's metal. The GOAT Traveler, the
 * gold one, is a solid gold plate; a district's (silver) and a town's (bronze)
 * are soft plates. Renders nothing for a traveler without a title.
 */
function TitleChip({ title, size = "md", style }) {
  const { colors } = useTheme();
  const info = titleInfo(title);
  if (!info) return null;
  const gold = info.tier === "gold";
  const tier = tierColors(colors, info.tier);
  const sm = size === "sm";
  const fg = gold ? colors.onAccent : tier.ink;
  return (
    <View
      style={[s.chip, sm && s.chipSm, { backgroundColor: gold ? colors.accent : tier.soft }, style]}
      accessible
      accessibilityLabel={`Title: ${info.name}`}
    >
      <Svg width={sm ? 10 : 12} height={sm ? 10 : 12} viewBox="0 0 24 24">
        <Path d={starPath(12, 12, 12, 7, 3.2)} fill={gold ? colors.onAccent : tier.fill} stroke={fg} strokeWidth={gold ? 0 : 1.2} />
      </Svg>
      <Text style={[s.text, sm && s.textSm, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {info.name.toUpperCase()}
      </Text>
    </View>
  );
}

export default React.memo(TitleChip);

const s = StyleSheet.create({
  chip:   { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 1 },
  chipSm: { gap: 4, paddingHorizontal: 7, paddingVertical: 2 },
  text:   { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.1, flexShrink: 1 },
  textSm: { fontSize: 9.5, letterSpacing: 0.8 },
});
