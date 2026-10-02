import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ImageBackground, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, typography, fonts, shadow, MAX_FONT_SCALE } from "../context/ThemeContext";
import Icon from "./Icon";
import Logo from "./Logo";
import KeyboardAvoider from "./KeyboardAvoider";
import useKeyboardAwareScroll from "../hooks/useKeyboardAwareScroll";

/*
 * The shell every pre-login screen sits in (Login, Forgot Password, Register,
 * Email Verification).
 *
 * The Bulacan photograph (assets/bg.png) fills the screen under a veil in the
 * theme's page colour, and a panel with ONE oversized corner pulls up over it.
 * That single asymmetric corner is the signature of this surface; four equal
 * radii would read as a generic card.
 *
 * Colours are the app's own tokens, so these screens follow light/dark like
 * every other screen. (They used to be a fixed cyan/yellow surface that ignored
 * dark mode.) Contrast of every text colour on the panel was measured against
 * the darkest pixel of bg.png in light mode and the brightest in dark mode —
 * see photoVeil / panelOverPhoto in context/ThemeContext.js.
 */

const BG = require("../assets/bg.png");

// "#rrggbb" + alpha → rgba(). Theme colours in the app are plain hex.
export const withAlpha = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

/** Holds the logo above the panel. The photo behind it belongs to the screen. */
export function AuthHero({ children, height }) {
  const { height: winH } = useWindowDimensions();
  const h = height ?? Math.round(Math.min(winH * 0.38, 340));
  return <View style={[s.hero, { height: h }]}>{children}</View>;
}

/**
 * @param onBack      renders the back chevron when provided
 * @param title       large heading
 * @param subtitle    one or two lines under it
 * @param background  image under the whole screen (defaults to bg.png)
 */
