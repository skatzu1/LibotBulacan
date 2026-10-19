import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import Icon from "./Icon";
import { useTheme, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import { spotImage } from "../utils/image";

/*
 * One spot in the Bakit List, AR View and Navigate grids — the Badges screen's
 * card (user, 2026-10-20: "make it like the badge screen"): the spot's photo in
 * a circle, its name and town, and a footer.
 *
 * Done spots sit on a white card with a tick on the photo, like a claimed
 * badge; the rest recede into the page tint. Unlike a locked badge, a spot not
 * done yet keeps its colours and has no lock: it is open, just not done.
 *
 *   footer  { text, icon? } — for a done spot, muted text under the name
 *           (like a claimed badge's date); otherwise a tinted chip (like a
 *           locked badge's points): "2 of 4", "+50", "Directions".
 */

export const PHOTO = 60;

// Padding, the photo, a two-line name, the town and the footer, with the text
// parts grown by the phone's text size, so every card in a row is one height.
export const spotCardHeightFor = (fontScale) => Math.ceil(104 + 58 * fontScale);

export function SpotGridCard({ spot, done, footer, width, minHeight, onPress, accessibilityLabel, accessibilityHint }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[s.wrapper, { width }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <View style={[
        s.card,
        { minHeight },
        done
          ? { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }
          : { backgroundColor: colors.backgroundSoft },
      ]}>
        <View style={s.photoWrap}>
          {spot.image ? (
            <Image source={{ uri: spotImage(spot.image, PHOTO * 2, PHOTO * 2) }} style={[s.photo, { backgroundColor: colors.brandLight }]} />
          ) : (
            <View style={[s.photo, s.photoEmpty, { backgroundColor: colors.brandLight }]}>
              <Icon name="map-pin" size={24} color={colors.brand} />
            </View>
          )}
          {done && (
            <View style={[s.check, { backgroundColor: colors.background }]}>
              <Icon name="check-circle" size={16} color={colors.brand} />
            </View>
          )}
        </View>

        <Text
          style={[s.name, { color: done ? colors.textPrimary : colors.textSecondary }]}
          numberOfLines={2}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        >
          {spot.name}
        </Text>
        {!!spot.city && (
          <Text style={[s.city, { color: colors.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {spot.city}
          </Text>
        )}

        {/* Pinned to the bottom, so it lines up across cards whatever the
            length of the name above it. */}
        {!!footer && (
          <View style={s.footer}>
            {done ? (
              <Text style={[s.doneText, { color: colors.textMuted }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{footer.text}</Text>
            ) : (
              <View style={[s.chip, { backgroundColor: colors.brandLight }]}>
                {!!footer.icon && <Icon name={footer.icon} size={9} color={colors.brand} />}
                <Text style={[s.chipText, { color: colors.brand }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{footer.text}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  // flexGrow down the chain lets each card stretch to its row, so the cards in
  // a row still match if a very large text size outgrows spotCardHeightFor.
  wrapper:    { flexGrow: 1 },
  card:       { flexGrow: 1, borderRadius: 16, padding: 10, alignItems: "center" },
  photoWrap:  { width: PHOTO, height: PHOTO, marginBottom: 8 },
  photo:      { width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2 },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  check:      { position: "absolute", bottom: -4, right: -4, borderRadius: 10 },
  name:       { fontSize: 11.5, lineHeight: 15, fontFamily: fonts.sansSemi, textAlign: "center" },
  city:       { fontSize: 10.5, lineHeight: 14, fontFamily: fonts.sansMedium, textAlign: "center", marginTop: 2 },
  footer:     { marginTop: "auto", paddingTop: 6, alignItems: "center" },
  doneText:   { fontSize: 10.5, lineHeight: 14, fontFamily: fonts.sansMedium, textAlign: "center" },
  chip:       { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  chipText:   { fontSize: 10, lineHeight: 13, fontFamily: fonts.sansBold },
});
