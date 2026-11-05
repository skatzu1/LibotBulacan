import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme, fonts, radius, MAX_FONT_SCALE } from "../context/ThemeContext";
import { useSystemNotice } from "../hooks/useSystemStatus";
import { H_PAD } from "./ui";
import Icon from "./Icon";

const DISMISSED_KEY = "dismissedUpdateNotice";

const when = (iso) => {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return "";
  return at.toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export default function UpdateNotice() {
  const notice = useSystemNotice();
  const { colors } = useTheme();
  // null until storage answers, so a put-away notice doesn't flash. Nothing
  // saved comes back as null too, which has to end the wait as well.
  const [dismissed, setDismissed] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((saved) => setDismissed(saved ?? "")).catch(() => setDismissed(""));
  }, []);

  if (!notice || dismissed === null || dismissed === notice.id) return null;
  const coming = notice.kind === "scheduled";

  const putAway = () => {
    setDismissed(notice.id);
    AsyncStorage.setItem(DISMISSED_KEY, notice.id).catch(() => {});
  };

  return (
    <View
      style={[s.card, { backgroundColor: colors.brandLight }]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${coming ? `Update coming ${when(notice.at)}` : "Update done"}: ${notice.title}. ${notice.message || ""}`}
    >
      <Icon name={coming ? "clock" : "check-circle"} size={18} color={colors.brand} />
      <View style={s.body}>
        <Text style={[s.kicker, { color: colors.brand }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {coming ? `Update coming · ${when(notice.at)}` : "Update done"}
        </Text>
        <Text style={[s.title, { color: colors.textPrimary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{notice.title}</Text>
        {!!notice.message && (
          <Text style={[s.message, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{notice.message}</Text>
        )}
      </View>
      <TouchableOpacity onPress={putAway} hitSlop={12} accessibilityRole="button" accessibilityLabel="Put this notice away">
        <Icon name="x" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card:    { marginHorizontal: H_PAD, marginTop: 14, padding: 14, borderRadius: radius.md, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  body:    { flex: 1, minWidth: 0 },
  kicker:  { fontSize: 12.5, fontFamily: fonts.sansBold },
  title:   { fontSize: 15, fontFamily: fonts.sansSemi, marginTop: 2 },
  message: { fontSize: 13.5, fontFamily: fonts.sans, marginTop: 3, lineHeight: 19 },
});
