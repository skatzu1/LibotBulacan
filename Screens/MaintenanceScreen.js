import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, spacing, radius, typography, MAX_FONT_SCALE } from '../context/ThemeContext';
import { PrimaryButton } from '../components/ui';
import Icon from '../components/Icon';

// Without a message from the super admin, the app says this.
export const DEFAULT_MESSAGE = 'Libot Bulacan is being updated. Please check back soon.';

const backBy = (iso) => {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// While the super admin has the system under maintenance (mock defense
// 2026-10-21), this takes the place of the whole app — signed in or not — and
// the server refuses travelers' requests. Nothing is lost: trips, badges and
// points are kept. App.js asks every minute and when the app comes back to the
// front (hooks/useSystemStatus.js), so it opens again by itself.
export default function MaintenanceScreen({ maintenance, onRetry }) {
  const { colors, isDark } = useTheme();
  const [checking, setChecking] = useState(false);
  const until = backBy(maintenance?.expectedEndAt);

  const retry = async () => {
    setChecking(true);
    try { await onRetry?.(); } finally { setChecking(false); }
  };

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={[s.iconWrap, { backgroundColor: colors.warningBg }]}>
          <Icon name="tool" size={30} color={colors.warning} />
        </View>

        <Text style={[typography.h1, s.center, { color: colors.textPrimary }]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Under maintenance
        </Text>
        <Text style={[typography.body, s.center, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {maintenance?.message || DEFAULT_MESSAGE}
        </Text>

        {until && (
          <View style={[s.backBox, { backgroundColor: colors.warningBg }]}>
            <Text style={[typography.label, { color: colors.warning, marginBottom: spacing.xs }]}>Expected back</Text>
            <Text style={[typography.bodyStrong, s.center, { color: colors.warning }]}>{until}</Text>
          </View>
        )}

        <Text style={[typography.caption, s.center, { color: colors.textMuted, marginBottom: spacing.xl }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Your trips, badges and points are safe. The app opens again by itself when the work is done.
        </Text>

        {checking
          ? <ActivityIndicator color={colors.brand} accessibilityLabel="Checking" />
          : <PrimaryButton title="Try again" onPress={retry} style={s.retry} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:    { flex: 1 },
  container: { flexGrow: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  center:    { textAlign: 'center' },
  iconWrap:  { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  backBox:   { width: '100%', borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, alignItems: 'center' },
  retry:     { alignSelf: 'stretch' },
});
