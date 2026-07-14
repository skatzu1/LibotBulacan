import React from "react";
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
import { useArrival } from "../context/ArrivalContext";
import { useTheme } from "../context/ThemeContext";

const STATUS_BAR_HEIGHT = Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 50;

function ARSpotSelect({ navigation }) {
  const { allSpots: spots } = useArrival();
  const { colors, isDark }  = useTheme();
  const loading = spots.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: STATUS_BAR_HEIGHT }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color={colors.brandDark} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.brandDark }]}>AR Experience</Text>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading spots...</Text>
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={() => navigation.navigate("ar", { spot: item })}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: item.image, cache: "force-cache" }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={12} color={colors.brand} />
                  <Text style={[styles.locationText, { color: colors.brand }]} numberOfLines={1}>
                    {item.location || "Philippines"}
                  </Text>
                </View>
              </View>
              <View style={[styles.actionBtn, { backgroundColor: colors.brand }]}>
                <Feather name="camera" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

export default ARSpotSelect;

const styles = StyleSheet.create({
  screen:       { flex: 1 },
  header: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop:     12,
    paddingBottom:  12,
  },
  backBtn:      { padding: 4 },
  headerTitle:  { fontSize: 22, fontWeight: "700" },
  centered:     { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText:  { marginTop: 12, fontSize: 14 },
  list:         { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  card: {
    flexDirection:  "row",
    alignItems:     "center",
    borderRadius:   16,
    marginBottom:   12,
    overflow:       "hidden",
    elevation:      4,
    borderWidth:    1,
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.08,
    shadowRadius:   6,
  },
  cardImage:    { width: 80, height: 80 },
  cardInfo:     { flex: 1, paddingHorizontal: 14 },
  cardName:     { fontSize: 15, fontWeight: "700", marginBottom: 5 },
  locationRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 12 },
  actionBtn: {
    width:        44,
    height:       44,
    borderRadius: 22,
    marginRight:  12,
    justifyContent: "center",
    alignItems:   "center",
  },
});