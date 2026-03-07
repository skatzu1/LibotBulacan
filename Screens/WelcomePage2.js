import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";

const BULACAN_MUNICIPALITIES = [
  "Angat", "Balagtas", "Baliuag", "Bocaue", "Bulakan", "Bustos",
  "Calumpit", "Doña Remedios Trinidad", "Guiguinto", "Hagonoy",
  "Marilao", "Meycauayan City", "Norzagaray", "Obando", "Pandi",
  "Paombong", "Plaridel", "Pulilan", "San Ildefonso",
  "San Jose del Monte City", "San Miguel", "San Rafael", "Santa Maria",
  "I don't live in Bulacan",
];

export default function WelcomePage2({ navigation }) {
  const [selected, setSelected]         = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isNotBulacan = selected === "I don't live in Bulacan";

  const handleContinue = async () => {
    if (!selected) {
      Alert.alert("Select your municipality", "Choose where you live in Bulacan to continue.");
      return;
    }
    if (isNotBulacan) {
      Alert.alert(
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

      <View style={styles.titleContainer}>
        <Text style={styles.title}>Discover the Heart of Luzon</Text>
        <Text style={styles.subtitle}>A guidance for your journey through Bulacan</Text>
      </View>

      <View style={styles.card}>
        <Image
          source={require("../assets/welcome2.png")}
          style={styles.image}
        />
      </View>

      {/* Municipality selector */}
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Where do you live?</Text>

        <TouchableOpacity
          style={[styles.dropdown, isNotBulacan && styles.dropdownError]}
          onPress={() => setDropdownOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.dropdownText, !selected && styles.dropdownPlaceholder]}>
            {selected ?? "Select your municipality"}
          </Text>
          <Feather
            name="chevron-down"
            size={18}
            color={isNotBulacan ? "#c0392b" : "#6b4b45"}
          />
        </TouchableOpacity>

        {isNotBulacan && (
          <Text style={styles.errorText}>
            This app is only available for Bulacan residents and visitors.
          </Text>
        )}
      </View>

      {/* Continue button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, isNotBulacan && styles.buttonDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown modal */}
      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setDropdownOpen(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Municipality</Text>
              <TouchableOpacity onPress={() => setDropdownOpen(false)}>
                <Feather name="x" size={22} color="#6b4b45" />
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
                      isChosen && styles.optionSelected,
                      isNotBulacanOption && styles.optionNotBulacan,
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isChosen && styles.optionTextSelected,
                        isNotBulacanOption && styles.optionTextNotBulacan,
                      ]}
                    >
                      {item}
                    </Text>
                    {isChosen && <Feather name="check" size={16} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  // ── Title ──
  titleContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#4a2e2c",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#7a5a58",
    marginTop: 8,
  },

  // ── Image card ──
  card: {
    width: "100%",
    backgroundColor: "#f7cfc9",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    height: 320,
  },
  image: {
    width: 260,
    height: 260,
    resizeMode: "contain",
  },

  // ── Municipality selector ──
  selectorContainer: {
    width: "100%",
    marginBottom: 8,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a2e2c",
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#d9b8b5",
  },
  dropdownError: {
    borderColor: "#c0392b",
    backgroundColor: "#fff5f5",
  },
  dropdownText: {
    fontSize: 15,
    color: "#4a2e2c",
    fontWeight: "500",
    flex: 1,
  },
  dropdownPlaceholder: {
    color: "#b0908c",
    fontWeight: "400",
  },
  errorText: {
    fontSize: 12,
    color: "#c0392b",
    marginTop: 6,
    marginLeft: 4,
  },

  // ── Button ──
  buttonContainer: {
    width: "100%",
    marginTop: 12,
  },
  button: {
    backgroundColor: "#6b4b45",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#c4a4a0",
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  // ── Dropdown modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e0de",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#4a2e2c",
  },
  modalList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  optionSelected: {
    backgroundColor: "#6b4b45",
  },
  optionNotBulacan: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0e0de",
    borderRadius: 0,
  },
  optionText: {
    fontSize: 15,
    color: "#4a2e2c",
    fontWeight: "500",
  },
  optionTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  optionTextNotBulacan: {
    color: "#c0392b",
    fontWeight: "600",
  },
});