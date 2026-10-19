import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import Icon from "./Icon";
import { useTheme, fonts, radius, MAX_FONT_SCALE } from "../context/ThemeContext";
import { spotImage } from "../utils/image";

/*
 * One spot in the quick-action lists (Bakit List, AR View, Navigate): photo,
 * name, town, and one status line ("Visited", "2 of 4 done"). The lists are
 * divided into sections by that status (SpotPicker `sections`).
 *
 * Kept to that on purpose (user, 2026-10-20: "make it simple"): the first
 * version had a summary card, section blurbs, progress bars, named step chips
 * and yellow buttons on every card.
 *
 *   status  { text, tone: "done" | "progress" | "todo", icon? }
 *   steps   optional [{ key, icon, done }] — small icons before the text, one
 *           per item, ticked when done (the Bakit List's items)
 */

const THUMB = 56;

export function SpotStatusCard({ spot, onPress, status, steps, accessibilityLabel, accessibilityHint }) {
  const { colors } = useTheme();
  const tone = {
    done:     colors.success,
    progress: colors.brand,
    todo:     colors.textMuted,
  }[status.tone] || colors.textMuted;

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      {spot.image ? (
        <Image source={{ uri: spotImage(spot.image, THUMB * 2, THUMB * 2) }} style={[s.thumb, { backgroundColor: colors.brandLight }]} />
      ) : (
        <View style={[s.thumb, s.thumbEmpty, { backgroundColor: colors.brandLight }]}>
          <Icon name="image" size={20} color={colors.textMuted} />
        </View>
      )}

      <View style={s.body}>
        <Text style={[s.name, { color: colors.textPrimary }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {spot.name}
        </Text>
        {!!spot.city && (
          <Text style={[s.city, { color: colors.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {spot.city}
          </Text>
        )}
        <View style={s.status}>
          {steps ? (
            <View style={s.dots}>
              {steps.map((st) => (
                <View
                  key={st.key}
                  style={[s.dot, st.done ? { backgroundColor: tone, borderColor: tone } : { borderColor: colors.cardBorder }]}
                >
                  <Icon name={st.done ? "check" : st.icon} size={10} color={st.done ? colors.card : colors.textMuted} weight={st.done ? "bold" : "regular"} />
                </View>
              ))}
            </View>
          ) : (
            <Icon name={status.tone === "done" ? "check-circle" : status.icon || "circle"} size={14} color={tone} weight={status.tone === "done" ? "fill" : "regular"} />
          )}
          <Text style={[s.statusText, { color: tone }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {status.text}
          </Text>
        </View>
      </View>

      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card:       { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.card, borderWidth: 1, padding: 10, paddingRight: 14 },
  thumb:      { width: THUMB, height: THUMB, borderRadius: 14 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  body:       { flex: 1, minWidth: 0 },
  name:       { fontSize: 15, lineHeight: 19, fontFamily: fonts.sansBold },
  city:       { fontSize: 12, fontFamily: fonts.sansMedium },
  status:     { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  statusText: { fontSize: 12.5, fontFamily: fonts.sansBold, flexShrink: 1 },
  dots:       { flexDirection: "row", gap: 3 },
  dot:        { width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
