import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getBucketListForSpot } from './Mission';
import { verifyMission } from '../utils/missionAI';

export default function BucketListScreen({ navigation, route }) {
  const { spot } = route.params ?? {};
  const items = getBucketListForSpot(spot?.id);

  // ✅ Track completed items
  const [completedItems, setCompletedItems] = useState([]);
  const [loadingId, setLoadingId] = useState(null);

  // Animation
  const anims = useRef(items.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      90,
      anims.map(a =>
        Animated.spring(a, {
          toValue: 1,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        })
      )
    ).start();
  }, []);

  // ✅ VERIFY FUNCTION (your logic merged)
  async function handleVerifyPress(item) {
    setLoadingId(item.id);

    try {
      const result = await verifyMission(item.id);

      if (result.cancelled) return;

      if (result.verified) {
        setCompletedItems(prev => [...prev, item.id]);
        showSuccess('Mission verified! +1 completed');
      } else {
        const pct = (result.confidence * 100).toFixed(0);
        showError(`Not verified (${pct}%). Try again.`);
      }
    } catch (err) {
      showError('Something went wrong.');
    } finally {
      setLoadingId(null);
    }
  }

  const completed = completedItems.length;
  const total = items.length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="chevron-left" size={22} color="#3a2a28" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Bucket List</Text>
            {spot?.name && (
              <Text style={styles.headerSub}>{spot.name}</Text>
            )}
          </View>

          <View style={{ width: 36 }} />
        </View>

        {/* PROGRESS */}
        <View style={styles.progressCard}>
          <Text style={styles.progressText}>
            {completed} / {total} completed
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(completed / total) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* ITEMS */}
        {items.map((item, i) => {
          const isDone = completedItems.includes(item.id);
          const isLoading = loadingId === item.id;

          return (
            <Animated.View
              key={item.id}
              style={{
                opacity: anims[i],
                transform: [
                  {
                    translateY: anims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    }),
                  },
                ],
                width: '100%',
              }}
            >
              <TouchableOpacity
                style={[styles.itemCard, isDone && styles.itemCardDone]}
                onPress={() =>
                  isDone ? null : handleVerifyPress(item)
                }
              >
                <View
                  style={[
                    styles.accentBar,
                    {
                      backgroundColor: isDone
                        ? '#ccc'
                        : item.accentColor,
                    },
                  ]}
                />

                <View style={styles.itemBody}>
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle}>
                      {item.title}
                    </Text>

                    {isLoading && (
                      <Text style={{ fontSize: 12 }}>
                        Verifying...
                      </Text>
                    )}
                  </View>

                  <Feather
                    name={
                      isDone
                        ? 'check-circle'
                        : 'camera'
                    }
                    size={18}
                    color={
                      isDone ? '#4CAF50' : '#c8a29e'
                    }
                  />
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}