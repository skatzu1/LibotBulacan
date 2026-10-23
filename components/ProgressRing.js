import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";

/*
 * How far along a badge is: a ring that fills as its steps are done, drawn
 * round whatever sits in the middle (the badge, a photo). Brand teal while in
 * progress, gold once complete (or `doneColor`: a town's bronze, a district's
 * silver).
 */
function ProgressRing({ done = 0, total = 1, size = 96, stroke = 5, doneColor, children, style }) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, done / total) : 0;
  const complete = share >= 1;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.divider} strokeWidth={stroke} fill="none" />
        {share > 0 && (
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={complete ? doneColor || colors.accent : colors.brand}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * share} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, s.center, { padding: stroke + 3 }]}>{children}</View>
    </View>
  );
}

export default React.memo(ProgressRing);

const s = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
