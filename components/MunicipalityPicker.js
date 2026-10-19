import React, { useState, forwardRef, useImperativeHandle } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, fonts, typography, radius, MAX_FONT_SCALE } from "../context/ThemeContext";
import { useAuthStyles } from "./AuthScaffold";
import { BULACAN_MUNICIPALITIES } from "../utils/municipalities";
import Icon from "./Icon";
import { showAlert } from "./AppAlert";

/*
 * The sign-up form's "which municipality do you live in" dropdown. Looks like
 * the other pill fields; a tap opens a sheet listing Bulacan's 24
 * municipalities. Built on React Native's own Modal, so no new native module
 * (and no new app build just for a picker library).
 *
 * The last row, "I don't live in Bulacan", picks nothing: the sheet closes and
 * a popup explains the app is for residents only (the refusal the welcome
 * screen used to give).
 *
 * `ref.current.focus()` opens it, so the form's "jump to the first problem"
 * works here the same as on a text field.
 *
 * The sheet on its own is MunicipalitySheet, for screens with their own field
 * style (Edit Profile).
 */
const ROW_H = 52;
// Long enough for the sheet's slide-down (animationType "slide").
const SHEET_CLOSE_MS = 450;

const MunicipalityPicker = forwardRef(function MunicipalityPicker(
  { value, onChange, onClose, invalid, disabled },
  ref,
) {
  const a = useAuthStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({ focus: () => !disabled && setOpen(true) }), [disabled]);

  const close = () => { setOpen(false); onClose?.(); };

  return (
    <>
      <TouchableOpacity
        style={[a.field, styles.trigger, invalid && a.fieldInvalid]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={value ? `Municipality, ${value}. Change` : "Choose your municipality"}
      >
        <Text
          style={[styles.triggerText, { color: value ? colors.textPrimary : colors.placeholder }, !value && styles.placeholder]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        >
          {value || "MUNICIPALITY YOU LIVE IN"}
        </Text>
        <Icon name="chevron-down" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <MunicipalitySheet visible={open} value={value} onPick={onChange} onClose={close} />
    </>
  );
});

export default MunicipalityPicker;

/** The list of Bulacan's 24, as a sheet from the bottom. `onPick` gets the name; it closes either way. */
export function MunicipalitySheet({ visible, value, onPick, onClose }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const close = () => onClose?.();
  const pick = (m) => { onPick(m); close(); };

  // The sheet goes first: an iPhone won't show the popup (its own Modal) over
  // a sheet that is still open, so it waits for the slide-down to finish.
  const notResident = () => {
    close();
    setTimeout(() => {
      showAlert(
        "For Bulacan residents only",
        "Sorry, Libot Bulacan is for residents of Bulacan only.",
        [{ text: "OK" }],
        { tone: "info", icon: "map-pin" },
      );
    }, SHEET_CLOSE_MS);
  };
  const initialIndex = Math.max(0, BULACAN_MUNICIPALITIES.indexOf(value) - 3);

  return (
    <Modal transparent visible={visible} animationType="slide" statusBarTranslucent onRequestClose={close}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close the list"
      />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: colors.textPrimary }]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Where in Bulacan do you live?
          </Text>
          <TouchableOpacity onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="x" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={BULACAN_MUNICIPALITIES}
          keyExtractor={(m) => m}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          renderItem={({ item }) => {
            const selected = item === value;
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.divider }, selected && { backgroundColor: colors.brandSoft }]}
                onPress={() => pick(item)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={item}
              >
                <Text
                  style={[styles.rowText, { color: selected ? colors.brand : colors.textPrimary }, selected && styles.rowTextSelected]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                >
                  {item}
                </Text>
                {selected && <Icon name="check" size={18} color={colors.brand} />}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <View style={[styles.outside, { borderTopColor: colors.divider }]}>
              <TouchableOpacity
                style={styles.outsideRow}
                onPress={notResident}
                accessibilityRole="button"
                accessibilityLabel="I don't live in Bulacan"
              >
                <Text style={[styles.outsideText, { color: colors.danger }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  I don't live in Bulacan
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  trigger:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  triggerText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, marginRight: 8 },
  // Matches the uppercase, letter-spaced placeholders of the text fields.
  placeholder: { letterSpacing: 1.2 },

  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    maxHeight: "72%",
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingTop: 18,
  },
  sheetHead:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 10 },
  sheetTitle: { ...typography.h3, flex: 1, marginRight: 12 },
  row: {
    height: ROW_H, paddingHorizontal: 24,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText:         { fontFamily: fonts.sansMedium, fontSize: 15.5 },
  rowTextSelected: { fontFamily: fonts.sansBold },

  outside:     { marginTop: 10, borderTopWidth: 1 },
  outsideRow:  { minHeight: ROW_H, paddingHorizontal: 24, justifyContent: "center" },
  outsideText: { fontFamily: fonts.sansSemi, fontSize: 15.5 },
});
