// Screens/ReportProblem.js
//
// Settings → Report a Problem. Two questions (what kind of problem, what
// happened), then Send: the server emails it to the developers at
// support@libotbulacan.com, with the app version and phone model, and with
// Reply-To set to the email this account signed up with, so the developers
// can simply reply (backend routes/support.js).
//
// QA 2026-10-16: "use the email used in the registration … submit agad". This
// used to write an email for the person to send from Gmail or their mail app.
// That is now only the fallback, for when the server can't send (no SMTP login
// set up yet, or offline): the old buttons appear, and if there is no mail app
// the address can be copied.
//
// These reports are about the APP (crashes, sign-in, installing), and wrong
// spot details or an offensive review too. Reviews can't be reported from the
// spot's page any more (mock defense 2026-10-21): the server masks bad words as
// they're posted. The website's Report a problem (LibotWeb report.js) still
// writes an email.
import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useUser } from "@clerk/clerk-expo";
import { showAlert, showToast } from "../components/AppAlert";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import { ScreenHeader, GroupLabel, PrimaryButton, H_PAD } from "../components/ui";
import { SUPPORT_EMAIL } from "../utils/legalLinks";
import KeyboardAvoider from "../components/KeyboardAvoider";
import useKeyboardAwareScroll from "../hooks/useKeyboardAwareScroll";
import api from "../api";

const CATEGORIES = [
  { key: "bug",     label: "Something isn't working" },
  { key: "crash",   label: "The app crashes or freezes" },
  { key: "install", label: "Downloading or installing" },
  { key: "account", label: "My account or signing in" },
  // Wrong visiting hours, fee, pin or description: this is where it's reported.
  { key: "spot",    label: "Wrong details about a spot" },
  { key: "other",   label: "Something else" },
];

// The server refuses anything outside these (routes/support.js REPORT_MIN/MAX).
const MIN_CHARS = 10;
const MAX_CHARS = 1000;

// What the developers need to reproduce a problem, without asking for it.
function deviceDetails() {
  const c = Platform.constants || {};
  return {
    appVersion: Constants.expoConfig?.version || "unknown",
    system: Platform.OS === "android" ? `Android ${c.Release || Platform.Version}` : `${Platform.OS} ${Platform.Version}`,
    phone: [c.Manufacturer, c.Model].filter(Boolean).join(" ") || "unknown",
  };
}

