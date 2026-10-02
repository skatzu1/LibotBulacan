import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAlert, showToast } from "../components/AppAlert";
import { useUser } from "@clerk/clerk-expo";
import { useTheme, spacing, radius, typography } from "../context/ThemeContext";
import {
  ScreenHeader, HeaderAction, FormField, GroupLabel, LoadingState, H_PAD,
} from "../components/ui";
import Icon from "../components/Icon";
import useKeyboardAwareScroll, { KEYBOARD_BEHAVIOR } from "../hooks/useKeyboardAwareScroll";

export default function LoginSecurity({ navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAwareScroll();
  const { user: clerkUser, isLoaded } = useUser();

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew]         = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [saving, setSaving]       = useState(false);

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

      // Same confirmation as Edit Profile: a toast, then back — not a modal
      // whose only button is "OK".
      showToast(isGoogleUser ? "Password set — you can now sign in with email too" : "Password changed", { type: "success" });
      navigation.goBack();
    } catch (err) {
      console.error("[LoginSecurity] Error:", err);
      showAlert("Error", err?.errors?.[0]?.longMessage || err?.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <ScreenHeader
      title="Login & Security"
      onBack={() => navigation.goBack()}
      right={isLoaded && (
        <HeaderAction label="Save" onPress={handleSave} disabled={!hasChanges} loading={saving} />
      )}
    />
  );

  if (!isLoaded) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {header}
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_BEHAVIOR}>
        {header}

        <ScrollView
          ref={kb.ref}
          onScroll={kb.onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Signed-in with */}
          <View style={[styles.signInMethodRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.signInMethodIcon, { backgroundColor: colors.brandLight }]}>
              <Icon name={isGoogleUser ? "globe" : "mail"} size={18} color={colors.brand} />
            </View>
            <View style={styles.flex}>
              <Text style={[typography.label, { color: colors.textMuted }]}>SIGNED IN WITH</Text>
              <Text style={[typography.bodyStrong, { color: colors.textPrimary, marginTop: 1 }]} numberOfLines={1}>
                {isGoogleUser ? "Google" : clerkUser?.primaryEmailAddress?.emailAddress || "Email"}
              </Text>
            </View>
          </View>

          <GroupLabel>{isGoogleUser ? "Set a password" : "Change password"}</GroupLabel>

          {isGoogleUser && (
            <View style={[styles.infoBanner, { backgroundColor: colors.brandLight }]}>
              <Icon name="info" size={15} color={colors.brand} style={styles.infoIcon} />
              <Text style={[typography.body, styles.infoBannerText, { color: colors.textSecondary }]}>
                You registered with Google. Set a password to also sign in with your email and password.
              </Text>
            </View>
          )}

          {!isGoogleUser && (
            <FormField
              label="Current password"
              icon="lock"
              value={pwCurrent}
              onChangeText={setPwCurrent}
              placeholder="Enter current password"
              secure
            />
          )}

          <FormField
            label="New password"
            icon="key"
            value={pwNew}
            onChangeText={setPwNew}
            placeholder="At least 8 characters"
            secure
          />

          <FormField
            label="Confirm new password"
            icon="check-circle"
            value={pwConfirm}
            onChangeText={setPwConfirm}
            placeholder="Repeat password"
            secure
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  scrollContent: { paddingHorizontal: H_PAD, paddingTop: spacing.sm },

  signInMethodRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: spacing.xl,
  },
  signInMethodIcon: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },

  infoBanner:     { flexDirection: "row", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  infoIcon:       { marginRight: 8, marginTop: 3 },
  infoBannerText: { flex: 1 },
});
