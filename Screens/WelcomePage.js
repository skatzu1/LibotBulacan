import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ImageBackground,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { auth as A, typography, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";

/*
 * Onboarding, screen 1 of 2 — built from the approved mockup.
 *
 * A Bulacan photograph under a cyan→yellow duotone wash, an oversized headline
 * with two words picked out in the CTA yellow, page dots, and the yellow Next
 * button. The version this replaces was a centred stock 3D suitcase
 * illustration on a plain background, which said nothing about Bulacan.
 */
export default function WelcomePage({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground
        source={require("../assets/welcome.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        {/* Duotone wash — the composition reads as cyan/yellow first and a
            photograph second, which is what makes both onboarding screens feel
            like one piece. */}
        <LinearGradient
          colors={[A.washTop, A.washMid, A.washBottom]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* White text over a light wash measures ~1.3:1 on its own. This band
            sits behind the headline only and lifts it past 7:1 without
            darkening the whole composition. */}
        <LinearGradient
          colors={["transparent", "rgba(12,34,36,0.68)", "rgba(12,34,36,0.68)", "transparent"]}
          locations={[0.18, 0.34, 0.74, 0.92]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </ImageBackground>

      <View style={[styles.content, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        <View style={styles.headlineWrap}>
          <Text style={styles.headline} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Discover{"\n"}
            <Text style={styles.accentWord}>Fun</Text> Ways{"\n"}
            to Explore{"\n"}
            <Text style={styles.accentWord}>Bulacan</Text>
          </Text>
        </View>

        <View style={styles.bottom}>
          <View
            style={styles.dots}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>

          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate("WelcomePage2")}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Next — choose where you live"
          >
            <Text style={styles.ctaText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.washTop },

  content: { flex: 1, paddingHorizontal: 30, justifyContent: "space-between" },

  headlineWrap: { flex: 1, justifyContent: "center" },
  headline: {
    ...typography.h1,
    fontSize: 52,
    lineHeight: 60,
    color: A.onPhoto,
    textAlign: "center",
    // Backs up the scrim band over the brightest parts of the photograph.
    textShadowColor: "rgba(12,34,36,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  accentWord: { color: A.cta },

  bottom: { gap: 22 },
  dots:      { flexDirection: "row", gap: 9, alignSelf: "center" },
  dot:       { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FFFFFF" },
  dotActive: { backgroundColor: A.cta },

  cta: {
    height: 62,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: A.cta,
    shadowColor: "#4A4200",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ctaText: { fontFamily: fonts.sansBold, fontSize: 18, color: A.onCta, letterSpacing: 0.2 },
});
