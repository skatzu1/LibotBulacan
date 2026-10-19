import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import Icon from "./Icon";
import { useTheme, fonts, radius, MAX_FONT_SCALE } from "../context/ThemeContext";
import { spotImage } from "../utils/image";

/*
 * The pieces of the three quick-action spot lists (Bakit List, AR View,
 * Navigate), which show where the traveler stands rather than only photos
 * (user, 2026-10-20: the old "2/5" chips on photos were confusing):
 *
 *   ProgressSummary  the card on top: "4 of 25 spots visited", a bar, counts
 *   SpotStatusCard   one spot: photo, name, town, its status in words, and
 *                    optionally a bar and its steps by name
 *
 * The lists are divided into sections with SpotPicker's `sections`.
 */

const THUMB = 64;

export function ProgressBar({ done, total, color, track, height = 6 }) {
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <View
      style={[s.track, { backgroundColor: track, height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      <View style={{ width: `${ratio * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** counts: [{ n, label, tone: "brand" | "muted" | "success" }] */
export function ProgressSummary({ kicker, title, done, total, counts = [] }) {
  const { colors } = useTheme();
  const toneColor = { brand: colors.brand, muted: colors.textSecondary, success: colors.success };
  return (
    <View style={[s.summary, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Text style={[s.kicker, { color: colors.textMuted }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{kicker}</Text>
      <Text style={[s.summaryTitle, { color: colors.textPrimary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{title}</Text>
      <ProgressBar done={done} total={total} color={colors.brand} track={colors.brandLight} height={8} />
      <View style={s.counts}>
        {counts.map((c, i) => (
          <React.Fragment key={c.label}>
            {i > 0 && <View style={[s.countSep, { backgroundColor: colors.divider }]} />}
            <View style={s.count} accessible accessibilityLabel={`${c.n} ${c.label.toLowerCase()}`}>
              <Text style={[s.countN, { color: toneColor[c.tone] || colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {c.n}
              </Text>
              <Text style={[s.countLabel, { color: colors.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {c.label}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

/**
 * One spot. `done` turns it green. `status` is the line under the town
 * ({ icon, text }); `bar` ({ done, total }) replaces it with a bar and
 * "n of m"; `steps` ([{ key, icon, label, done }]) lists the items by name.
 * `cta` is a small yellow pill saying what a tap does ("Start AR"); without
 * it, a chevron.
 */
export function SpotStatusCard({
  spot, onPress, done, status, bar, steps, cta, accessibilityLabel, accessibilityHint,
}) {
  const { colors } = useTheme();
  const tint = done ? colors.success : colors.brand;

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: colors.card, borderColor: done ? colors.success : colors.cardBorder }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <View style={s.cardTop}>
        {spot.image ? (
          <Image source={{ uri: spotImage(spot.image, THUMB * 2, THUMB * 2) }} style={[s.thumb, { backgroundColor: colors.brandLight }]} />
        ) : (
          <View style={[s.thumb, s.thumbEmpty, { backgroundColor: colors.brandLight }]}>
            <Icon name="image" size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={s.cardBody}>
          <Text style={[s.name, { color: colors.textPrimary }]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {spot.name}
          </Text>
          {!!spot.city && (
            <Text style={[s.city, { color: colors.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {spot.city}
            </Text>
          )}
          {bar ? (
            <View style={s.statusRow}>
              <View style={s.barWrap}>
                <ProgressBar done={bar.done} total={bar.total} color={tint} track={done ? colors.successBg : colors.brandLight} />
              </View>
              <Text style={[s.statusText, { color: tint }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {done ? "All done" : `${bar.done} of ${bar.total}`}
              </Text>
            </View>
          ) : status ? (
            <View style={[s.statusRow, s.statusPill, { backgroundColor: done ? colors.successBg : colors.backgroundSoft }]}>
              <Icon name={done ? "check" : status.icon} size={13} color={done ? colors.success : colors.textSecondary} weight={done ? "bold" : "regular"} />
              <Text style={[s.statusText, { color: done ? colors.success : colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {status.text}
              </Text>
            </View>
          ) : null}
        </View>
        {cta ? (
          <View style={[s.cta, { backgroundColor: colors.accent }]} pointerEvents="none">
            <Text style={[s.ctaText, { color: colors.onAccent }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{cta}</Text>
          </View>
        ) : (
          <Icon name="chevron-right" size={18} color={colors.textMuted} />
        )}
      </View>

      {!!steps?.length && (
        <View style={s.steps}>
          {steps.map((st) => (
            <View
              key={st.key}
              style={[
                s.step,
                st.done
                  ? { backgroundColor: done ? colors.successBg : colors.brandLight, borderColor: "transparent" }
                  : { backgroundColor: "transparent", borderColor: colors.cardBorder },
              ]}
            >
              <Icon name={st.done ? "check" : st.icon} size={13} color={st.done ? tint : colors.textMuted} weight={st.done ? "bold" : "regular"} />
              <Text style={[s.stepText, { color: st.done ? tint : colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {st.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  track: { width: "100%", overflow: "hidden" },

  summary:      { borderRadius: radius.card, borderWidth: 1, padding: 16, marginBottom: 14, gap: 10 },
  kicker:       { fontSize: 11, fontFamily: fonts.sansBold, letterSpacing: 1.2 },
  summaryTitle: { fontSize: 23, lineHeight: 28, letterSpacing: -0.2, fontFamily: fonts.display, marginTop: -4 },
  counts:       { flexDirection: "row", alignItems: "stretch", marginTop: 2 },
  count:        { flex: 1, alignItems: "center" },
  countN:       { fontSize: 20, fontFamily: fonts.sansBold },
  countLabel:   { fontSize: 11.5, fontFamily: fonts.sansMedium, marginTop: 1 },
  countSep:     { width: 1, marginVertical: 4 },

  card:       { borderRadius: radius.card, borderWidth: 1, padding: 12, gap: 12 },
  cardTop:    { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb:      { width: THUMB, height: THUMB, borderRadius: 14 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  cardBody:   { flex: 1, minWidth: 0 },
  name:       { fontSize: 15.5, lineHeight: 20, fontFamily: fonts.sansBold },
  city:       { fontSize: 12.5, fontFamily: fonts.sansMedium, marginTop: 1 },
  statusRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  statusPill: { alignSelf: "flex-start", gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  barWrap:    { flex: 1 },
  statusText: { fontSize: 12, fontFamily: fonts.sansBold },

  cta:     { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  ctaText: { fontSize: 12.5, fontFamily: fonts.sansBold },

  steps: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  step: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  stepText: { fontSize: 12, fontFamily: fonts.sansSemi },
});
