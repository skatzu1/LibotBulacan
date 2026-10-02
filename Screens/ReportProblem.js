// Screens/ReportProblem.js
//
// Settings → Report a Problem. Two questions (what kind of problem, what
// happened), then it opens an email to support@libotbulacan.com with all of it
// written, plus the app version and phone model. The person sends it from
// their own email, so the developers can simply reply.
//
// It used to open a bare mailto: link straight away. On a phone with no mail
// app set up, Android offered to open it in something else and the user got a
// blank page. So the email app is the first way to send, and if that fails the
// screen shows the address (long-press to copy) and offers Gmail in the
// browser, which works on any phone signed in to Google.
//
// These reports are about the APP (crashes, sign-in, installing), not about a
// spot or a review: those are reported from the spot's page and go to the
// admins. The website's Report a problem (LibotWeb report.js) works the same.
import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { showAlert } from "../components/AppAlert";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import { ScreenHeader, GroupLabel, PrimaryButton, H_PAD } from "../components/ui";
import { SUPPORT_EMAIL } from "../utils/legalLinks";
import KeyboardAvoider from "../components/KeyboardAvoider";
import useKeyboardAwareScroll from "../hooks/useKeyboardAwareScroll";

const CATEGORIES = [
  { key: "bug",     label: "Something isn't working" },
  { key: "crash",   label: "The app crashes or freezes" },
  { key: "install", label: "Downloading or installing" },
  { key: "account", label: "My account or signing in" },
  { key: "other",   label: "Something else" },
];

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

  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState(false);
  const [mailFailed, setMailFailed] = useState(false);

  const device = useMemo(deviceDetails, []);

  const compose = () => {
    const label = CATEGORIES.find((c) => c.key === category)?.label || "Something else";
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

  const ready = () => {
    if (message.trim().length < 10) {
      showAlert("A little more, please", "Tell us what you were doing and what went wrong.");
      return null;
    }
    return compose();
  };

  const openEmailApp = async () => {
    const m = ready();
    if (!m) return;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      setMailFailed(true);
    }
  };

  const openGmailWeb = async () => {
    const m = ready();
    if (!m) return;
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
          This goes to the Libot Bulacan developers at {SUPPORT_EMAIL}. Wrong details about a spot,
          or a bad review? Use Report on the spot's page instead, so the admins can fix it.
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
          maxLength={4000}
          textAlignVertical="top"
          accessibilityLabel="What happened"
        />

        <Text style={[typography.caption, styles.note, { color: colors.textMuted }]}>
          Your email opens with this written for you, plus your app version ({device.appVersion})
          and phone model. Add a screenshot there if you have one, then press send.
        </Text>

        <PrimaryButton title="Write the email" icon="mail" onPress={openEmailApp} />
        <PrimaryButton title="Use Gmail in the browser" icon="globe" variant="secondary" onPress={openGmailWeb} style={styles.second} />

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
  note:       { marginTop: 14, marginBottom: 16 },
  second:     { marginTop: 10 },
  fallback:   { marginTop: 16, padding: 16, borderRadius: 14, borderWidth: 1, gap: 6 },
  address:    { fontSize: 16, fontFamily: fonts.sansSemi, marginTop: 4 },
});

export default ReportProblem;
