import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Dimensions, StatusBar } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { ScreenHeader, SectionTitle, H_PAD } from "../components/ui";
import CategoriesSkeleton from "../components/CategoriesSkeleton";

const { width } = Dimensions.get("window");

const CATEGORIES = [
  { key: "Religious",  label: "Religious",  icon: "users",  image: "https://res.cloudinary.com/dcls9ayhn/image/upload/v1770858981/images_uxnf6s.jpg" },
  { key: "Historical", label: "Historical", icon: "book",   image: "https://res.cloudinary.com/dcls9ayhn/image/upload/v1770859026/images_iggbls.jpg" },
  { key: "Nature",     label: "Nature",     icon: "globe",  image: "https://res.cloudinary.com/dcls9ayhn/image/upload/v1770859084/JdlD3t1A-image_k7g8cd.webp" },
  { key: "Festivals",  label: "Festivals",  icon: "award",  image: "https://res.cloudinary.com/dcls9ayhn/image/upload/v1770859149/newest-tanglawan_pwfcve.jpg" },
];

export default function Categories() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 120); return () => clearTimeout(t); }, []);
  if (!ready) return <CategoriesSkeleton count={4} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      <ScreenHeader
        title="Explore"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        <View style={styles.intro}>
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>Browse by category</Text>
          <Text style={[styles.introSub, { color: colors.textSecondary }]}>
            Pick a theme and discover destinations across Bulacan
          </Text>
        </View>

        <SectionTitle>Categories</SectionTitle>

        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => navigation.navigate("Lists", { category: cat.key, displayName: cat.label })}
              activeOpacity={0.88}
              accessibilityLabel={`${cat.label} spots`}
            >
              <Image source={{ uri: cat.image }} style={styles.cardImg} resizeMode="cover" />
              <View style={styles.cardScrim} />
              <View style={styles.cardIconWrap}>
                <Feather name={cat.icon} size={20} color="#fff" />
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardLabel}>{cat.label}</Text>
                <Feather name="arrow-up-right" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const CARD_W = (width - H_PAD * 2 - 12) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },

  intro: { paddingHorizontal: H_PAD, paddingTop: 6 },
  introTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  introSub: { fontSize: 13.5, fontWeight: "500", marginTop: 6, lineHeight: 20 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: H_PAD,
  },
  card: {
    width: CARD_W,
    height: 168,
    borderRadius: 22,
    overflow: "hidden",
  },
  cardImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  cardScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,20,22,0.42)" },
  cardIconWrap: {
    position: "absolute", top: 14, left: 14,
    width: 40, height: 40, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.28)",
  },
  cardFooter: {
    position: "absolute", left: 14, right: 14, bottom: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  cardLabel: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
});
