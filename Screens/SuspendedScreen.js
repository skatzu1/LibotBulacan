import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useTheme, spacing, radius, typography, fonts } from '../context/ThemeContext';
import Icon from "../components/Icon";

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function daysLeft(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000));
}

// The ladder in the backend's utils/moderationEngine.js: 7 days, then 14, and
// the 3rd suspension is a permanent ban.
function nextStep(suspensionCount) {
  if (suspensionCount >= 2) return 'If your account is suspended again, it will be banned permanently.';
  return 'If your account is suspended again, it will be for 14 days.';
}

// A suspension locks the account until it ends: this screen takes the place of
// the whole app. App.js checks the status every minute and when the app comes
// back to the front, so the app opens again by itself once the date passes.
export default function SuspendedScreen({ suspensionInfo }) {
  const { colors, isDark } = useTheme();
  const { signOut } = useAuth();
  const until = suspensionInfo?.suspendedUntil;
  const days = daysLeft(until);

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={[s.iconWrap, { backgroundColor: colors.warningBg }]}>
          <Icon name="pause" size={30} color={colors.warning} />
        </View>

        <Text style={[typography.h1, s.center, { color: colors.textPrimary }]}>
          Your account is suspended
        </Text>
        <Text style={[typography.body, s.center, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl }]}>
          An administrator suspended your account. You can't use LibotBulacan until the
          suspension ends. Your trips, badges and points are kept.
        </Text>

        <View style={[s.deadlineBox, { backgroundColor: colors.warningBg }]}>
          <Text style={[typography.label, { color: colors.warning, marginBottom: spacing.xs }]}>
            Suspension ends in
          </Text>
          <Text style={[s.deadlineDays, { color: colors.warning }]}>{plural(days, 'day')}</Text>
          {!!until && (
            <Text style={[typography.caption, s.center, { color: colors.warning, marginTop: spacing.xs }]}>
              {new Date(until).toDateString()}
            </Text>
          )}
        </View>

        <Text style={[typography.body, s.center, { color: colors.textSecondary, marginBottom: spacing.xl }]}>
          The app opens again by itself once the suspension ends. {nextStep(Number(suspensionInfo?.suspensionCount) || 0)}
        </Text>

        <TouchableOpacity accessibilityRole="button" onPress={() => signOut()} style={s.signOut}>
          <Text style={[typography.bodyStrong, { color: colors.textSecondary }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1 },
  container:    { flexGrow: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  center:       { textAlign: 'center' },
  iconWrap:     {
    width: 64, height: 64, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  deadlineBox:  {
    width: '100%', borderRadius: radius.md, padding: spacing.lg,
    marginBottom: spacing.lg, alignItems: 'center',
  },
  deadlineDays: { fontSize: 32, fontFamily: fonts.sansBold },
  signOut:      { padding: spacing.lg, width: '100%', alignItems: 'center' },
});
