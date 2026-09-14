import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  StatusBar,
} from "react-native";
import { showAlert } from "../components/AppAlert";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useTheme, spacing, radius, typography } from "../context/ThemeContext";

const BULACAN_MUNICIPALITIES = [
  "Angat", "Balagtas", "Baliuag", "Bocaue", "Bulakan", "Bustos",
  "Calumpit", "Doña Remedios Trinidad", "Guiguinto", "Hagonoy",
  "Marilao", "Meycauayan City", "Norzagaray", "Obando", "Pandi",
  "Paombong", "Plaridel", "Pulilan", "San Ildefonso",
  "San Jose del Monte City", "San Miguel", "San Rafael", "Santa Maria",
  "I don't live in Bulacan",
];

export default function WelcomePage2({ navigation }) {
  const { colors, isDark } = useTheme();
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
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleContainer}>
          <Text style={[typography.h1, styles.title, { color: colors.textPrimary }]}>
            Discover the Heart of Luzon
          </Text>
          <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
            A guide for your journey through Bulacan
          </Text>
        </View>

        <View style={styles.card}>
          <Image source={require("../assets/welcome2.png")} style={styles.image} />
        </View>

        {/* Municipality selector */}
        <View style={styles.selectorContainer}>
          <Text style={[typography.bodyStrong, styles.selectorLabel, { color: colors.textPrimary }]}>
            Where do you live?
          </Text>

          <TouchableOpacity
            style={[
              styles.dropdown,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              isNotBulacan && { borderColor: colors.danger, backgroundColor: colors.dangerBg },
            ]}
            onPress={() => setDropdownOpen(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                typography.body,
                styles.dropdownText,
                { color: selected ? colors.textPrimary : colors.placeholder },
              ]}
              numberOfLines={1}
            >
              {selected ?? "Select your municipality"}
            </Text>
            <Feather
              name="chevron-down"
              size={18}
              color={isNotBulacan ? colors.danger : colors.textSecondary}
            />
          </TouchableOpacity>

          {isNotBulacan && (
            <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
              This app is only available for Bulacan residents and visitors.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Continue button */}
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: isNotBulacan ? colors.textMuted : colors.accent },
        ]}
        onPress={handleContinue}
        activeOpacity={0.85}
      >
        <Text style={[typography.title, { color: colors.onAccent }]}>Continue</Text>
      </TouchableOpacity>

      {/* Dropdown modal */}
      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <TouchableOpacity
          style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setDropdownOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Select Municipality</Text>
              <TouchableOpacity onPress={() => setDropdownOpen(false)} hitSlop={8}>
                <Feather name="x" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalList}
            >
              {BULACAN_MUNICIPALITIES.map((item) => {
                const isChosen           = selected === item;
                const isNotBulacanOption = item === "I don't live in Bulacan";
                return (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.option,
                      isChosen && { backgroundColor: colors.brand },
                      isNotBulacanOption && [styles.optionNotBulacan, { borderTopColor: colors.divider }],
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        typography.body,
                        {
                          color: isChosen
                            ? colors.onBrand
                            : isNotBulacanOption
                            ? colors.danger
                            : colors.textPrimary,
                          fontWeight: isChosen || isNotBulacanOption ? "700" : "500",
                        },
                      ]}
                    >
                      {item}
                    </Text>
                    {isChosen && <Feather name="check" size={16} color={colors.onBrand} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },

  titleContainer: { alignItems: "center", marginBottom: spacing.md },
  title: { textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: spacing.sm },

  card: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 300,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "80%", height: "80%", resizeMode: "contain" },

  selectorContainer: { width: "100%", marginTop: spacing.md },
  selectorLabel: { marginBottom: spacing.sm },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  dropdownText: { flex: 1 },
  errorText: { marginTop: spacing.xs, marginLeft: spacing.xs },

  button: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },

  modalBackdrop: { flex: 1, justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "70%",
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
  modalList: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  optionNotBulacan: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderRadius: 0,
  },
});
