import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

const STATUS_BAR_HEIGHT = Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 50;

function MissionsSpotSelect({ navigation }) {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    fetch("https://libotbackend.onrender.com/api/spots")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSpots(data.spots);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.backgroundHero }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color={colors.brandDark} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.brandDark }]}>Bakit List</Text>
        </View>
      </View>


      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading spots...</Text>
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.background }]}
              onPress={() => navigation.navigate("Mission", { spot: item })}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: item.image, cache: "force-cache" }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={12} color={colors.brand} />
                  <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.location || "Philippines"}
                  </Text>
                </View>
              </View>
              <View style={[styles.actionBtn, { backgroundColor: colors.brand }]}>
                <Feather name="flag" size={18} color={colors.textInverse} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

export default MissionsSpotSelect;

const styles = StyleSheet.create({
  screen:      { flex: 1, paddingTop: STATUS_BAR_HEIGHT },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
  list:        { paddingHorizontal: 16, paddingBottom: 40 },
  card:        { flexDirection: "row", alignItems: "center", borderRadius: 16, marginBottom: 12, overflow: "hidden", elevation: 4 },
  cardImage:   { width: 80, height: 80 },
  cardInfo:    { flex: 1, paddingHorizontal: 14 },
  cardName:    { fontSize: 15, fontWeight: "700", marginBottom: 5 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText:{ fontSize: 12 },
  actionBtn:   { width: 44, height: 44, borderRadius: 22, marginRight: 12, justifyContent: "center", alignItems: "center" },
});