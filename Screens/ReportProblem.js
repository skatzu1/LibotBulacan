// Screens/ReportProblem.js
//
// Settings → Report a Problem. A form that sends straight to the developers
// through the website's /api/report endpoint (LibotWeb api/report.js), which
// emails support@libotbulacan.com. It replaces a mailto: link that, on a phone
// with no mail app set up, opened a blank page.
//
// These reports are about the APP (crashes, sign-in, installing), not about a
// spot or a review: those are reported from the spot's page and go to the
// admins. Nothing here touches LibotBackend.
import React, { useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import ImageCropPicker from "react-native-image-crop-picker";
import { useUser } from "@clerk/clerk-expo";
import { showAlert } from "../components/AppAlert";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import { ScreenHeader, GroupLabel, FormField, PrimaryButton, H_PAD } from "../components/ui";
import Icon from "../components/Icon";
import { REPORT_URL, SUPPORT_EMAIL } from "../utils/legalLinks";

const CATEGORIES = [
  { key: "bug",     label: "Something isn't working" },
  { key: "crash",   label: "The app crashes or freezes" },
  { key: "install", label: "Downloading or installing" },
  { key: "account", label: "My account or signing in" },
  { key: "other",   label: "Something else" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// What the developers need to reproduce a problem, without asking for it.
function deviceContext() {
  const c = Platform.constants || {};
  const model = [c.Manufacturer, c.Model].filter(Boolean).join(" ");
  return {
    source: "app",
    appVersion: Constants.expoConfig?.version || "",
    platform: Platform.OS === "android" ? `Android ${c.Release || Platform.Version}` : `${Platform.OS} ${Platform.Version}`,
    device: model,
  };
}

const ReportProblem = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const openedAt = useRef(Date.now());

  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress || "");
  const [shot, setShot] = useState(null);       // { uri, data }
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const context = useMemo(deviceContext, []);

  const pickScreenshot = async () => {
    try {
      // Shrunk on the phone: a full-resolution screenshot is several MB, and
      // 1600px is plenty to read a screen.
      const img = await ImageCropPicker.openPicker({
        mediaType: "photo",
        includeBase64: true,
        compressImageMaxWidth: 1600,
        compressImageMaxHeight: 1600,
        compressImageQuality: 0.8,
        forceJpg: true,
      });
      if (img?.data) setShot({ uri: img.path, data: img.data });
    } catch (e) {
      if (e?.code !== "E_PICKER_CANCELLED") {
        showAlert("Couldn't add that picture", "Try another screenshot, or send the report without one.");
      }
    }
  };

  const send = async () => {
    const text = message.trim();
    const reply = email.trim();
    if (text.length < 10) {
      showAlert("A little more, please", "Tell us what you were doing and what went wrong.");
      return;
    }
    if (reply && !EMAIL_RE.test(reply)) {
      showAlert("Check your email", "That address doesn't look right. Leave it empty if you don't need a reply.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(REPORT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: text,
          email: reply,
          openedAt: openedAt.current,
          screenshot: shot ? { name: "screenshot.jpg", type: "image/jpeg", data: shot.data } : null,
          context: { ...context, account: user?.id || "" },
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSending(false);
      if (res.ok && data.ok) { setSent(true); return; }
      if (res.status === 429) {
        showAlert("Too many reports", "Please wait a few minutes before sending another.");
      } else if (res.status === 413) {
        showAlert("Screenshot too large", "Remove the screenshot or pick a smaller one, then try again.");
      } else {
        showAlert("Couldn't send", `Please try again in a moment. You can also email ${SUPPORT_EMAIL}.`);
      }
    } catch {
      setSending(false);
      showAlert("You're offline", `Try again when you're connected, or email ${SUPPORT_EMAIL}.`);
    }
  };

  if (sent) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Report a Problem" onBack={() => navigation.goBack()} />
        <View style={[styles.done, { paddingBottom: insets.bottom + 40 }]}>
          <View style={[styles.doneMark, { backgroundColor: colors.brand }]}>
            <Icon name="check" size={28} color={colors.onBrand} />
          </View>
          <Text style={[typography.h2, { color: colors.textPrimary }]} accessibilityRole="header">
            Thanks, it's sent
          </Text>
          <Text style={[typography.body, styles.doneText, { color: colors.textSecondary }]}>
            {email.trim()
              ? `Your report is with the developers. If we need more detail, we'll write to ${email.trim()}.`
              : "Your report is with the developers. Thank you for taking the time."}
          </Text>
          <PrimaryButton title="Done" onPress={() => navigation.goBack()} style={styles.doneBtn} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Report a Problem" onBack={() => navigation.goBack()} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          This goes straight to the Libot developers. Wrong details about a spot, or a bad
          review? Use Report on the spot's page instead, so the admins can fix it.
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

        {shot ? (
          <View style={styles.shotRow}>
            <Image source={{ uri: shot.uri }} style={[styles.shot, { borderColor: colors.cardBorder }]} accessibilityIgnoresInvertColors />
            <View style={styles.flex}>
              <Text style={[typography.bodyStrong, { color: colors.textPrimary }]}>Screenshot added</Text>
              <TouchableOpacity onPress={() => setShot(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove screenshot">
                <Text style={[typography.body, { color: colors.brand }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={pickScreenshot}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={[styles.attach, { borderColor: colors.cardBorder }]}
          >
            <Icon name="image" size={18} color={colors.brand} />
            <Text style={[styles.attachText, { color: colors.brand }]}>Add a screenshot</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>optional</Text>
          </TouchableOpacity>
        )}

        <FormField
          label="Your email (optional)"
          icon="mail"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          hint="So we can reply. Leave it empty if you don't need an answer."
          style={styles.label}
        />

        <Text style={[typography.caption, styles.note, { color: colors.textMuted }]}>
          We also send your app version ({context.appVersion || "unknown"}) and phone model
          {context.device ? ` (${context.device})` : ""}, to help us reproduce it.
        </Text>

        <PrimaryButton title="Send report" icon="send" onPress={send} loading={sending} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  attach:     { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed" },
  attachText: { fontSize: 14.5, fontFamily: fonts.sansSemi, flex: 1 },
  shotRow:    { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 12 },
  shot:       { width: 64, height: 96, borderRadius: 10, borderWidth: 1 },
  note:       { marginTop: 18, marginBottom: 16 },
  done:       { flex: 1, paddingHorizontal: H_PAD, paddingTop: 40, alignItems: "flex-start", gap: 12 },
  doneMark:   { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  doneText:   { marginBottom: 8 },
  doneBtn:    { alignSelf: "stretch" },
});

export default ReportProblem;
