import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import { showAlert, showToast } from "../components/AppAlert";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { Feather } from '@expo/vector-icons';
import { appealAPI } from '../api';
import { useTheme, spacing, radius, typography } from '../context/ThemeContext';

export default function BannedScreen({ banInfo }) {
  const { colors, isDark } = useTheme();
  const { signOut } = useAuth();
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(banInfo.appealStatus === 'submitted');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) {
      return showAlert('Required', 'Please write your appeal before submitting.');
    }

    setSubmitting(true);
    try {
      await appealAPI.submit(text.trim());
      setSubmitted(true);
      showToast('Appeal submitted — it’s under review.', { type: 'success' });
    } catch (err) {
      showAlert('Error', err.message || 'Failed to submit appeal. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const rejected = banInfo.appealStatus === 'rejected';

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.iconWrap, { backgroundColor: colors.dangerBg }]}>
          <Feather name="slash" size={30} color={colors.danger} />
        </View>

        <Text style={[typography.h1, s.center, { color: colors.textPrimary }]}>
          Your account has been banned
        </Text>
        <Text style={[typography.body, s.center, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl }]}>
          Your account was flagged and permanently banned following a report review by our admin team.
        </Text>

        <View style={[s.deadlineBox, { backgroundColor: colors.warningBg }]}>
          <Text style={[typography.label, { color: colors.warning, marginBottom: spacing.xs }]}>
            Time remaining to appeal
          </Text>
          <Text style={[s.deadlineDays, { color: colors.warning }]}>{banInfo.daysLeft || '0'} days</Text>
          <Text style={[typography.caption, s.center, { color: colors.warning, marginTop: spacing.xs, lineHeight: 18 }]}>
            After this period, your account and all associated data will be permanently deleted.
          </Text>
        </View>

        {submitted || rejected ? (
          <View style={[s.statusBox, { backgroundColor: colors.card }]}>
            <Feather
              name={rejected ? 'x-circle' : 'inbox'}
              size={26}
              color={rejected ? colors.danger : colors.brand}
              style={{ marginBottom: spacing.sm }}
            />
            <Text style={[typography.title, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              {rejected ? 'Appeal rejected' : 'Appeal submitted'}
            </Text>
            <Text style={[typography.body, s.center, { color: colors.textSecondary }]}>
              {rejected
                ? 'Your appeal was reviewed and rejected. Your account will be permanently deleted when the deadline above passes.'
                : "Your appeal is under review. We'll process it before your deadline."}
            </Text>
          </View>
        ) : (
          <View style={s.appealBox}>
            <Text style={[typography.title, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Submit an appeal
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Explain why you believe this suspension was a mistake. Be specific.
            </Text>
            <TextInput
              style={[
                s.input,
                { borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.textPrimary },
              ]}
              multiline
              numberOfLines={6}
              placeholder="Write your appeal here..."
              placeholderTextColor={colors.placeholder}
              value={text}
              onChangeText={setText}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[s.btn, { backgroundColor: colors.accent }, submitting && s.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={colors.onAccent} />
                : <Text style={[typography.title, { color: colors.onAccent }]}>Submit appeal</Text>}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => signOut()} style={s.signOut}>
          <Text style={[typography.bodyStrong, { color: colors.textSecondary }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1 },
  container:   { flexGrow: 1, padding: spacing.xl, alignItems: 'center' },
  center:      { textAlign: 'center' },
  iconWrap:    {
    width: 64, height: 64, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  deadlineBox: {
    width: '100%', borderRadius: radius.md, padding: spacing.lg,
    marginBottom: spacing.xl, alignItems: 'center',
  },
  deadlineDays: { fontSize: 32, fontWeight: '800' },
  statusBox:   {
    width: '100%', borderRadius: radius.md, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing.xl,
  },
  appealBox:   { width: '100%', marginBottom: spacing.xl },
  input:       {
    borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md,
    fontSize: 14, minHeight: 130,
  },
  btn:         { borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
  btnDisabled: { opacity: 0.6 },
  signOut:     { marginTop: spacing.sm, padding: spacing.lg, width: '100%', alignItems: 'center' },
});
