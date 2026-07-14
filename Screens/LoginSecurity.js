import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";

// ── Reusable password field ───────────────────────────────────────
const Field = ({ label, icon, value, onChangeText, placeholder, toggleVisible, onToggle }) => (
  <View style={styles.fieldWrapper}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.fieldRow}>
      <View style={styles.fieldIcon}>
        <Feather name={icon} size={16} color="#6b4b45" />
      </View>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#c4a09c"
        secureTextEntry={!toggleVisible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
        <Feather name={toggleVisible ? "eye-off" : "eye"} size={16} color="#b0908c" />
      </TouchableOpacity>
    </View>
  </View>
);

export default function LoginSecurity({ navigation }) {
  const { user: clerkUser, isLoaded } = useUser();

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew]         = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]           = useState(false);

  const isGoogleUser = !(clerkUser?.passwordEnabled ?? false);

  const hasChanges = !!(pwCurrent || pwNew || pwConfirm);

  const validate = () => {
    if (!isGoogleUser && !pwCurrent) {
      Alert.alert("Validation", "Please enter your current password.");
      return false;
    }
    if (!pwNew) {
      Alert.alert("Validation", "Please enter a new password.");
      return false;
    }
    if (pwNew.length < 8) {
      Alert.alert("Validation", "Password must be at least 8 characters.");
      return false;
    }
    if (pwNew !== pwConfirm) {
      Alert.alert("Validation", "Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isGoogleUser) {
        await clerkUser.updatePassword({ newPassword: pwNew, signOutOfOtherSessions: false });
      } else {
        await clerkUser.updatePassword({ currentPassword: pwCurrent, newPassword: pwNew, signOutOfOtherSessions: false });
      }

      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");

      Alert.alert(
        "Password updated",
        isGoogleUser
          ? "Password set! You can now log in with your email and password."
          : "Your password has been changed successfully.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      console.error("[LoginSecurity] Error:", err);
      Alert.alert("Error", err?.errors?.[0]?.longMessage || err?.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6b4b45" />
      </View>
    );
  }

  const saveDisabled = saving || !hasChanges;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-left" size={24} color="#4a2e2c" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Login & Security</Text>
          <TouchableOpacity
            style={[styles.saveButton, saveDisabled && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saveDisabled}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={[styles.saveButtonText, saveDisabled && styles.saveButtonTextDisabled]}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Signed-in with label */}
          <View style={styles.signInMethodRow}>
            <View style={styles.signInMethodIcon}>
              <Feather name={isGoogleUser ? "globe" : "mail"} size={16} color="#6b4b45" />
            </View>
            <View>
              <Text style={styles.signInMethodLabel}>Signed in with</Text>
              <Text style={styles.signInMethodValue}>
                {isGoogleUser ? "Google" : clerkUser?.primaryEmailAddress?.emailAddress || "Email"}
              </Text>
            </View>
          </View>

          {/* Password section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isGoogleUser ? "Set a Password" : "Change Password"}
            </Text>

            {isGoogleUser ? (
              <View style={styles.infoBanner}>
                <Feather name="info" size={15} color="#6b4b45" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={styles.infoBannerText}>
                  You registered with Google. Set a password to also log in with your email and password.
                </Text>
              </View>
            ) : (
              <Text style={styles.sectionNote}>Leave blank to keep your current password.</Text>
            )}

            {!isGoogleUser && (
              <Field
                label="Current Password"
                icon="lock"
                value={pwCurrent}
                onChangeText={setPwCurrent}
                placeholder="Enter current password"
                toggleVisible={showCurrent}
                onToggle={() => setShowCurrent((v) => !v)}
              />
            )}

            <Field
              label="New Password"
              icon="key"
              value={pwNew}
              onChangeText={setPwNew}
              placeholder="At least 8 characters"
              toggleVisible={showNew}
              onToggle={() => setShowNew((v) => !v)}
            />

            <Field
              label={isGoogleUser ? "Confirm Password" : "Confirm New Password"}
              icon="check-circle"
              value={pwConfirm}
              onChangeText={setPwConfirm}
              placeholder="Repeat password"
              toggleVisible={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
            />
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 50 },
  centered:  { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, marginBottom: 8,
  },
  backButton:             { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle:            { fontSize: 20, fontWeight: "700", color: "#4a2e2c" },
  saveButton:             { backgroundColor: "#6b4b45", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 60, alignItems: "center" },
  saveButtonDisabled:     { backgroundColor: "#d4bfbd" },
  saveButtonText:         { color: "#fff", fontWeight: "700", fontSize: 14 },
  saveButtonTextDisabled: { color: "#f0e8e7" },

  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },

  signInMethodRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#faf5f4", borderRadius: 12, borderWidth: 1,
    borderColor: "#f0e0de", paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 28,
  },
  signInMethodIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#f0e0de", justifyContent: "center", alignItems: "center",
  },
  signInMethodLabel: { fontSize: 11, color: "#b0908c", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  signInMethodValue: { fontSize: 14, color: "#4a2e2c", fontWeight: "600", marginTop: 1 },

  section:      { marginBottom: 28 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#b0908c", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 },
  sectionNote:  { fontSize: 12, color: "#c4a09c", marginBottom: 10, marginLeft: 4 },

  infoBanner:     { flexDirection: "row", backgroundColor: "#faf5f4", borderRadius: 12, borderWidth: 1, borderColor: "#f0e0de", padding: 12, marginBottom: 12 },
  infoBannerText: { flex: 1, fontSize: 13, color: "#6b4b45", lineHeight: 18 },

  fieldWrapper: { marginBottom: 10 },
  fieldLabel:   { fontSize: 12, fontWeight: "600", color: "#8a5e58", marginBottom: 5, marginLeft: 4 },
  fieldRow:     { flexDirection: "row", alignItems: "center", backgroundColor: "#faf5f4", borderRadius: 12, borderWidth: 1, borderColor: "#f0e0de", paddingHorizontal: 12, paddingVertical: 11 },
  fieldIcon:    { width: 28, height: 28, borderRadius: 8, backgroundColor: "#f0e0de", justifyContent: "center", alignItems: "center", marginRight: 10 },
  fieldInput:   { flex: 1, fontSize: 15, color: "#4a2e2c", fontWeight: "500", padding: 0 },
  eyeBtn:       { padding: 4 },
});