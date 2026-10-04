import React, { useState } from "react";
import {
  View, Text, Image, TouchableOpacity, TextInput, StyleSheet, useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, typography, fonts, radius, shadow, MAX_FONT_SCALE } from "../context/ThemeContext";
import { spotImage, avatarImage } from "../utils/image";
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
export function IconTile({ icon, label, onPress, size = 58, style }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[s.tile, style]}
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
  const loc  = spot?.city || "";
  const img  = spot?.image;
  const cardH = height ?? (wide ? 185 : 150);

  const a11y = [rank != null ? `Number ${rank}` : null, name, loc,
                rating != null ? `rated ${rating} of 5` : null,
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
        <Text style={[s.cardRank, wide && s.cardRankWide]} maxFontSizeMultiplier={1} allowFontScaling={false}>
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

/* ── Bookmark toggle for the corner of a photo card ───────────────────────
   Lists and Saved drew this at two different sizes and scrim strengths. */
export function PhotoBookmark({ saved, onPress }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={s.photoBtn}
      onPress={onPress}
      hitSlop={6}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: !!saved }}
      accessibilityLabel={saved ? "Remove bookmark" : "Add bookmark"}
    >
      <Icon
        name="bookmark"
        size={17}
        weight={saved ? "fill" : "regular"}
        color={saved ? colors.star : "#fff"}
      />
    </TouchableOpacity>
  );
}

/* ── Empty / placeholder card ─────────────────────────────────────────── */
export function EmptyState({ icon = "inbox", title, text, action, style }) {
  const { colors } = useTheme();
  return (
    <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.cardBorder }, style]}>
      <View style={[s.emptyIcon, { backgroundColor: colors.brandLight }]}>
        <Icon name={icon} size={24} color={colors.brand} />
      </View>
      {!!title && (
        <Text style={[s.emptyTitle, { color: colors.textPrimary }]} accessibilityRole="header">{title}</Text>
      )}
      {!!text && <Text style={[s.emptyText, { color: colors.textSecondary }]}>{text}</Text>}
      {action}
    </View>
  );
}

/* ── Loading placeholder for a screen BODY ────────────────────────────────
   Screens render their header first and put this under it, so the back
   button is there while a cold backend wakes up. */
export function LoadingState({ label, style }) {
  const { colors } = useTheme();
  return (
    <View style={[s.loading, style]} accessible accessibilityLabel={label || "Loading"}>
      <ActivityIndicator size="large" color={colors.brand} />
      {!!label && <Text style={[s.loadingText, { color: colors.textSecondary }]}>{label}</Text>}
    </View>
  );
}

/* ── Primary / secondary action button ────────────────────────────────────
   One shape for every full-width action. Screens had five: 14 / 16 / pill
   radii, 12–18px vertical padding, three text sizes. */
