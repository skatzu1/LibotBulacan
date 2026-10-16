import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, StatusBar,
} from 'react-native';
import { showAlert, showToast } from "../components/AppAlert";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { appealAPI } from '../api';
import { useTheme, spacing, radius, typography, fonts } from '../context/ThemeContext';
import { PrimaryButton } from "../components/ui";
import Icon from "../components/Icon";

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function BannedScreen({ banInfo }) {
  const { colors, isDark } = useTheme();
  const { signOut } = useAuth();
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(banInfo.appealStatus === 'submitted');
  const [submitting, setSubmitting] = useState(false);

  const rejected = banInfo.appealStatus === 'rejected';
  // Accounts are archived, never deleted. A ban can be appealed until its
  // deadline; an inactive traveler can ask for their account back any time.
  const inactive = banInfo.archiveReason === 'inactivity';
  const daysLeft = Number(banInfo.daysLeft) || 0;
  const windowClosed = !inactive && banInfo.daysLeft != null && daysLeft <= 0;

  const handleSubmit = async () => {
    const what = inactive ? 'request' : 'appeal';
    if (!text.trim()) {
      return showAlert('Required', `Please write your ${what} before sending it.`);
    }

    setSubmitting(true);
    try {
      await appealAPI.submit(text.trim());
      setSubmitted(true);
      showToast(inactive ? 'Request sent — an admin will look at it.' : 'Appeal submitted — it’s under review.', { type: 'success' });
    } catch (err) {
      showAlert('Error', err.message || `Failed to send your ${what}. Try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.iconWrap, { backgroundColor: inactive ? colors.warningBg : colors.dangerBg }]}>
          <Icon name={inactive ? 'clock' : 'slash'} size={30} color={inactive ? colors.warning : colors.danger} />
        </View>

        <Text style={[typography.h1, s.center, { color: colors.textPrimary }]}>
          {inactive ? 'Your account was deactivated' : 'Your account has been banned'}
        </Text>
        <Text style={[typography.body, s.center, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl }]}>
          {inactive
            ? "You hadn't used Libot Bulacan for 30 days or more, so it was deactivated. Your trips, badges and points are kept. Ask below to have your account restored."
            : 'Your account was flagged and permanently banned following a report review by our admin team.'}
        </Text>

        {!inactive && (
          <View style={[s.deadlineBox, { backgroundColor: colors.warningBg }]}>
            <Text style={[typography.label, { color: colors.warning, marginBottom: spacing.xs }]}>
              Time remaining to appeal
            </Text>
            <Text style={[s.deadlineDays, { color: colors.warning }]}>{plural(daysLeft, 'day')}</Text>
            <Text style={[typography.caption, s.center, { color: colors.warning, marginTop: spacing.xs, lineHeight: 18 }]}>
              Your account is closed but kept until then, so you can appeal. After this period you can no longer appeal.
            </Text>
          </View>
        )}

        {submitted || rejected || windowClosed ? (
          <View style={[s.statusBox, { backgroundColor: colors.card }]}>
            <Icon
              name={submitted ? 'inbox' : 'x-circle'}
              size={26}
              color={submitted ? colors.brand : colors.danger}
              style={{ marginBottom: spacing.sm }}
            />
            <Text style={[typography.title, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              {submitted
                ? (inactive ? 'Request sent' : 'Appeal submitted')
                : rejected ? (inactive ? 'Request declined' : 'Appeal rejected') : 'Appeals closed'}
            </Text>
            <Text style={[typography.body, s.center, { color: colors.textSecondary }]}>
              {submitted
                ? (inactive ? 'An admin will look at your request to restore your account.' : 'Your appeal is under review.')
                : rejected
                  ? `Your ${inactive ? 'request' : 'appeal'} was reviewed and declined. Your account stays ${inactive ? 'deactivated' : 'closed'}.`
                  : 'The time to appeal this ban has passed. Your account stays closed.'}
            </Text>
          </View>
        ) : (
          <View style={s.appealBox}>
            <Text style={[typography.title, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              {inactive ? 'Ask for your account back' : 'Submit an appeal'}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              {inactive
                ? "Tell us you're back and would like to keep exploring."
                : 'Explain why you believe this ban was a mistake. Be specific.'}
            </Text>
            <TextInput
              style={[
                s.input,
                { borderColor: colors.inputBorder, backgroundColor: colors.inputBg, color: colors.textPrimary },
              ]}
              multiline
              numberOfLines={6}
              placeholder={inactive ? 'Write your request here...' : 'Write your appeal here...'}
              placeholderTextColor={colors.placeholder}
              value={text}
              onChangeText={setText}
              maxLength={1000}
              textAlignVertical="top"
              accessibilityLabel={inactive ? 'Your request' : 'Your appeal'}
            />
            <PrimaryButton title={inactive ? 'Send request' : 'Submit appeal'} onPress={handleSubmit} loading={submitting} style={s.btn} />
          </View>
        )}

        <TouchableOpacity
          accessibilityRole="button" onPress={() => signOut()} style={s.signOut}>
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
  deadlineDays: { fontSize: 32, fontFamily: fonts.sansBold },
  statusBox:   {
    width: '100%', borderRadius: radius.md, padding: spacing.xl,
    alignItems: 'center', marginBottom: spacing.xl,
  },
  appealBox:   { width: '100%', marginBottom: spacing.xl },
  input:       {
    borderWidth: 1.5, borderRadius: radius.md, padding: spacing.md,
    fontSize: 14, fontFamily: fonts.sans, minHeight: 130,
  },
  btn:         { marginTop: spacing.md },
  signOut:     { marginTop: spacing.sm, padding: spacing.lg, width: '100%', alignItems: 'center' },
});
