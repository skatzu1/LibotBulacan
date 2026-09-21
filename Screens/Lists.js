import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useArrival } from "../context/ArrivalContext";
import { useBookmark } from "../context/BookmarkContext";
import { useTheme, fonts } from "../context/ThemeContext";
import { ScreenHeader, SpotCard, EmptyState, SearchField, H_PAD, TAP } from "../components/ui";
import { BASE_URL } from '../api';

// ── Skeleton import ───────────────────────────────────────────────────────────
import ListsSkeleton from "../components/ListsSkeleton";
import Icon from "../components/Icon";

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
            accessibilityRole="button"
            style={styles.bookmarkButton}
            onPress={(e) => { e.stopPropagation(); toggleBookmark(item); }}
            activeOpacity={0.8}
            accessibilityLabel={spotIsBookmarked ? "Remove bookmark" : "Add bookmark"}
          >
            <Icon
              name="bookmark"
              size={17}
              weight={spotIsBookmarked ? "fill" : "regular"}
              color={spotIsBookmarked ? colors.star : "#fff"}
            />
          </TouchableOpacity>
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* The header stays put whether searching or loading — it used to be
          swapped for a bespoke search bar (with its own hardcoded paddingTop:52
          that disagreed with every other screen), and replaced entirely by the
          skeleton while loading. */}
      <ScreenHeader
        title={displayName}
        onBack={searchActive ? closeSearch : () => navigation.goBack()}
        right={
          searchActive ? null : (
            <TouchableOpacity
              onPress={openSearch}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Search in ${displayName}`}
            >
              <Icon name="search" size={21} color={colors.textPrimary} />
            </TouchableOpacity>
          )
        }
      />

      {searchActive && (
        <View style={styles.searchWrap}>
          <SearchField
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder={`Search in ${displayName}`}
          />
        </View>
      )}

      {loading ? <ListsSkeleton cardCount={4} /> : (
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
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  searchWrap: { paddingHorizontal: H_PAD, paddingBottom: 6 },

  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 8 },
  infoText: { fontSize: 13.5, color: colors.textSecondary, fontFamily: fonts.sansMedium, marginBottom: 16 },

  cardsContainer: {},
  bookmarkButton: {
    width: TAP,
    height: TAP,
    borderRadius: TAP / 2,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
});