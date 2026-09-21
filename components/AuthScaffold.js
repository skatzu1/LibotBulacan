import React from "react";
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
  TouchableOpacity, StatusBar, ImageBackground, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { auth as A, typography, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import Icon from "./Icon";
import Logo from "./Logo";

/*
 * The shell every pre-login screen sits in, built from the approved mockups.
 *
 * Two pieces:
 *   1. A hero — a Bulacan photograph under a cyan→yellow duotone wash, with the
 *      app mark centred on it.
 *   2. A panel that overlaps the hero's bottom edge and carries ONE oversized
 *      corner. That single asymmetric corner is the signature of this surface;
 *      four equal radii would read as a generic card.
 *
 * Login and Forgot Password use the cyan variant, Register the yellow one (whose
 * hero is a bubble field rather than a photo, per the mockup).
 */

export function AuthHero({ children, variant = "photo", height }) {
  const { height: winH } = useWindowDimensions();
  const h = height ?? Math.round(Math.min(winH * 0.38, 340));

  if (variant === "bubbles") {
    // Register's header: cyan circles scattered on white. Positions are fixed
    // rather than random so the composition is the same on every launch.
    const BUBBLES = [
      { x: -0.06, y: -0.10, r: 0.30, o: 0.55 }, { x: 0.18, y: -0.22, r: 0.36, o: 0.80 },
      { x: 0.44, y: -0.06, r: 0.26, o: 0.45 },  { x: 0.55, y: -0.26, r: 0.34, o: 0.70 },
      { x: 0.78, y: -0.14, r: 0.30, o: 0.55 },  { x: 0.30, y: 0.10, r: 0.22, o: 0.35 },
      { x: 0.02, y: 0.16, r: 0.18, o: 0.65 },   { x: 0.88, y: 0.06, r: 0.20, o: 0.40 },
    ];
    return (
      <View style={[s.hero, { height: h, backgroundColor: "#FFFFFF" }]}>
        {BUBBLES.map((b, i) => {
          const d = Math.round(h * b.r * 2);
          return (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: `${b.x * 100}%`,
                top: h * b.y,
                width: d, height: d, borderRadius: d / 2,
                backgroundColor: "#3FD4E6",
                opacity: b.o,
              }}
            />
          );
        })}
        {children}
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../assets/welcome.jpg")}
      style={[s.hero, { height: h }]}
      imageStyle={s.heroImg}
      resizeMode="cover"
    >
      {/* The duotone wash. It is opaque enough to unify whatever photograph sits
          under it — the mockup reads as a cyan/yellow composition first and a
          photo second. */}
      <LinearGradient
        colors={[A.washTop, A.washMid, A.washBottom]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </ImageBackground>
  );
}

/**
 * @param variant   'cyan' | 'yellow'
 * @param onBack    renders the back chevron when provided
 * @param title     large heading
 * @param subtitle  one or two lines under it
 */
export default function AuthScaffold({
  variant = "cyan",
  hero = "photo",
  showLogo = true,
  onBack,
  title,
  subtitle,
  children,
  footer,
}) {
  const insets = useSafeAreaInsets();
  const panel  = variant === "yellow" ? A.yellowPanel : A.cyanPanel;

  return (
    <View style={[s.screen, { backgroundColor: panel }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <AuthHero variant={hero}>
            {showLogo && (
              <View style={[s.logoWrap, { marginTop: insets.top }]}>
                <Logo size={120} />
              </View>
            )}
            {hero === "bubbles" && onBack && (
              <TouchableOpacity
                onPress={onBack}
                style={[s.backBtn, { top: insets.top + 8 }]}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Icon name="chevron-left" size={26} color={A.muted} />
              </TouchableOpacity>
            )}
          </AuthHero>

          {/* The panel pulls up over the hero so the oversized corner cuts into
              the photograph, exactly as the mockup draws it. */}
          <View style={[s.panel, { backgroundColor: panel }]}>
            {hero !== "bubbles" && onBack && (
              <TouchableOpacity
                onPress={onBack}
                style={s.backInline}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Icon name="chevron-left" size={26} color={A.muted} />
              </TouchableOpacity>
            )}

            {!!title && (
              <Text
                style={s.title}
                accessibilityRole="header"
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              >
                {title}
              </Text>
            )}
            {!!subtitle && (
              <Text style={s.subtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>{subtitle}</Text>
            )}

            <View style={s.body}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {footer}
    </View>
  );
}

/* ── Shared controls ──────────────────────────────────────────────────────
   The mockup's fields are pill-shaped with a tinted fill and an UPPERCASE,
   letter-spaced placeholder. That treatment is specific enough that every
   screen must get it from one place or they will drift apart. */
export const authStyles = StyleSheet.create({
  field: {
    height: 60,
    borderRadius: 30,
    paddingHorizontal: 26,
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    letterSpacing: 1.2,
    color: A.ink,
  },
  fieldRow:  { justifyContent: "center" },
  eyeBtn:    { position: "absolute", right: 20, height: 44, width: 44, alignItems: "center", justifyContent: "center" },
  label:     { fontFamily: fonts.sansSemi, fontSize: 12.5, letterSpacing: 1.3, color: A.muted, marginBottom: 8, marginLeft: 8 },

  cta: {
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: A.cta,
    shadowColor: "#7A6A00",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  ctaText: { fontFamily: fonts.sansBold, fontSize: 17, color: A.onCta, letterSpacing: 0.2 },

  googleBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  googleText: { fontFamily: fonts.sansMedium, fontSize: 16, color: "#3C4043" },
  googleLogo: { width: 22, height: 22, resizeMode: "contain" },

  dividerRow:  { flexDirection: "row", alignItems: "center", gap: 14 },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: "rgba(56,65,66,0.30)" },
  dividerText: { fontFamily: fonts.sansSemi, fontSize: 13, color: A.ink, letterSpacing: 0.5 },

  linkRow:  { flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap" },
  linkMuted:{ fontFamily: fonts.sans, fontSize: 14.5, color: A.ink },
  linkBold: { fontFamily: fonts.sansBold, fontSize: 14.5, color: A.ink },

  errorText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: "#8E1F16", marginTop: 6, marginLeft: 20 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(142,31,22,0.10)",
    borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "rgba(142,31,22,0.35)",
  },
  errorBoxText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: "#8E1F16" },
});

const s = StyleSheet.create({
  screen: { flex: 1 },
  flex:   { flex: 1 },

  hero:    { width: "100%", alignItems: "center", justifyContent: "center" },
  heroImg: { width: "100%", height: "100%" },

  logoWrap: { alignItems: "center", justifyContent: "center" },

  backBtn:    { position: "absolute", left: 18, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backInline: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center", marginBottom: 4 },

  panel: {
    flex: 1,
    marginTop: -46,
    // ONE oversized corner — the signature of this surface.
    borderTopLeftRadius: 64,
    paddingHorizontal: 30,
    paddingTop: 34,
  },

  // Fraunces at display size. This is the app's voice at its loudest.
  title: {
    ...typography.h1,
    fontSize: 42,
    lineHeight: 48,
    color: A.ink,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 23,
    color: A.muted,
    textAlign: "center",
    marginTop: 6,
  },
  body: { marginTop: 26, gap: 16 },
});
