import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useTheme, spacing, radius, typography, fonts } from '../context/ThemeContext';
import Icon from "../components/Icon";

function daysLeft(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000));
}

export default function SuspendedNotice({ visible, suspensionInfo, onDismiss }) {
  const { colors } = useTheme();
  if (!suspensionInfo) return null;

  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[s.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[s.card, { backgroundColor: colors.card }]}>
          <View style={[s.iconWrap, { backgroundColor: colors.warningBg }]}>
            <Icon name="pause" size={26} color={colors.warning} />
          </View>
          <Text style={[typography.h3, s.title, { color: colors.textPrimary }]}>
            Account temporarily suspended
          </Text>
          <Text style={[typography.body, s.body, { color: colors.textSecondary }]}>
            Your account was suspended following a report review. You can still browse,
            but you won't be able to post comments until the suspension lifts.
          </Text>

          <View style={[s.deadlineBox, { backgroundColor: colors.warningBg }]}>
            <Text style={[typography.caption, { color: colors.warning, fontFamily: fonts.sansSemi, marginBottom: 2 }]}>
              Lifts in
            </Text>
            <Text style={[s.deadlineDays, { color: colors.warning }]}>
              {daysLeft(suspensionInfo?.suspendedUntil)} days
            </Text>
            {suspensionInfo?.suspendedUntil && (
              <Text style={[typography.caption, { color: colors.warning, marginTop: 4 }]}>
                {new Date(suspensionInfo.suspendedUntil).toDateString()}
              </Text>
            )}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            style={[s.btn, { backgroundColor: colors.accent }]}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={[typography.title, { color: colors.onAccent }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  card:        { width: '100%', maxWidth: 360, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' },
  iconWrap:    {
    width: 56, height: 56, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  title:       { textAlign: 'center', marginBottom: spacing.sm },
  body:        { textAlign: 'center', marginBottom: spacing.lg },
  deadlineBox: {
    width: '100%', borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', marginBottom: spacing.lg,
  },
  deadlineDays: { fontSize: 26, fontFamily: fonts.sansBold },
  btn:         { borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', width: '100%' },
});
