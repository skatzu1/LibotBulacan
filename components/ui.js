import React from "react";
import {
  View, Text, Image, TouchableOpacity, TextInput, StyleSheet, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, typography, fonts, radius, MAX_FONT_SCALE } from "../context/ThemeContext";
import { spotImage } from "../utils/image";
import Icon from "./Icon";

// Shared building blocks so every post-login screen matches the Home layout.
export const H_PAD = 20;

// Minimum comfortable touch target. iOS HIG says 44pt, Android 48dp — 44 with
// generous hitSlop satisfies both.
export const TAP = 44;

/* ── Photo scrim ──────────────────────────────────────────────────────────
   A flat rgba() block over an unknown photo cannot guarantee contrast: over a
   bright sky, white-on-0.55-black measures 4.15:1 and fails AA. A gradient
   lets the base go much darker exactly where the text sits while leaving the
   top of the image untouched, so it reads better AND looks better than the
   hard-edged block it replaces. Verified 10.2:1 worst case (pure white photo). */
export function PhotoScrim({ style, intensity = 0.88, from = 0.42 }) {
  return (
    <LinearGradient
      colors={["rgba(6,20,22,0)", `rgba(6,20,22,${intensity * 0.55})`, `rgba(6,20,22,${intensity})`]}
      locations={[from, from + (1 - from) * 0.45, 1]}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
    />
  );
}

/* ── Slim screen header: back · title · optional right slot ─────────────── */
export function ScreenHeader({ title, onBack, right, style }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: Math.max(insets.top, 12) + 6 }, style]}>
      {onBack ? (
        <TouchableOpacity
          style={s.headerBtn}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={s.headerBtn} />
      )}

      <Text
        style={[typography.h3, s.headerTitle, { color: colors.textPrimary }]}
        numberOfLines={1}
        accessibilityRole="header"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      >
        {title}
      </Text>

      <View style={s.headerRight}>{right ?? <View style={s.headerBtn} />}</View>
    </View>
  );
}

