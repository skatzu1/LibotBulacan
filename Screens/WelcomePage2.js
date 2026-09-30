import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  StatusBar, ImageBackground, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showAlert } from "../components/AppAlert";
import { useTheme, typography, fonts, radius, shadow, MAX_FONT_SCALE } from "../context/ThemeContext";
import Icon from "../components/Icon";

const BULACAN_MUNICIPALITIES = [
  "Angat", "Balagtas", "Baliuag", "Bocaue", "Bulakan", "Bustos",
  "Calumpit", "Doña Remedios Trinidad", "Guiguinto", "Hagonoy",
  "Marilao", "Meycauayan City", "Norzagaray", "Obando", "Pandi",
  "Paombong", "Plaridel", "Pulilan", "San Ildefonso",
  "San Jose del Monte City", "San Miguel", "San Rafael", "Santa Maria",
  "I don't live in Bulacan",
];

/*
 * Onboarding, screen 2 of 2.
 *
 * Same bg.png backdrop as screen 1 so the pair reads as one piece, with the
 * municipality picker as a card-coloured pill. Theme colours throughout, so it
 * follows light/dark like the rest of the app. All of the original gating logic is
 * unchanged: a selection is required, "I don't live in Bulacan" is refused, and
 * the choice plus the hasSeenWelcome flag are persisted before Login.
 */
export default function WelcomePage2({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selected, setSelected]         = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isNotBulacan = selected === "I don't live in Bulacan";

  const handleContinue = async () => {
    if (!selected) {
      showAlert("Select your municipality", "Choose where you live in Bulacan to continue.");
      return;
    }
    if (isNotBulacan) {
      showAlert(
        "App Not Available",
        "Sorry, this app is designed for residents and visitors of Bulacan only.",
        [{ text: "OK" }]
      );
      return;
    }
    await AsyncStorage.setItem("hasSeenWelcome", "true");
    await AsyncStorage.setItem("userMunicipality", selected);
    navigation.navigate("Login");
  };

  const handleSelect = (item) => {
    setSelected(item);
    setDropdownOpen(false);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

      <ImageBackground
        source={require("../assets/bg.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        {isDark && <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.photoVeil }]} />}
        <LinearGradient
          colors={["transparent", colors.photoScrim, colors.photoScrim, "transparent"]}
          locations={[0.18, 0.34, 0.74, 0.92]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </ImageBackground>

      <View style={[styles.content, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        <View style={styles.middle}>
          <Text style={styles.headline} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Where do{"\n"}you live?
          </Text>

          <TouchableOpacity
            style={styles.picker}
            onPress={() => setDropdownOpen(true)}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={selected ? `Municipality: ${selected}. Change it` : "Select your municipality"}
          >
            <Text
              style={[styles.pickerText, !selected && styles.pickerPlaceholder]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            >
              {selected ?? "Select your municipality"}
            </Text>
            <Icon name="chevron-down" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          {isNotBulacan && (
            <Text style={styles.warning} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              This app is only available for Bulacan residents and visitors.
            </Text>
          )}
        </View>

        <View style={styles.bottom}>
          <View
            style={styles.dots}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
          </View>

          <TouchableOpacity
            style={styles.cta}
            onPress={handleContinue}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Next — continue to sign in"
          >
            <Text style={styles.ctaText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Municipality picker ── */}
      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setDropdownOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
            <View style={styles.sheetGrabber} />
            <Text style={styles.sheetTitle} accessibilityRole="header">Where do you live?</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
              {BULACAN_MUNICIPALITIES.map((item) => {
                const isChosen  = selected === item;
                const isOutside = item === "I don't live in Bulacan";
                return (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.option,
                      isChosen && styles.optionChosen,
                      isOutside && styles.optionOutside,
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isChosen }}
                    accessibilityLabel={item}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isChosen  && styles.optionTextChosen,
                        isOutside && styles.optionTextOutside,
                      ]}
                    >
                      {item}
                    </Text>
                    {isChosen && <Icon name="check" size={18} color={colors.brand} weight="bold" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },

  content: { flex: 1, paddingHorizontal: 30, justifyContent: "space-between" },

  middle: { flex: 1, justifyContent: "center", gap: 30 },
  // White on the dark scrim band in both themes — it sits on the photo.
  headline: {
    ...typography.h1,
    fontSize: 50,
    lineHeight: 58,
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: c.photoScrim,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },

  picker: {
    height: 64,
    borderRadius: 32,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.cardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 26,
    ...shadow.md,
  },
  pickerText:        { flex: 1, fontFamily: fonts.sansMedium, fontSize: 16, color: c.textPrimary, marginRight: 10 },
  pickerPlaceholder: { color: c.placeholder },

  warning: {
    fontFamily: fonts.sansMedium, fontSize: 13.5, color: "#FFFFFF",
    textAlign: "center", marginTop: -14,
    textShadowColor: c.photoScrim, textShadowRadius: 8,
  },

  bottom: { gap: 22 },
  dots:      { flexDirection: "row", gap: 9, alignSelf: "center" },
  dot:       { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FFFFFF" },
  dotActive: { backgroundColor: c.accent },

  // The app's primary button.
  cta: {
    height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center",
    backgroundColor: c.accent,
    ...shadow.md,
  },
  ctaText: { fontFamily: fonts.sansBold, fontSize: 18, color: c.onAccent, letterSpacing: 0.2 },

  // ── Sheet ──
  sheetBackdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: "78%",
  },
  sheetGrabber: {
    width: 44, height: 5, borderRadius: 3, alignSelf: "center",
    backgroundColor: c.cardBorder, marginBottom: 14,
  },
  sheetTitle:  { ...typography.h2, fontSize: 24, color: c.brandDark, marginBottom: 10, marginLeft: 6 },
  sheetScroll: { marginHorizontal: -4 },

  option: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 15, paddingHorizontal: 18, borderRadius: radius.md, marginBottom: 2,
  },
  optionChosen:  { backgroundColor: c.brandLight },
  optionOutside: { borderTopWidth: 1, borderTopColor: c.divider, marginTop: 10, paddingTop: 18 },
  optionText:        { fontFamily: fonts.sansMedium, fontSize: 15.5, color: c.textPrimary },
  optionTextChosen:  { fontFamily: fonts.sansBold },
  optionTextOutside: { color: c.danger, fontFamily: fonts.sansSemi },
});
