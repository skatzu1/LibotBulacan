import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useTheme, spacing, radius, typography } from '../context/ThemeContext';
import { PrimaryButton } from '../components/ui';
import { FormError } from '../components/AuthScaffold';
import MunicipalityPicker from '../components/MunicipalityPicker';
import Icon from '../components/Icon';
import api from '../api';

// Sign-up asks where in Bulacan the traveler lives, but accounts made before it
// did (and a first "Continue with Google" from the sign-in screen, which skips
// the sign-up form) have no answer. App.js shows this once, in place of the
// app, for a signed-in account whose /api/users/me has no municipality; it
// goes away for good once one is saved. Changed later in Edit Profile.
export default function MunicipalityScreen({ onDone }) {
  const { colors, isDark } = useTheme();
  const { signOut } = useAuth();
  const [municipality, setMunicipality] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch('/api/users/me', { municipality });
      onDone(municipality);
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't save it. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={[s.iconWrap, { backgroundColor: colors.brandLight }]}>
          <Icon name="map-pin" size={30} color={colors.brand} />
        </View>

        <Text style={[typography.h1, s.center, { color: colors.textPrimary }]}>
          Where in Bulacan do you live?
        </Text>
        <Text style={[typography.body, s.center, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl }]}>
          LibotBulacan is for residents of Bulacan, and your account was made before the app
          asked. Choose your municipality to continue. Other travelers don't see it.
        </Text>

        <View style={s.field}>
          <MunicipalityPicker value={municipality} onChange={(m) => { setMunicipality(m); setError(''); }} disabled={saving} />
        </View>
        <View style={s.field}>
          <FormError>{error}</FormError>
        </View>

        <PrimaryButton
          title="Continue"
          onPress={save}
          loading={saving}
          disabled={!municipality}
          style={s.field}
        />
        <Text style={[typography.caption, s.center, { color: colors.textMuted, marginTop: spacing.md }]}>
          You can change it later in Edit Profile.
        </Text>

        <TouchableOpacity accessibilityRole="button" onPress={() => signOut()} style={s.signOut} disabled={saving}>
          <Text style={[typography.bodyStrong, { color: colors.textSecondary }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:    { flex: 1 },
  container: { flexGrow: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  center:    { textAlign: 'center' },
  iconWrap:  {
    width: 64, height: 64, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  field:     { width: '100%' },
  signOut:   { padding: spacing.lg, width: '100%', alignItems: 'center', marginTop: spacing.sm },
});