export function PrimaryButton({
  title, onPress, loading, disabled, icon, variant = "primary", style, accessibilityLabel,
}) {
  const { colors } = useTheme();
  const primary = variant === "primary";
  const fg = primary ? colors.onAccent : colors.brand;
  const off = !!(disabled || loading);
  return (
    <TouchableOpacity
      style={[
        s.btn,
        primary
          ? [{ backgroundColor: colors.accent }, shadow.sm]
          : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
        off && s.btnOff,
        style,
      ]}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: off, busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {!!icon && <Icon name={icon} size={17} color={fg} />}
          <Text style={[s.btnText, { color: fg }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/* ── Compact action for ScreenHeader's right slot (e.g. Save) ──────────── */
export function HeaderAction({ label, onPress, disabled, loading }) {
  const { colors } = useTheme();
  const off = !!(disabled || loading);
  return (
    <TouchableOpacity
      style={[s.headerAction, { backgroundColor: disabled ? colors.backgroundSoft : colors.accent }]}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.onAccent} />
      ) : (
        <Text
          style={[s.headerActionText, { color: disabled ? colors.textMuted : colors.onAccent }]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/* ── Segmented control ────────────────────────────────────────────────────
   Settings' appearance picker, the spot tabs and the badge filter were three
   separate implementations with the active/inactive colours inverted between
   them. `role` is "tab" for switching views and "radio" for a setting. */
export function Segmented({ options, value, onChange, role = "tab", style }) {
  const { colors } = useTheme();
  return (
    <View
      style={[s.segment, { backgroundColor: colors.backgroundSoft, borderColor: colors.cardBorder }, style]}
      accessibilityRole={role === "radio" ? "radiogroup" : "tablist"}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            style={[s.segmentItem, on && [{ backgroundColor: colors.card }, shadow.sm]]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.85}
            accessibilityRole={role}
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.a11y || o.label}
          >
            {!!o.icon && <Icon name={o.icon} size={14} color={on ? colors.brand : colors.textMuted} />}
            <Text
              style={[s.segmentText, { color: on ? colors.brand : colors.textMuted }]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Uppercase label above a group of rows or fields ───────────────────── */
export function GroupLabel({ children, style }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[s.groupLabel, { color: colors.textMuted }, style]}
      accessibilityRole="header"
      maxFontSizeMultiplier={MAX_FONT_SCALE}
    >
      {children}
    </Text>
  );
}

/* ── Settings-style row: icon well · title · chevron (or a custom right) ──
   Profile, Settings and Edit Profile each had a copy, with 36 vs 38px icon
   wells and 8 vs 10px gaps. Pass `right` to replace the chevron (a Switch),
   or leave out `onPress` for a row that isn't itself tappable. */
export function ListRow({ icon, title, subtitle, onPress, right, danger, accessibilityLabel, style }) {
  const { colors } = useTheme();
  const tint = danger ? colors.danger : colors.brand;
  const body = (
    <>
      <View style={[s.rowIcon, { backgroundColor: danger ? colors.dangerBg : colors.brandLight }]}>
        <Icon name={icon} size={18} color={tint} />
      </View>
      <View style={s.rowBody}>
        <Text
          style={[s.rowTitle, { color: danger ? colors.danger : colors.textPrimary }]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[s.rowSub, { color: colors.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {subtitle}
          </Text>
        )}
      </View>
      {right !== undefined
        ? right
        : onPress
          ? <Icon name="chevron-right" size={18} color={danger ? colors.danger : colors.textMuted} />
          : null}
    </>
  );
  const rowStyle = [s.row, { backgroundColor: colors.card, borderColor: colors.cardBorder }, style];
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <TouchableOpacity
      style={rowStyle}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {body}
    </TouchableOpacity>
  );
}

/* ── Labelled text field with an icon well ────────────────────────────────
   `secure` adds the show/hide toggle. A read-only field gets a lock and a
   recessed fill instead of the old opacity:0.5, which dropped its text
   below AA contrast. */
export function FormField({
  label, icon, value, onChangeText, placeholder, secure, editable = true,
  keyboardType, autoCapitalize = "none", hint, style,
}) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.field, style]}>
      {!!label && (
        <Text style={[s.fieldLabel, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
      )}
      <View
        style={[
          s.fieldRow,
          {
            backgroundColor: editable ? colors.inputBg : colors.backgroundSoft,
            borderColor: focused ? colors.inputBorderFocus : colors.inputBorder,
          },
        ]}
      >
        {!!icon && (
          <View style={[s.fieldIcon, { backgroundColor: colors.brandLight }]}>
            <Icon name={icon} size={16} color={colors.brand} />
          </View>
        )}
        <TextInput
          style={[s.fieldInput, { color: editable ? colors.textPrimary : colors.textSecondary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={!!secure && !visible}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label || placeholder}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            style={s.fieldEye}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
          >
            <Icon name={visible ? "eye-off" : "eye"} size={17} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        {!editable && <Icon name="lock" size={14} color={colors.textMuted} />}
      </View>
      {!!hint && <Text style={[s.fieldHint, { color: colors.textMuted }]}>{hint}</Text>}
    </View>
  );
}

/* ── Avatar: the photo, or initials on a brand fill ───────────────────────
   Reviews used to fall back to a random stock face from pravatar.cc, so a
   user with no photo was shown as a stranger. */
const initialsOf = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export function Avatar({ uri, name, size = 36, strong, style }) {
  const { colors } = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri: avatarImage(uri, size) }} style={[box, style]} accessibilityIgnoresInvertColors />;
  }
  const bg = strong ? colors.brand : colors.brandLight;
  const fg = strong ? colors.onBrand : colors.brand;
  const initials = initialsOf(name);
  return (
    <View style={[box, s.avatarFallback, { backgroundColor: bg }, style]}>
      {initials ? (
        <Text style={[s.avatarInitials, { color: fg, fontSize: Math.round(size * 0.38) }]} allowFontScaling={false}>
          {initials}
        </Text>
      ) : (
        <Icon name="user" size={Math.round(size * 0.44)} color={fg} />
      )}
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
  // It bleeds off the top-left corner.
  cardRank: {
    position: "absolute", top: -14, left: 8,
    fontFamily: fonts.displayBlack, fontSize: 64,
    color: "rgba(255,255,255,0.20)", letterSpacing: -3,
  },
  cardRankWide: { fontSize: 88, top: -20, left: 12 },
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
    paddingVertical: 32,
    paddingHorizontal: 22,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  emptyIcon:  { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  emptyTitle: { ...typography.title, fontFamily: fonts.sansBold, textAlign: "center" },
  emptyText:  { ...typography.body, textAlign: "center" },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4,
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill,
  },
  retryText: { ...typography.label },

  loading:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60 },
  loadingText: { ...typography.bodyStrong },

  photoBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(6,20,22,0.5)",
  },

  btn: {
    minHeight: 54, borderRadius: radius.button, paddingHorizontal: 24,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  btnOff:  { opacity: 0.55 },
  btnText: { fontFamily: fonts.sansBold, fontSize: 15.5, letterSpacing: -0.1 },

  headerAction: {
    minWidth: 64, height: 36, borderRadius: radius.pill, paddingHorizontal: 16,
    alignItems: "center", justifyContent: "center",
  },
  headerActionText: { fontFamily: fonts.sansBold, fontSize: 14 },

  segment:     { flexDirection: "row", borderRadius: radius.pill, padding: 4, gap: 4, borderWidth: 1 },
  segmentItem: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, minHeight: 40, paddingHorizontal: 6, borderRadius: radius.pill,
  },
  segmentText: { fontFamily: fonts.sansBold, fontSize: 13, letterSpacing: -0.1 },

  groupLabel: {
    fontFamily: fonts.sansBold, fontSize: 12.5, letterSpacing: 0.9,
    textTransform: "uppercase", marginBottom: 10, marginLeft: 4,
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    minHeight: 64, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: radius.lg, borderWidth: 1, marginBottom: 10,
  },
  rowIcon:  { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowBody:  { flex: 1 },
  rowTitle: { fontFamily: fonts.sansSemi, fontSize: 15 },
  rowSub:   { ...typography.caption, marginTop: 2 },

  field:      { marginBottom: 12 },
  fieldLabel: { fontFamily: fonts.sansSemi, fontSize: 12.5, marginBottom: 6, marginLeft: 4 },
  fieldRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    minHeight: 54, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 12,
  },
  fieldIcon:  { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fieldInput: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, paddingVertical: 12 },
  fieldEye:   { padding: 4 },
  fieldHint:  { ...typography.caption, marginTop: 6, marginLeft: 4 },

  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontFamily: fonts.sansBold, letterSpacing: 0.3 },
});
