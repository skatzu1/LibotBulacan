import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, StatusBar, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useArrival } from "../context/ArrivalContext";
import { useTheme } from "../context/ThemeContext";
import { ScreenHeader, SpotCard, EmptyState, H_PAD } from "./ui";

/**
 * Shared "pick a spot" list screen used by the AR / Missions / Navigate flows.
 * Props: title, subtitle, onPick(spot) -> navigation action.
 */
export default function SpotPicker({ title, subtitle, onPick }) {
  const navigation = useNavigation();
  const { allSpots: spots } = useArrival();
  const { colors, isDark } = useTheme();
  const loading = spots.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      <ScreenHeader title={title} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => String(item._id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            ) : null
          }
          ListEmptyComponent={<EmptyState icon="map-pin" text="No spots available yet." />}
          renderItem={({ item }) => (
            <SpotCard
              spot={item}
              wide
              height={132}
              onPress={() => onPick(item, navigation)}
              style={styles.card}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  list:     { paddingHorizontal: H_PAD, paddingBottom: 140 },
  subtitle: { fontSize: 13.5, fontWeight: "500", marginTop: 4, marginBottom: 16 },
  card:     { marginBottom: 12 },
});
