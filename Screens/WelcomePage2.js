import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  StatusBar, ImageBackground, Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showAlert } from "../components/AppAlert";
import { auth as A, typography, fonts, radius, MAX_FONT_SCALE } from "../context/ThemeContext";
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
 * Onboarding, screen 2 of 2 — built from the approved mockup.
 *
 * Same duotone hero as screen 1 so the pair reads as one piece, with the
 * municipality picker as a white pill. All of the original gating logic is
 * unchanged: a selection is required, "I don't live in Bulacan" is refused, and
 * the choice plus the hasSeenWelcome flag are persisted before Login.
 */
export default function WelcomePage2({ navigation }) {
  const insets = useSafeAreaInsets();
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
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground
        source={require("../assets/welcome.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[A.washTop, A.washMid, A.washBottom]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["transparent", "rgba(12,34,36,0.68)", "rgba(12,34,36,0.68)", "transparent"]}
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
            <Icon name="chevron-down" size={22} color={A.muted} />
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
                    {isChosen && <Icon name="check" size={18} color={A.ink} weight="bold" />}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.washTop },

  content: { flex: 1, paddingHorizontal: 30, justifyContent: "space-between" },

  middle: { flex: 1, justifyContent: "center", gap: 30 },
  headline: {
    ...typography.h1,
    fontSize: 50,
    lineHeight: 58,
    color: A.onPhoto,
    textAlign: "center",
    textShadowColor: "rgba(12,34,36,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },

  picker: {
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 26,
    shadowColor: "#0C2224",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  pickerText:        { flex: 1, fontFamily: fonts.sansMedium, fontSize: 16, color: A.ink, marginRight: 10 },
  pickerPlaceholder: { color: A.muted },

  warning: {
    fontFamily: fonts.sansMedium, fontSize: 13.5, color: "#FFFFFF",
    textAlign: "center", marginTop: -14,
    textShadowColor: "rgba(12,34,36,0.55)", textShadowRadius: 8,
  },

  bottom: { gap: 22 },
  dots:      { flexDirection: "row", gap: 9, alignSelf: "center" },
  dot:       { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FFFFFF" },
  dotActive: { backgroundColor: A.cta },

  cta: {
    height: 62, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: A.cta,
    shadowColor: "#4A4200", shadowOpacity: 0.28, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  ctaText: { fontFamily: fonts.sansBold, fontSize: 18, color: A.onCta, letterSpacing: 0.2 },

  // ── Sheet ──
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(12,34,36,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: "78%",
  },
  sheetGrabber: {
    width: 44, height: 5, borderRadius: 3, alignSelf: "center",
    backgroundColor: "rgba(56,65,66,0.25)", marginBottom: 14,
  },
  sheetTitle:  { ...typography.h2, fontSize: 24, color: A.ink, marginBottom: 10, marginLeft: 6 },
  sheetScroll: { marginHorizontal: -4 },

  option: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 15, paddingHorizontal: 18, borderRadius: radius.md, marginBottom: 2,
  },
  optionChosen:  { backgroundColor: A.cyanField },
  optionOutside: { borderTopWidth: 1, borderTopColor: "rgba(56,65,66,0.14)", marginTop: 10, paddingTop: 18 },
  optionText:        { fontFamily: fonts.sansMedium, fontSize: 15.5, color: A.ink },
  optionTextChosen:  { fontFamily: fonts.sansBold },
  optionTextOutside: { color: "#8E1F16", fontFamily: fonts.sansSemi },
});
