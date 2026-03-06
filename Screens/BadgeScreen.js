import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - 60) / 3;

/* ================= BADGES ================= */

export const ALL_BADGES = [
  {
    id: "Bahay ko",
    name: "bahay ko",
    icon: require("../assets/badges/BarasoainBadge.png"),
    spotId: "69a9bcc7be09c4f474aa686f",
  },
  {
    id: "divine_mercy",
    name: "National Shrine of Divine Mercy",
    icon: null,
    spotId: "spot_divine_mercy",
  },
  {
    id: "biak_na_bato",
    name: "Biak-na-Bato",
    icon: null,
    spotId: "spot_biak_na_bato",
  },
  {
    id: "bahay_pula",
    name: "Bahay-na-Pula",
    icon: null,
    spotId: "spot_bahay_pula",
  },
  {
    id: "lourdes",
    name: "Grotto of Our Lady of Lourdes",
    icon: null,
    spotId: "spot_lourdes",
  },
  {
    id: "san_rafael",
    name: "San Rafael Church",
    icon: null,
    spotId: "spot_san_rafael",
  },
  {
    id: "casa_real_1",
    name: "Casa Real Shrine",
    icon: null,
    spotId: "spot_STI",
  },
  {
    id: "STI",
    name: "STI",
    icon: null,
    spotId: "spot_casa_real_2",
  },
  {
    id: "bamboo_art",
    name: "Meycauayan Bamboo Art",
    icon: null,
    spotId: "spot_bamboo_art",
  },
];

/* ================= SCREEN ================= */

export default function BadgeScreen() {
  const navigation = useNavigation();
  const [unlockedIds, setUnlockedIds] = useState([]);

  const fadeAnims = useRef(
    ALL_BADGES.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const loadBadges = async () => {
      try {
        const raw = await AsyncStorage.getItem("unlockedBadges");
        const ids = raw ? JSON.parse(raw) : [];
        setUnlockedIds(ids);

        ALL_BADGES.forEach((_, i) => {
          fadeAnims[i].setValue(0);

          Animated.timing(fadeAnims[i], {
            toValue: 1,
            duration: 350,
            delay: i * 60,
            useNativeDriver: true,
          }).start();
        });
      } catch (e) {
        console.warn("Failed to load badges:", e);
      }
    };

    loadBadges();
    const unsubscribe = navigation.addListener("focus", loadBadges);
    return unsubscribe;
  }, [navigation]);

  const unlockedCount = unlockedIds.length;

  return (
    <View style={styles.container}>
      {/* HEADER */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={24} color="#5a3a38" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Badges</Text>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {unlockedCount}/{ALL_BADGES.length}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* PROGRESS */}

        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>
            {unlockedCount === 0
              ? "Visit locations to earn badges!"
              : unlockedCount === ALL_BADGES.length
              ? "🎉 All badges unlocked!"
              : `${ALL_BADGES.length - unlockedCount} more to unlock`}
          </Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: `${
                    (unlockedCount / ALL_BADGES.length) * 100
                  }%`,
                },
              ]}
            />
          </View>
        </View>

        {/* BADGE GRID */}

        <View style={styles.grid}>
          {ALL_BADGES.map((badge, index) => {
            const unlocked = unlockedIds.includes(badge.id);

            return (
              <Animated.View
                key={badge.id}
                style={[
                  styles.badgeWrapper,
                  { opacity: fadeAnims[index] },
                ]}
              >
                <View
                  style={[
                    styles.badgeCard,
                    !unlocked && styles.badgeCardLocked,
                  ]}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      !unlocked && styles.iconCircleLocked,
                    ]}
                  >
                    {badge.icon ? (
                      <Image
                        source={badge.icon}
                        style={[
                          styles.badgeImage,
                          !unlocked && styles.badgeIconLocked,
                        ]}
                      />
                    ) : (
                      <Feather name="image" size={22} color="#bbb" />
                    )}

                    {unlocked && (
                      <View style={styles.checkOverlay}>
                        <Feather
                          name="check-circle"
                          size={16}
                          color="#8b4440"
                        />
                      </View>
                    )}

                    {!unlocked && (
                      <View style={styles.lockOverlay}>
                        <Feather name="lock" size={14} color="#aaa" />
                      </View>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.badgeName,
                      !unlocked && styles.badgeNameLocked,
                    ]}
                    numberOfLines={3}
                  >
                    {badge.name}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5c4c1",
    paddingTop: 50,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4a2e2c",
  },

  countBadge: {
    backgroundColor: "#8b4440",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  countText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
  },

  progressContainer: {
    marginBottom: 20,
  },

  progressLabel: {
    fontSize: 13,
    color: "#6a4a48",
    fontWeight: "500",
    marginBottom: 8,
    textAlign: "center",
  },

  progressTrack: {
    height: 8,
    backgroundColor: "#e8b8b4",
    borderRadius: 4,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#8b4440",
    borderRadius: 4,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  badgeWrapper: {
    width: CARD_SIZE,
    marginBottom: 16,
  },

  badgeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    shadowColor: "#8b4440",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 110,
  },

  badgeCardLocked: {
    backgroundColor: "#f0e0de",
    shadowOpacity: 0.05,
  },

  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fce8e6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#e8b8b4",
    position: "relative",
  },

  iconCircleLocked: {
    backgroundColor: "#e8dede",
    borderColor: "#ccc",
  },

  badgeImage: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },

  badgeIconLocked: {
    opacity: 0.25,
  },

  checkOverlay: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#fff",
    borderRadius: 10,
  },

  lockOverlay: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#f0e0de",
    borderRadius: 10,
    padding: 1,
  },

  badgeName: {
    fontSize: 10,
    fontWeight: "600",
    color: "#4a2e2c",
    textAlign: "center",
    lineHeight: 13,
  },

  badgeNameLocked: {
    color: "#aaa",
  },
});