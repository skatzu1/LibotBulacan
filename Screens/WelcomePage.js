import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ImageBackground,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, typography, fonts, shadow, MAX_FONT_SCALE } from "../context/ThemeContext";

/*
 * Onboarding, screen 1 of 2.
 *
 * bg.png (Bulacan landmarks, shared with the sign-in and sign-up screens), an
 * oversized headline with two words picked out in the accent yellow, page
 * dots, and the yellow Next button. Colours are the app's theme tokens: in
 * dark mode the photo sits under the same dark veil as the sign-in screens.
 */
export default function WelcomePage({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

      <ImageBackground
        source={require("../assets/bg.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        {/* Light: the photo as is. Dark: veiled so it doesn't glare. */}
        {isDark && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.photoVeil }]} />}
        {/* White text over bg.png measures ~1.5:1 on its own. This band sits
            behind the headline only and lifts it past 6:1 without darkening
            the whole composition. */}
        <LinearGradient
          colors={["transparent", colors.photoScrim, colors.photoScrim, "transparent"]}
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

const makeStyles = (c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },

  content: { flex: 1, paddingHorizontal: 30, justifyContent: "space-between" },

  headlineWrap: { flex: 1, justifyContent: "center" },
  // White on the dark scrim band in both themes — it sits on the photo, not
  // on a page surface.
  headline: {
    ...typography.h1,
    fontSize: 52,
    lineHeight: 60,
    color: "#FFFFFF",
    textAlign: "center",
    // Backs up the scrim band over the brightest parts of the photograph.
    textShadowColor: c.photoScrim,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  accentWord: { color: c.accent },

  bottom: { gap: 22 },
  dots:      { flexDirection: "row", gap: 9, alignSelf: "center" },
  dot:       { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FFFFFF" },
  dotActive: { backgroundColor: c.accent },

  // The app's primary button.
  cta: {
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accent,
    ...shadow.md,
  },
  ctaText: { fontFamily: fonts.sansBold, fontSize: 18, color: c.onAccent, letterSpacing: 0.2 },
});
