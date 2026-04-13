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

const STATUS_BAR_HEIGHT = Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 50;

function TrackSpotSelect({ navigation }) {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);

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
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color="#3a2a28" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Navigate</Text>
        </View>
      </View>


      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5a4a4a" />
          <Text style={styles.loadingText}>Loading spots...</Text>
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("Track", { spot: item })}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: item.image, cache: "force-cache" }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={12} color="#8b5550" />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.location || "Philippines"}
                  </Text>
                </View>
              </View>
              <View style={styles.actionBtn}>
                <Feather name="navigation" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

export default TrackSpotSelect;

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: "#f7cfc9", paddingTop: STATUS_BAR_HEIGHT },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#3a2a28" },
  headerSub:   { fontSize: 13, color: "#8b5550", marginTop: 2 },
  badge:       { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, gap: 6, backgroundColor: "#5a4a4a" },
  badgeText:   { color: "#fff", fontSize: 13, fontWeight: "600" },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#888" },
  list:        { paddingHorizontal: 16, paddingBottom: 40 },
  card:        { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, marginBottom: 12, overflow: "hidden", elevation: 4 },
  cardImage:   { width: 80, height: 80 },
  cardInfo:    { flex: 1, paddingHorizontal: 14 },
  cardName:    { fontSize: 15, fontWeight: "700", color: "#3a2a28", marginBottom: 5 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText:{ fontSize: 12, color: "#8b5550" },
  actionBtn:   { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: "#5a4a4a", justifyContent: "center", alignItems: "center" },
});