import React, { forwardRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Modal, Pressable, Keyboard,
} from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, fonts, typography, radius, MAX_FONT_SCALE } from "../context/ThemeContext";
import { useAuthStyles } from "./AuthScaffold";
import { formatDob, dobToDate } from "../utils/authValidation";
import Icon from "./Icon";

/*
 * Date of birth, either way (QA 2026-10-16: "both dropdown and typing"):
 * type it as MM/DD/YYYY (the slashes go in by themselves), or tap the
 * calendar for the phone's own date picker — Android's calendar dialog, an
 * iPhone's wheels in a sheet. Both fill the same text, which the form
 * validates (utils/authValidation dobError: real date, 13 or older).
 */

const MIN_DATE = new Date(1900, 0, 1);

// Formats raw digits into MM/DD/YYYY as the user types.
const mask = (text) => {
  const digits = String(text || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
};

const DobField = forwardRef(function DobField({ value, onChange, onBlur, invalid, editable = true }, ref) {
  const a = useAuthStyles();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [iosDraft, setIosDraft] = useState(null); // the wheel's date while the sheet is open

  const today = new Date();
  // Where the picker starts: the typed date if there is one, else 18 years ago.
  const startDate = () => {
    const typed = dobToDate(value);
    if (typed && typed >= MIN_DATE && typed <= today) return typed;
    return new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  };

  const pick = (date) => {
    onChange(formatDob(date));
    onBlur?.();
  };

  const openPicker = () => {
    if (!editable) return;
    Keyboard.dismiss();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: startDate(),
        mode: "date",
        maximumDate: today,
        minimumDate: MIN_DATE,
        onChange: (event, date) => { if (event.type === "set" && date) pick(date); },
      });
    } else {
      setIosDraft(startDate());
    }
  };

  return (
    <>
      <View style={a.fieldRow}>
        <TextInput
          ref={ref}
          style={[a.field, { paddingRight: 60 }, invalid && a.fieldInvalid]}
          placeholder="MM/DD/YYYY"
          placeholderTextColor={colors.placeholder}
          value={value}
          onChangeText={(t) => onChange(mask(t))}
          onBlur={onBlur}
          keyboardType="number-pad"
          maxLength={10}
          editable={editable}
          accessibilityLabel="Date of birth, month slash day slash year"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
        <TouchableOpacity
          onPress={openPicker}
          disabled={!editable}
          style={a.eyeBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Pick your date of birth from a calendar"
        >
          <Icon name="calendar" size={20} color={colors.brand} />
        </TouchableOpacity>
      </View>

      {Platform.OS === "ios" && (
        <Modal transparent visible={!!iosDraft} animationType="slide" onRequestClose={() => setIosDraft(null)}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
            onPress={() => setIosDraft(null)}
            accessibilityRole="button"
            accessibilityLabel="Close the date picker"
          />
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.sheetHead}>
              <TouchableOpacity onPress={() => setIosDraft(null)} hitSlop={10} accessibilityRole="button">
                <Text style={[styles.sheetBtn, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]} accessibilityRole="header">Date of birth</Text>
              <TouchableOpacity
                onPress={() => { pick(iosDraft); setIosDraft(null); }}
                hitSlop={10}
                accessibilityRole="button"
              >
                <Text style={[styles.sheetBtn, styles.sheetDone, { color: colors.brand }]}>Done</Text>
              </TouchableOpacity>
            </View>
            {!!iosDraft && (
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="spinner"
                maximumDate={today}
                minimumDate={MIN_DATE}
                themeVariant={isDark ? "dark" : "light"}
                textColor={colors.textPrimary}
                onChange={(_, date) => { if (date) setIosDraft(date); }}
              />
            )}
          </View>
        </Modal>
      )}
    </>
  );
});

export default DobField;

const styles = StyleSheet.create({
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingTop: 14,
  },
  sheetHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 22, paddingBottom: 4,
  },
  sheetTitle: { ...typography.h3, fontSize: 17 },
  sheetBtn:   { fontFamily: fonts.sansSemi, fontSize: 16 },
  sheetDone:  { fontFamily: fonts.sansBold },
});
