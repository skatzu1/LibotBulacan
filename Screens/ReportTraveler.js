// Screens/ReportTraveler.js
//
// Traveler profile → Report this traveler (2026-10-25). Why, and what happened
// if they want to say, then Send: it goes to the admins' User Management →
// Reported (LibotBackend POST /api/reports/user), who can warn, suspend or ban,
// or dismiss it. The traveler is never told who reported them.
//
// One report from each traveler waits at a time; the server says so (409) and
// the profile shows "You reported this traveler" until the admins decide.
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAlert, showToast } from "../components/AppAlert";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import { ScreenHeader, GroupLabel, PrimaryButton, H_PAD } from "../components/ui";
import KeyboardAvoider from "../components/KeyboardAvoider";
import useKeyboardAwareScroll from "../hooks/useKeyboardAwareScroll";
import api from "../api";

// The server's keys and labels (LibotBackend models/Report.js USER_REPORT_REASONS).
export const REASONS = [
  { key: "offensive_name",      label: "Offensive name" },
  { key: "inappropriate_photo", label: "Inappropriate profile photo" },
  { key: "harassment",          label: "Harassment or bullying" },
  { key: "impersonation",       label: "Pretending to be someone else" },
  { key: "spam",                label: "Spam or a fake account" },
  { key: "cheating",            label: "Cheating (fake visits or points)" },
  { key: "other",               label: "Something else" },
];

// The server's limit (LibotBackend utils/textLimits.js reportDetails).
const MAX_CHARS = 500;

export default function ReportTraveler({ navigation, route }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAwareScroll();
  const { clerkUserId, name = "this traveler" } = route.params || {};

  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);

  const needsDetails = reason === "other";
  const nearLimit = details.length >= MAX_CHARS * 0.9;

  const send = async () => {
    if (sending) return;
    if (!reason) {
      showAlert("Choose a reason", `Tell us why you're reporting ${name}.`);
      return;
    }
    if (needsDetails && !details.trim()) {
      showAlert("A little more, please", "Tell us what happened.");
      return;
    }
    setSending(true);
    try {
      await api.post("/api/reports/user", { reportedClerkUserId: clerkUserId, reason, details: details.trim() });
      showToast("Report sent. The admins will look at it.", { type: "success" });
      navigation.goBack();
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message;
      if (status === 409) {
        showToast(message || "You've already reported this traveler.", { type: "info" });
        navigation.goBack();
      } else if (status === 400 || status === 404) {
        showAlert("Couldn't send the report", message || "Please try again.");
      } else {
        showAlert(
          "Couldn't send the report",
          !err?.response ? "Couldn't reach the server. Check your connection and try again." : "Please try again in a moment.",
        );
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoider style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Report Traveler" onBack={() => navigation.goBack()} />
      <ScrollView
        ref={kb.ref}
        onScroll={kb.onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Your report about <Text style={{ fontFamily: fonts.sansSemi, color: colors.textPrimary }}>{name}</Text> goes
          to the Libot Bulacan admins. They won't be told who reported them.
        </Text>

        <GroupLabel style={styles.label}>What's wrong?</GroupLabel>
        <View style={styles.options} accessibilityRole="radiogroup">
          {REASONS.map((r) => {
            const on = reason === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={r.label}
                onPress={() => setReason(r.key)}
                activeOpacity={0.8}
                style={[
                  styles.option,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  on && { borderColor: colors.brand, backgroundColor: colors.brandLight },
                ]}
              >
                <View style={[styles.radio, { borderColor: on ? colors.brand : colors.textMuted }]}>
                  {on && <View style={[styles.radioDot, { backgroundColor: colors.brand }]} />}
                </View>
                <Text style={[styles.optionText, { color: on ? colors.textPrimary : colors.textSecondary }, on && { fontFamily: fonts.sansSemi }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <GroupLabel style={styles.label}>{needsDetails ? "What happened?" : "Anything to add? (optional)"}</GroupLabel>
        <TextInput
          style={[
            styles.message,
            { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: focused ? colors.inputBorderFocus : colors.inputBorder },
          ]}
          multiline
          value={details}
          onChangeText={setDetails}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Where you saw it, and what they did"
          placeholderTextColor={colors.placeholder}
          maxLength={MAX_CHARS}
          textAlignVertical="top"
          accessibilityLabel={needsDetails ? "What happened" : "Anything to add, optional"}
          accessibilityHint={`Up to ${MAX_CHARS} characters`}
        />
        <Text
          style={[styles.count, { color: nearLimit ? colors.warning : colors.textMuted }]}
          accessibilityLabel={`${details.length} of ${MAX_CHARS} characters`}
        >
          {details.length}/{MAX_CHARS}
        </Text>

        <PrimaryButton title="Send report" icon="send" onPress={send} loading={sending} style={styles.send} />
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  flex:       { flex: 1 },
  content:    { paddingHorizontal: H_PAD, paddingTop: 12 },
  label:      { marginTop: 22 },
  options:    { gap: 8, marginTop: 10 },
  option:     { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1.5, gap: 12 },
  radio:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot:   { width: 10, height: 10, borderRadius: 5 },
  optionText: { fontSize: 14.5, fontFamily: fonts.sans, flexShrink: 1 },
  message:    { marginTop: 10, borderRadius: 14, borderWidth: 1, padding: 14, minHeight: 120, fontSize: 15, fontFamily: fonts.sans, lineHeight: 21 },
  count:      { fontFamily: fonts.sansSemi, fontSize: 12.5, textAlign: "right", marginTop: 6, paddingHorizontal: 4 },
  send:       { marginTop: 16 },
});