const ReportProblem = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardAwareScroll();
  const { user: clerkUser } = useUser();
  const accountEmail = clerkUser?.primaryEmailAddress?.emailAddress || "";

  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  // The server couldn't send: offer the email app / Gmail, as before.
  const [useEmailInstead, setUseEmailInstead] = useState(false);
  const [mailFailed, setMailFailed] = useState(false);

  const device = useMemo(deviceDetails, []);
  const count = message.trim().length;
  const nearLimit = message.length >= MAX_CHARS * 0.9;

  const label = CATEGORIES.find((c) => c.key === category)?.label || "Something else";

  const ready = () => {
    if (count < MIN_CHARS) {
      showAlert("A little more, please", "Tell us what you were doing and what went wrong.");
      return false;
    }
    return true;
  };

  const send = async () => {
    if (!ready() || sending) return;
    setSending(true);
    try {
      await api.post("/api/support/report", { category, message: message.trim(), device });
      showToast(accountEmail ? `Report sent. We'll reply to ${accountEmail}.` : "Report sent. Thank you!", { type: "success" });
      navigation.goBack();
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 400 || status === 429) {
        showAlert("Couldn't send the report", body?.message || "Please try again.");
      } else {
        // Anything else: send it by email. The first line says which failure
        // it was, so a tester can tell "not set up" from "no connection".
        const why =
          body?.notConfigured ? "Sending reports from the app isn't switched on yet."
          : !err?.response   ? "Couldn't reach the server. Check your connection."
          : status === 401   ? "Your sign-in has expired. Log out and in again."
          : "The server couldn't send the email just now.";
        setUseEmailInstead(true);
        showAlert(
          "Send it by email instead",
          `${why} Use the email buttons below: your report is already written in the email.`,
        );
      }
    } finally {
      setSending(false);
    }
  };

  // ── Fallback: an email the person sends themselves ──
  const compose = () => {
    const subject = `Libot Bulacan problem: ${label}`;
    const body = [
      message.trim(),
      "",
      "──",
      `Problem: ${label}`,
      `App version: ${device.appVersion}`,
      `Phone: ${device.phone}`,
      `System: ${device.system}`,
    ].join("\n");
    return { subject, body };
  };

  const openEmailApp = async () => {
    if (!ready()) return;
    const m = compose();
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      setMailFailed(true);
    }
  };

  const openGmailWeb = async () => {
    if (!ready()) return;
    const m = compose();
    const url = "https://mail.google.com/mail/?view=cm&fs=1" +
      `&to=${encodeURIComponent(SUPPORT_EMAIL)}` +
      `&su=${encodeURIComponent(m.subject)}` +
      `&body=${encodeURIComponent(m.body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      showAlert("Couldn't open Gmail", `Please email ${SUPPORT_EMAIL} from any email app.`);
    }
  };

  return (
    <KeyboardAvoider style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Report a Problem" onBack={() => navigation.goBack()} />
      <ScrollView
        ref={kb.ref}
        onScroll={kb.onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          This goes straight to the Libot Bulacan developers. For wrong details about a spot, choose
          that below and name the spot. An offensive review? Bad words are hidden automatically, and
          you can tell us about the rest here.
        </Text>

        <GroupLabel style={styles.label}>What kind of problem?</GroupLabel>
        <View style={styles.options} accessibilityRole="radiogroup">
          {CATEGORIES.map((c) => {
            const on = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c.label}
                onPress={() => setCategory(c.key)}
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
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <GroupLabel style={styles.label}>What happened?</GroupLabel>
        <TextInput
          style={[
            styles.message,
            { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: focused ? colors.inputBorderFocus : colors.inputBorder },
          ]}
          multiline
          value={message}
          onChangeText={setMessage}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="What were you doing, and what went wrong?"
          placeholderTextColor={colors.placeholder}
          maxLength={MAX_CHARS}
          textAlignVertical="top"
          accessibilityLabel="What happened"
          accessibilityHint={`Up to ${MAX_CHARS} characters`}
        />
        <View style={styles.countRow}>
          <Text style={[typography.caption, { color: count > 0 && count < MIN_CHARS ? colors.warning : colors.textMuted }]}>
            {count > 0 && count < MIN_CHARS ? `At least ${MIN_CHARS} characters` : " "}
          </Text>
          <Text
            style={[styles.count, { color: nearLimit ? colors.warning : colors.textMuted }]}
            accessibilityLabel={`${message.length} of ${MAX_CHARS} characters`}
          >
            {message.length}/{MAX_CHARS}
          </Text>
        </View>

        <Text style={[typography.caption, styles.note, { color: colors.textMuted }]}>
          {accountEmail
            ? `Sent from your account's email, ${accountEmail}, so we can reply to you there. `
            : ""}
          Your app version ({device.appVersion}) and phone model are added for us.
        </Text>

        <PrimaryButton title="Send report" icon="send" onPress={send} loading={sending} />

        {useEmailInstead && (
          <View style={styles.emailBox}>
            <Text style={[typography.bodyStrong, { color: colors.textPrimary }]}>Or send it by email</Text>
            <PrimaryButton title="Write the email" icon="mail" variant="secondary" onPress={openEmailApp} style={styles.second} />
            <PrimaryButton title="Use Gmail in the browser" icon="globe" variant="secondary" onPress={openGmailWeb} style={styles.second} />
          </View>
        )}

        {mailFailed && (
          <View style={[styles.fallback, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} accessibilityLiveRegion="polite">
            <Text style={[typography.bodyStrong, { color: colors.textPrimary }]}>No email app on this phone</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              Use Gmail in the browser above, or email us from anywhere. Press and hold the
              address to copy it:
            </Text>
            <Text selectable style={[styles.address, { color: colors.brand }]}>{SUPPORT_EMAIL}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoider>
  );
};

const styles = StyleSheet.create({
  flex:       { flex: 1 },
  content:    { paddingHorizontal: H_PAD, paddingTop: 12 },
  label:      { marginTop: 22 },
  options:    { gap: 8, marginTop: 10 },
  option:     { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1.5, gap: 12 },
  radio:      { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot:   { width: 10, height: 10, borderRadius: 5 },
  optionText: { fontSize: 14.5, fontFamily: fonts.sans, flexShrink: 1 },
  message:    { marginTop: 10, borderRadius: 14, borderWidth: 1, padding: 14, minHeight: 140, fontSize: 15, fontFamily: fonts.sans, lineHeight: 21 },
  countRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingHorizontal: 4 },
  count:      { fontFamily: fonts.sansSemi, fontSize: 12.5 },
  note:       { marginTop: 10, marginBottom: 16 },
  emailBox:   { marginTop: 22, gap: 0 },
  second:     { marginTop: 10 },
  fallback:   { marginTop: 16, padding: 16, borderRadius: 14, borderWidth: 1, gap: 6 },
  address:    { fontSize: 16, fontFamily: fonts.sansSemi, marginTop: 4 },
});

export default ReportProblem;
