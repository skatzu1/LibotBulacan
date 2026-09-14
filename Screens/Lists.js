import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  StatusBar,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";
import { useArrival } from "../context/ArrivalContext";
import { useBookmark } from "../context/BookmarkContext";
import { useTheme } from "../context/ThemeContext";
import { ScreenHeader, SpotCard, EmptyState, H_PAD } from "../components/ui";
import { BASE_URL } from '../api';

// ── Skeleton import ───────────────────────────────────────────────────────────
import ListsSkeleton from "../components/ListsSkeleton";

// Cloudinary delivery-side resize/crop/optimize. No-ops safely on any
// non-Cloudinary URL (e.g. old Unsplash fallback images), so it's safe
// to wrap every spot image with this.
function optimizeImage(url, { width, height, crop = "fill" } = {}) {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  const transforms = ["f_auto", "q_auto"]; // auto format (webp/avif) + auto quality
  if (width)  transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (width || height) transforms.push(`c_${crop}`);
  return url.replace("/upload/", `/upload/${transforms.join(",")}/`);
}

export default function Lists() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { isBookmarked, toggleBookmark } = useBookmark();
  const { allSpots } = useArrival();
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const category    = route.params?.category    || "Religious";
  const displayName = route.params?.displayName || category;

  const [destinations,  setDestinations]  = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const searchInputRef = useRef(null);

  const fallbackData = {
    Religious: [
      { _id: "1", name: "Barasoain Church", image: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800", description: "Our Lady of Mount Carmel Parish", visitingHours: "6am to 6pm", entranceFee: "Free" },
      { _id: "2", name: "Paoay Church",     image: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=800", description: "UNESCO World Heritage",         visitingHours: "8am to 5pm", entranceFee: "₱50" },
    ],
    Nature: [
      { _id: "1", name: "Biak-na-Bato National Park", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800", description: "Historical and natural site", visitingHours: "7am to 5pm", entranceFee: "₱100" },
    ],
    Historical: [
      { _id: "1", name: "Vigan Heritage", image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800", description: "Spanish colonial city", visitingHours: "24/7", entranceFee: "Free" },
    ],
    Festivals: [
      { _id: "1", name: "Pahiyas Festival", image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800", description: "Harvest festival celebration", visitingHours: "All day", entranceFee: "Free" },
    ],
  };

  useEffect(() => {
    setLoading(true);

    // Spot.category is stored as an array (e.g. ["Festivals"]) per the
    // Mongoose schema. Some legacy docs might still have it as a plain
    // string, so handle both shapes instead of assuming one.
    const filtered = allSpots.filter(s => {
      if (Array.isArray(s.category)) return s.category.includes(category);
      return s.category === category;
    });

    if (filtered.length > 0) {
      setDestinations(filtered.map(spot => ({
        ...spot,
        visitingHours:   spot.visitingHours   || "6am to 10pm",
        entranceFee:     spot.entranceFee     || "Free",
        history:         spot.history         || "Historical information coming soon...",
        recommendations: spot.recommendations || "Recommendations coming soon...",
      })));
      setUsingFallback(false);
    } else {
      setDestinations(fallbackData[category] || []);
      setUsingFallback(true);
    }
    setLoading(false);
  }, [category, allSpots]);

  // ── Search handlers ───────────────────────────────────────────────────────
  const openSearch = () => {
    setSearchActive(true);
    // wait for the input to mount before focusing
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchActive(false);
    setSearchQuery("");
  };

  // Spots visible after applying the in-category search filter
  const visibleDestinations = searchQuery.trim().length > 0
    ? destinations.filter((item) =>
        item.name?.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : destinations;

  const DestinationCard = ({ item }) => {
    const spotIsBookmarked = isBookmarked(item._id);
    return (
      <SpotCard
        spot={{ ...item, image: optimizeImage(item.image, { width: 800, height: 480 }) }}
        wide
        height={180}
        style={{ marginBottom: 14 }}
        onPress={() => navigation.navigate("InformationScreen", { spot: item })}
        right={
          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={(e) => { e.stopPropagation(); toggleBookmark(item); }}
            activeOpacity={0.8}
            accessibilityLabel={spotIsBookmarked ? "Remove bookmark" : "Add bookmark"}
          >
            <FontAwesome5
              name="bookmark"
              size={17}
              solid={spotIsBookmarked}
              color={spotIsBookmarked ? colors.star : "#fff"}
            />
          </TouchableOpacity>
        }
      />
    );
  };

  // ── CHANGED: skeleton replaces ActivityIndicator ──────────────────────────
  if (loading) return <ListsSkeleton cardCount={4} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {searchActive ? (
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={closeSearch} style={styles.backButton} hitSlop={8}>
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.searchInputWrapper}>
            <Feather name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={`Search in ${displayName}...`}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
                <Feather name="x" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <ScreenHeader
          title={displayName}
          onBack={() => navigation.goBack()}
          right={
            <TouchableOpacity onPress={openSearch} hitSlop={8} accessibilityLabel="Search">
              <Feather name="search" size={21} color={colors.textPrimary} />
            </TouchableOpacity>
          }
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.infoText}>
          {visibleDestinations.length} destination{visibleDestinations.length !== 1 ? "s" : ""}
          {usingFallback ? " · offline" : ""}
        </Text>

        {visibleDestinations.length > 0 ? (
          <View style={styles.cardsContainer}>
            {visibleDestinations.map((item) => (
              <DestinationCard key={item._id} item={item} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="map"
            text={searchQuery.trim().length > 0
              ? "No matching spots — try a different search"
              : "No destinations in this category yet"}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── Search header (only while search is active) ──
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 52,
    paddingHorizontal: H_PAD,
    paddingBottom: 10,
  },
  backButton: { width: 36, height: 40, justifyContent: "center", alignItems: "flex-start" },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 42,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary, padding: 0 },

  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 8 },
  infoText: { fontSize: 13.5, color: colors.textSecondary, fontWeight: "500", marginBottom: 16 },

  cardsContainer: {},
  bookmarkButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
});