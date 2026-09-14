import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, StatusBar,
} from "react-native";
import { showAlert } from "../components/AppAlert";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { useTheme, spacing, radius, typography } from "../context/ThemeContext";

// ── Reusable password field ───────────────────────────────────────
const Field = ({ label, icon, value, onChangeText, placeholder, toggleVisible, onToggle }) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.fieldWrapper}>
      <Text style={[typography.label, styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.fieldRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
        <View style={[styles.fieldIcon, { backgroundColor: colors.brandLight }]}>
          <Feather name={icon} size={16} color={colors.brand} />
        </View>
        <TextInput
          style={[styles.fieldInput, { color: colors.textPrimary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={!toggleVisible}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={onToggle} style={styles.eyeBtn} hitSlop={8}>
          <Feather name={toggleVisible ? "eye-off" : "eye"} size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function LoginSecurity({ navigation }) {
  const { colors } = useTheme();
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
      showAlert("Validation", "Please enter your current password.");
      return false;
    }
    if (!pwNew) {
      showAlert("Validation", "Please enter a new password.");
      return false;
    }
    if (pwNew.length < 8) {
      showAlert("Validation", "Password must be at least 8 characters.");
      return false;
    }
    if (pwNew !== pwConfirm) {
      showAlert("Validation", "Passwords do not match.");
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

      showAlert(
        "Password updated",
        isGoogleUser
          ? "Password set! You can now log in with your email and password."
          : "Your password has been changed successfully.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      console.error("[LoginSecurity] Error:", err);
      showAlert("Error", err?.errors?.[0]?.longMessage || err?.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const saveDisabled = saving || !hasChanges;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={8}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Login & Security</Text>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: saveDisabled ? colors.divider : colors.accent },
            ]}
            onPress={handleSave}
            disabled={saveDisabled}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={colors.onAccent} size="small" />
              : <Text style={[typography.bodyStrong, { color: saveDisabled ? colors.textMuted : colors.onAccent }]}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Signed-in with */}
          <View style={[styles.signInMethodRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.signInMethodIcon, { backgroundColor: colors.brandLight }]}>
              <Feather name={isGoogleUser ? "globe" : "mail"} size={16} color={colors.brand} />
            </View>
            <View>
              <Text style={[typography.label, { color: colors.textMuted }]}>SIGNED IN WITH</Text>
              <Text style={[typography.bodyStrong, { color: colors.textPrimary, marginTop: 1 }]}>
                {isGoogleUser ? "Google" : clerkUser?.primaryEmailAddress?.emailAddress || "Email"}
              </Text>
            </View>
          </View>

          {/* Password section */}
          <View style={styles.section}>
            <Text style={[typography.label, styles.sectionTitle, { color: colors.textMuted }]}>
              {isGoogleUser ? "SET A PASSWORD" : "CHANGE PASSWORD"}
            </Text>

            {isGoogleUser ? (
              <View style={[styles.infoBanner, { backgroundColor: colors.brandLight, borderColor: colors.cardBorder }]}>
                <Feather name="info" size={15} color={colors.brand} style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={[typography.body, styles.infoBannerText, { color: colors.textSecondary }]}>
                  You registered with Google. Set a password to also log in with your email and password.
                </Text>
              </View>
            ) : (
              <Text style={[typography.caption, styles.sectionNote, { color: colors.textMuted }]}>
                Leave blank to keep your current password.
              </Text>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1 },
  screen:    { flex: 1 },
  container: { flex: 1 },
  centered:  { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  saveButton: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.pill, minWidth: 60, alignItems: "center",
  },

  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },

  signInMethodRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderRadius: radius.md, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    marginBottom: spacing.xxl,
  },
  signInMethodIcon: {
    width: 34, height: 34, borderRadius: radius.sm,
    justifyContent: "center", alignItems: "center",
  },

  section:      { marginBottom: spacing.xxl },
  sectionTitle: { letterSpacing: 0.8, marginBottom: spacing.sm, marginLeft: spacing.xs },
  sectionNote:  { marginBottom: spacing.sm, marginLeft: spacing.xs },

  infoBanner:     { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  infoBannerText: { flex: 1, lineHeight: 18 },

  fieldWrapper: { marginBottom: spacing.sm },
  fieldLabel:   { marginBottom: spacing.xs, marginLeft: spacing.xs },
  fieldRow: {
    flexDirection: "row", alignItems: "center", borderRadius: radius.md,
    borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  fieldIcon: {
    width: 28, height: 28, borderRadius: radius.sm,
    justifyContent: "center", alignItems: "center", marginRight: spacing.sm,
  },
  fieldInput: { flex: 1, fontSize: 15, fontWeight: "500", padding: 0 },
  eyeBtn:     { padding: spacing.xs },
});
