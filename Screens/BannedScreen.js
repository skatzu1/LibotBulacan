import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { appealAPI } from '../api';

export default function BannedScreen({ banInfo }) {
  const { signOut } = useAuth();
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(banInfo.appealStatus === 'submitted');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) {
      return Alert.alert('Required', 'Please write your appeal before submitting.');
    }

    setSubmitting(true);
    try {
      await appealAPI.submit(text.trim());
      setSubmitted(true);
      Alert.alert('Success', 'Your appeal has been submitted and is under review.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to submit appeal. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.iconBox}>
        <Text style={s.icon}>🚫</Text>
      </View>

      <Text style={s.title}>Your account has been suspended</Text>
      <Text style={s.subtitle}>
        Your account was flagged and suspended following a report review by our admin team.
      </Text>

      <View style={s.deadlineBox}>
        <Text style={s.deadlineLabel}>Time remaining to appeal</Text>
        <Text style={s.deadlineDays}>{banInfo.daysLeft || '0'} days</Text>
        <Text style={s.deadlineNote}>
          After this period, your account and all associated data will be permanently deleted.
        </Text>
      </View>

      {submitted || banInfo.appealStatus === 'rejected' ? (
        <View style={s.statusBox}>
          {banInfo.appealStatus === 'rejected' ? (
            <>
              <Text style={s.statusIcon}>❌</Text>
              <Text style={s.statusTitle}>Appeal rejected</Text>
              <Text style={s.statusText}>
                Your appeal was reviewed and rejected. Your account will be deleted when the suspension period ends.
              </Text>
            </>
          ) : (
            <>
              <Text style={s.statusIcon}>📬</Text>
              <Text style={s.statusTitle}>Appeal submitted</Text>
              <Text style={s.statusText}>
                Your appeal is under review. We'll process it before your deadline.
              </Text>
            </>
          )}
        </View>
      ) : (
        <View style={s.appealBox}>
          <Text style={s.appealTitle}>Submit an appeal</Text>
          <Text style={s.appealHint}>
            Explain why you believe this suspension was a mistake. Be specific.
          </Text>
          <TextInput
            style={s.input}
            multiline
            numberOfLines={6}
            placeholder="Write your appeal here..."
            placeholderTextColor="#9a7a78"
            value={text}
            onChangeText={setText}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[s.btn, submitting && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Submit appeal</Text>}
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity onPress={() => signOut()} style={s.signOut}>
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flexGrow: 1, padding: 24, backgroundColor: '#fff', alignItems: 'center', paddingTop: 60 },
  iconBox:      { marginBottom: 16 },
  icon:         { fontSize: 56 },
  title:        { fontSize: 22, fontWeight: '700', color: '#2d1f1e', textAlign: 'center', marginBottom: 8 },
  subtitle:     { fontSize: 14, color: '#7a5a58', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  deadlineBox:  { width: '100%', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16, marginBottom: 24, alignItems: 'center' },
  deadlineLabel:{ fontSize: 12, color: '#92400E', fontWeight: '600', marginBottom: 4 },
  deadlineDays: { fontSize: 32, fontWeight: '800', color: '#92400E' },
  deadlineNote: { fontSize: 12, color: '#92400E', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  statusBox:    { width: '100%', backgroundColor: '#faf5f4', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 24 },
  statusIcon:   { fontSize: 32, marginBottom: 8 },
  statusTitle:  { fontSize: 16, fontWeight: '700', color: '#2d1f1e', marginBottom: 6 },
  statusText:   { fontSize: 13, color: '#7a5a58', textAlign: 'center', lineHeight: 20 },
  appealBox:    { width: '100%', marginBottom: 24 },
  appealTitle:  { fontSize: 16, fontWeight: '700', color: '#2d1f1e', marginBottom: 6 },
  appealHint:   { fontSize: 13, color: '#7a5a58', marginBottom: 12, lineHeight: 19 },
  input:        { borderWidth: 1.5, borderColor: '#e8d0ce', borderRadius: 10, padding: 12, fontSize: 14, color: '#2d1f1e', minHeight: 130, backgroundColor: '#faf5f4' },
  btn:          { backgroundColor: '#6b4b45', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  signOut:      { marginTop: 8, padding: 20, width: '100%', alignItems: 'center' },
  signOutText:  { color: '#9a7a78', fontSize: 13 },
});