/* ── Section title with optional right-side action ─────────────────────── */
export function SectionTitle({ children, actionLabel, onAction, style }) {
  const { colors } = useTheme();
  return (
    <View style={[s.sectionRow, style]}>
      <Text
        style={[s.sectionTitle, { color: colors.textPrimary }]}
        accessibilityRole="header"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      >
        {children}
      </Text>
      {actionLabel ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[typography.bodyStrong, { color: colors.brand }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ── Rounded icon tile (Home quick actions style) ─────────────────────── */
export function IconTile({ icon, label, onPress, size = 58 }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={s.tile}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[s.tileIcon, { width: size, height: size, backgroundColor: colors.brandLight }]}>
        <Icon name={icon} size={Math.round(size * 0.36)} color={colors.brand} />
      </View>
      {!!label && (
        <Text
          style={[s.tileLabel, { color: colors.textSecondary }]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/* ── Image spot card: photo + gradient scrim + name/location/rating ────── */
export function SpotCard({
  spot,
  onPress,
  wide = false,
  height,
  rating,
  visits,
  rank,         // when set, renders an editorial rank numeral instead of a plain card
  right,        // node rendered top-right (e.g. a bookmark toggle)
  style,
}) {
  const { colors } = useTheme();
  const name = spot?.name || spot?.title || "Unknown spot";
  const loc  = spot?.city || spot?.location || spot?.address || "";
  const img  = spot?.image;
  const cardH = height ?? (wide ? 185 : 150);

  const a11y = [name, loc, rating != null ? `rated ${rating} of 5` : null,
                visits != null ? `${visits} visits` : null]
    .filter(Boolean).join(", ");

  return (
    <TouchableOpacity
      style={[s.card, { height: cardH, backgroundColor: colors.brandLight }, wide && { width: "100%" }, style]}
      activeOpacity={0.88}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Opens the spot details"
    >
      {img ? (
        <Image source={{ uri: spotImage(img, wide ? 420 : 220, cardH) }} style={s.cardImg} resizeMode="cover" />
      ) : (
        <View style={[s.cardImg, s.cardImgFallback, { backgroundColor: colors.brandLight }]}>
          <Icon name="image" size={30} color={colors.textMuted} />
        </View>
      )}
      <PhotoScrim />

      {rank != null && (
        <Text style={s.cardRank} maxFontSizeMultiplier={1} allowFontScaling={false}>
          {String(rank).padStart(2, "0")}
        </Text>
      )}

      {right ? <View style={s.cardRight}>{right}</View> : null}

      <View style={s.cardInfo}>
        <Text style={s.cardName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{name}</Text>
        {!!loc && <Text style={s.cardLoc} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{loc}</Text>}
        {(rating != null || visits != null) && (
          <View style={s.cardMeta}>
            {rating != null && (
              <View style={s.cardMetaItem}>
                <Icon name="star" size={12} color={colors.star} weight="fill" />
                <Text style={s.cardMetaText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{rating}</Text>
              </View>
            )}
            {visits != null && (
              <View style={s.cardMetaItem}>
                <Icon name="eye" size={11} color="rgba(255,255,255,0.9)" />
                <Text style={s.cardMetaText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{visits}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/* ── Search field ─────────────────────────────────────────────────────────
   Shared so Home (global) and Lists (in-category) behave identically. */
export const SearchField = React.forwardRef(function SearchField(
  { value, onChangeText, onClear, placeholder = "Search", autoFocus, style, onSubmitEditing },
  ref,
) {
  const { colors } = useTheme();
  return (
    <View style={[s.search, { backgroundColor: colors.card, borderColor: colors.cardBorder }, style]}>
      <Icon name="search" size={17} color={colors.textMuted} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={[s.searchInput, { color: colors.textPrimary }]}
        accessibilityLabel={placeholder}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      />
      {value?.length > 0 && (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Icon name="x" size={17} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
});

/* ── Empty / placeholder card ─────────────────────────────────────────── */
export function EmptyState({ icon = "inbox", text, style }) {
  const { colors } = useTheme();
  return (
    <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.cardBorder }, style]}>
      <Icon name={icon} size={26} color={colors.textMuted} />
      <Text style={[s.emptyText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

/* ── Error state with retry ───────────────────────────────────────────────
   A failed request is NOT an empty collection. Showing "nothing here yet" when
   the network died tells the user the app is empty when it is actually broken. */
export function ErrorState({ text = "Couldn't load that. Check your connection.", onRetry, style }) {
  const { colors } = useTheme();
  return (
    <View style={[s.empty, { backgroundColor: colors.dangerBg, borderColor: colors.cardBorder }, style]}>
      <Icon name="wifi-off" size={26} color={colors.danger} />
      <Text style={[s.emptyText, { color: colors.textSecondary }]}>{text}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          style={[s.retryBtn, { backgroundColor: colors.brand }]}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Icon name="refresh-cw" size={13} color={colors.onBrand} />
          <Text style={[s.retryText, { color: colors.onBrand }]}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ── Responsive grid helper ──────────────────────────────────────────────
   Replaces the module-scope `Dimensions.get("window")` each screen captured at
   import time — that value is frozen and wrong after rotation, on foldables and
import Icon from "./Icon";
   in Android split-screen. */
export function useGrid(gap = 12, pad = H_PAD) {
  const { width } = useWindowDimensions();
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const cardW = (width - pad * 2 - gap * (columns - 1)) / columns;
  return { width, columns, cardW, gap, isTablet: width >= 600 };
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingBottom: 10,
  },
  headerBtn:   { minWidth: TAP, height: TAP, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", marginHorizontal: 6 },
  headerRight: { minWidth: TAP, alignItems: "flex-end", justifyContent: "center" },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: { ...typography.h2, fontSize: 22, lineHeight: 28 },

  tile: { alignItems: "center" },
  tileIcon: { borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  tileLabel: { ...typography.caption, fontFamily: fonts.sansSemi },

  card: { borderRadius: radius.card, overflow: "hidden", flexGrow: 1 },
  cardImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  cardImgFallback: { alignItems: "center", justifyContent: "center" },
  cardRight: { position: "absolute", top: 10, right: 10 },
  // Editorial rank numeral — the "most visited" grid is a ranking, so show it.
  cardRank: {
    position: "absolute", top: -6, left: 10,
    fontFamily: fonts.displayBlack, fontSize: 60,
    color: "rgba(255,255,255,0.22)", letterSpacing: -3,
  },
  cardInfo: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 13 },
  cardName: { fontFamily: fonts.sansBold, fontSize: 14.5, letterSpacing: -0.2, color: "#fff", marginBottom: 2 },
  cardLoc:  { fontFamily: fonts.sansMedium, fontSize: 11, color: "rgba(255,255,255,0.92)", marginBottom: 5 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardMetaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  cardMetaText: { fontFamily: fonts.sansBold, fontSize: 11, color: "#fff" },

  search: {
    flexDirection: "row", alignItems: "center", gap: 9,
    height: 46, borderRadius: radius.pill, paddingHorizontal: 15, borderWidth: 1,
  },
  searchInput: { flex: 1, ...typography.body, paddingVertical: 0 },

  empty: {
    borderRadius: radius.card,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  emptyText: { ...typography.body, textAlign: "center" },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4,
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill,
  },
  retryText: { ...typography.label },
});