export default function AuthScaffold({
  showLogo = true,
  onBack,
  title,
  subtitle,
  children,
  footer,
  background = BG,
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const kb = useKeyboardAwareScroll();

  return (
    <ImageBackground source={background} resizeMode="cover" style={[s.screen, { backgroundColor: colors.background }]}>
      {/* Tints the photo toward the page: a light wash in light mode, a heavy
          one in dark mode so the bright photo doesn't glare. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.photoVeil }]} pointerEvents="none" />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

      <KeyboardAvoider style={s.flex}>
        <ScrollView
          ref={kb.ref}
          onScroll={kb.onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <AuthHero>
            {showLogo && (
              <View style={[s.logoWrap, { marginTop: insets.top }]}>
                <Logo size={120} />
              </View>
            )}
          </AuthHero>

          {/* The panel pulls up over the photo so the oversized corner cuts
              into it. The bottom inset is padding INSIDE the panel, so the
              panel runs to the bottom edge instead of stopping short and
              leaving a strip of photo under the last link. */}
          <View style={[s.panel, { backgroundColor: colors.panelOverPhoto, paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
            {onBack && (
              <TouchableOpacity
                onPress={onBack}
                style={s.backInline}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Icon name="chevron-left" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {!!title && (
              <Text
                style={[s.title, { color: colors.brandDark }]}
                accessibilityRole="header"
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              >
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text style={[s.subtitle, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {subtitle}
              </Text>
            )}

            <View style={s.body}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoider>

      {footer}
    </ImageBackground>
  );
}

/* ── Validation messages ──────────────────────────────────────────────────
   Every auth screen reports problems the same two ways:
     FieldError — under the field it's about, next to a red field border.
     FormError  — one box above the main button, for problems that aren't
                  any single field's (wrong password, offline, rate limit).
   Both are live regions, so a screen reader announces them as they appear.
   The red is the app's own `danger` token — 5.25:1 on the light panel over
   the darkest part of the photo, 6.03:1 on the dark one. */
export function FieldError({ children, style }) {
  const a = useAuthStyles();
  const { colors } = useTheme();
  if (!children) return null;
  return (
    <View style={[a.fieldErrorRow, style]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Icon name="alert-circle" size={13} color={colors.danger} style={a.fieldErrorIcon} />
      <Text style={a.errorText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{children}</Text>
    </View>
  );
}

export function FormError({ children }) {
  const a = useAuthStyles();
  const { colors } = useTheme();
  if (!children) return null;
  return (
    <View style={a.errorBox} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Icon name="alert-circle" size={15} color={colors.danger} />
      <Text style={a.errorBoxText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{children}</Text>
    </View>
  );
}

/* ── Shared controls ──────────────────────────────────────────────────────
   Pill-shaped fields with an uppercase, letter-spaced placeholder — specific
   enough that every screen must get it from one place or they will drift.
   Built per theme, so call the hook inside the component:
     const a = useAuthStyles();  */
export function useAuthStyles() {
  const { colors, isDark } = useTheme();
  return useMemo(() => makeAuthStyles(colors, isDark), [colors, isDark]);
}

const FIELD_RADIUS = 30;

const makeAuthStyles = (c, isDark) => StyleSheet.create({
  // Solid fill (not see-through), so a field's contrast never depends on the
  // photo: text 15.8:1 / 14.3:1, placeholder 5.1:1 / 5.0:1.
  field: {
    height: 60,
    borderRadius: FIELD_RADIUS,
    paddingHorizontal: 26,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    letterSpacing: 1.2,
    color: c.textPrimary,
    backgroundColor: c.inputBg,
    borderWidth: 1,
    borderColor: c.inputBorder,
  },
  // Every field sits in one of these. Android paints its autofill highlight
  // as a plain yellow RECTANGLE over the input, which showed square corners
  // past the pill's round ends; clipping to the pill gives it the field's shape.
  fieldRow:  { justifyContent: "center", borderRadius: FIELD_RADIUS, overflow: "hidden" },
  eyeBtn:    { position: "absolute", right: 20, height: 44, width: 44, alignItems: "center", justifyContent: "center" },
  label:     { fontFamily: fonts.sansSemi, fontSize: 12.5, letterSpacing: 1.3, color: c.textMuted, marginBottom: 8, marginLeft: 8 },

  // The app's primary button: the one yellow action on the screen.
  cta: {
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accent,
    ...shadow.md,
  },
  ctaText: { fontFamily: fonts.sansBold, fontSize: 17, color: c.onAccent, letterSpacing: 0.2 },

  // Google's own sign-in button colours: white on light, #131314 on dark.
  googleBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: isDark ? "#131314" : "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: isDark ? "#8E918F" : "rgba(0,0,0,0.08)",
  },
  googleText: { fontFamily: fonts.sansMedium, fontSize: 16, color: isDark ? "#E3E3E3" : "#3C4043" },
  googleLogo: { width: 22, height: 22, resizeMode: "contain" },

  dividerRow:  { flexDirection: "row", alignItems: "center", gap: 14 },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: c.divider },
  dividerText: { fontFamily: fonts.sansSemi, fontSize: 13, color: c.textSecondary, letterSpacing: 0.5 },

  linkRow:  { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap" },
  linkMuted:{ fontFamily: fonts.sans, fontSize: 14.5, color: c.textSecondary },
  linkBold: { fontFamily: fonts.sansBold, fontSize: 14.5, color: c.brand },

  // Red border on a field that has an error — colour AND a message, never
  // colour alone.
  fieldInvalid:   { borderWidth: 1.5, borderColor: c.danger },
  fieldErrorRow:  { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 7, marginLeft: 18, marginRight: 8 },
  fieldErrorIcon: { marginTop: 2 },
  errorText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12.5, lineHeight: 17, color: c.danger },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: c.dangerBg,
    borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14,
    borderWidth: 1, borderColor: withAlpha(c.danger, 0.35),
  },
  errorBoxText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: c.danger },
});

const s = StyleSheet.create({
  screen: { flex: 1 },
  flex:   { flex: 1 },
  scrollContent: { flexGrow: 1 },

  hero:     { width: "100%", alignItems: "center", justifyContent: "center" },
  logoWrap: { alignItems: "center", justifyContent: "center" },

  backInline: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center", marginBottom: 4 },

  panel: {
    flex: 1,
    marginTop: -46,
    // ONE oversized corner — the signature of this surface.
    borderTopLeftRadius: 64,
    paddingHorizontal: 30,
    paddingTop: 34,
  },

  // Newsreader at display size. This is the app's voice at its loudest.
  title: {
    ...typography.h1,
    fontSize: 42,
    lineHeight: 48,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 6,
  },
  body: { marginTop: 26, gap: 16 },
});
