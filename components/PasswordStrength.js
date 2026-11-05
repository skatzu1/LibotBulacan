import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, fonts } from "../context/ThemeContext";
import { PASSWORD_RULES, passwordLevel } from "../utils/authValidation";
import Icon from "./Icon";

const STRENGTH = [
  { label: "Weak",   token: "danger" },
  { label: "Fair",   token: "warning" },
  { label: "Good",   token: "accentDark" },
  { label: "Strong", token: "success" },
];

export default function PasswordStrength({ password, style }) {
  const { colors } = useTheme();
  if (!password) return null;
  const level = passwordLevel(password);
  const strength = STRENGTH[level];
  const strengthColor = colors[strength.token];
  return (
    <View style={[styles.panel, style]} accessibilityLiveRegion="polite">
      <View style={styles.track}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.seg, { backgroundColor: i <= level ? strengthColor : colors.divider }]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: strengthColor }]}>{strength.label}</Text>
      <View style={styles.criteria}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <View key={rule.id} style={styles.row}>
              <Icon
                name={ok ? "check-circle" : "circle"}
                size={13}
                weight={ok ? "fill" : "regular"}
                color={ok ? colors.success : colors.textMuted}
              />
              <Text style={[styles.rowText, { color: ok ? colors.success : colors.textMuted }]}>
                {rule.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel:    { marginTop: 12, paddingHorizontal: 8, gap: 8 },
  track:    { flexDirection: "row", gap: 5 },
  seg:      { flex: 1, height: 4, borderRadius: 2 },
  label:    { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 0.3 },
  criteria: { gap: 4 },
  row:      { flexDirection: "row", alignItems: "center", gap: 7 },
  rowText:  { fontFamily: fonts.sansMedium, fontSize: 12.5 },
});
