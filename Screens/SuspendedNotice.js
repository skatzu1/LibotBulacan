import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

function daysLeft(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000));
}

export default function SuspendedNotice({ visible, suspensionInfo, onDismiss }) {
  if (!suspensionInfo) return null;

  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.icon}>⏸</Text>
          <Text style={s.title}>Account temporarily suspended</Text>
          <Text style={s.body}>
            Your account was suspended following a report review. You can still browse,
            but you won't be able to post comments until the suspension lifts.
          </Text>

          <View style={s.deadlineBox}>
            <Text style={s.deadlineLabel}>Lifts in</Text>
            <Text style={s.deadlineDays}>{daysLeft(suspensionInfo?.suspendedUntil)} days</Text>
            {suspensionInfo?.suspendedUntil && (
              <Text style={s.deadlineDate}>
                {new Date(suspensionInfo.suspendedUntil).toDateString()}
              </Text>
            )}
          </View>

          <TouchableOpacity style={s.btn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={s.btnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card:         { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center' },
  icon:         { fontSize: 40, marginBottom: 10 },
  title:        { fontSize: 18, fontWeight: '700', color: '#2d1f1e', textAlign: 'center', marginBottom: 8 },
  body:         { fontSize: 13.5, color: '#7a5a58', textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  deadlineBox:  { width: '100%', backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 18 },
  deadlineLabel:{ fontSize: 11, color: '#92400E', fontWeight: '600', marginBottom: 2 },
  deadlineDays: { fontSize: 26, fontWeight: '800', color: '#92400E' },
  deadlineDate: { fontSize: 11, color: '#92400E', marginTop: 4 },
  btn:          { backgroundColor: '#6b4b45', borderRadius: 10, paddingVertical: 13, alignItems: 'center', width: '100%' },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 14.5 },
});