import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useTheme, typography } from "../context/ThemeContext";

// Shared building blocks so every post-login screen matches the Home layout.
export const H_PAD = 20;

/* ── Slim screen header: back · title · optional right slot ─────────────── */
export function ScreenHeader({ title, onBack, right, style }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: Math.max(insets.top, 12) + 6 }, style]}>
      {onBack ? (
        <TouchableOpacity style={s.headerBtn} onPress={onBack} hitSlop={8} accessibilityLabel="Go back">
          <Feather name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={s.headerBtn} />
      )}

      <Text style={[typography.h3, s.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
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
      <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>{children}</Text>
      {actionLabel ? (
        <TouchableOpacity onPress={onAction} hitSlop={6} accessibilityLabel={actionLabel}>
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
    <TouchableOpacity style={s.tile} activeOpacity={0.85} onPress={onPress} accessibilityLabel={label}>
      <View style={[s.tileIcon, { width: size, height: size, backgroundColor: colors.card }]}>
        <Feather name={icon} size={Math.round(size * 0.36)} color={colors.brand} />
      </View>
      {!!label && (
        <Text style={[s.tileLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

/* ── Image spot card: photo + bottom scrim + name/location/rating ──────── */
export function SpotCard({
  spot,
  onPress,
  wide = false,
  height,
  rating,
  visits,
  right,        // node rendered top-right (e.g. a bookmark toggle)
  style,
}) {
  const { colors } = useTheme();
  const name = spot?.name || spot?.title || "Unknown spot";
  const loc  = spot?.city || spot?.location || spot?.address || "";
  const img  = spot?.image;
  const cardH = height ?? (wide ? 185 : 150);

  return (
    <TouchableOpacity
      style={[s.card, { height: cardH, backgroundColor: colors.card }, wide && { width: "100%" }, style]}
      activeOpacity={0.88}
      onPress={onPress}
      accessibilityLabel={`Open ${name}`}
    >
      {img ? (
        <Image source={{ uri: img }} style={s.cardImg} resizeMode="cover" />
      ) : (
        <View style={[s.cardImg, s.cardImgFallback, { backgroundColor: colors.brandLight }]}>
          <Feather name="image" size={30} color={colors.textMuted} />
        </View>
      )}
      <View style={s.cardScrim} />

      {right ? <View style={s.cardRight}>{right}</View> : null}

      <View style={s.cardInfo}>
        <Text style={s.cardName} numberOfLines={1}>{name}</Text>
        {!!loc && <Text style={s.cardLoc} numberOfLines={1}>{loc}</Text>}
        {(rating != null || visits != null) && (
          <View style={s.cardMeta}>
            {rating != null && (
              <View style={s.cardMetaItem}>
                <MaterialIcons name="star" size={12} color={colors.star} />
                <Text style={s.cardMetaText}>{rating}</Text>
              </View>
            )}
            {visits != null && (
              <View style={s.cardMetaItem}>
                <Feather name="eye" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={s.cardMetaText}>{visits}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/* ── Empty / placeholder card ─────────────────────────────────────────── */
export function EmptyState({ icon = "inbox", text, style }) {
  const { colors } = useTheme();
  return (
    <View style={[s.empty, { backgroundColor: colors.card }, style]}>
      <Feather name={icon} size={26} color={colors.textMuted} />
      <Text style={[s.emptyText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingBottom: 10,
  },
  headerBtn:   { minWidth: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", marginHorizontal: 6 },
  headerRight: { minWidth: 40, alignItems: "flex-end", justifyContent: "center" },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },

  tile: { alignItems: "center" },
  tileIcon: { borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  tileLabel: { fontSize: 11.5, fontWeight: "600" },

  card: { borderRadius: 22, overflow: "hidden", flexGrow: 1 },
  cardImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  cardImgFallback: { alignItems: "center", justifyContent: "center" },
  cardScrim: { ...StyleSheet.absoluteFillObject, top: "38%", backgroundColor: "rgba(6,20,22,0.55)" },
  cardRight: { position: "absolute", top: 10, right: 10 },
  cardInfo: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 13 },
  cardName: { fontSize: 14.5, fontWeight: "800", letterSpacing: -0.2, color: "#fff", marginBottom: 2 },
  cardLoc:  { fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.85)", marginBottom: 5 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardMetaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  cardMetaText: { fontSize: 11, fontWeight: "700", color: "#fff" },

  empty: {
    borderRadius: 22,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 10,
  },
  emptyText: { fontSize: 13, fontWeight: "500", textAlign: "center" },
});
