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
import { BASE_URL } from '../api';

// ── Skeleton import ───────────────────────────────────────────────────────────
import ListsSkeleton from "../components/ListsSkeleton";

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
    const filtered = allSpots.filter(s =>
      (Array.isArray(s.categories) && s.categories.includes(category)) ||
      s.category === category
    );

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
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("InformationScreen", { spot: item })}
        activeOpacity={0.85}
      >
        <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />

        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={(e) => { e.stopPropagation(); toggleBookmark(item); }}
          activeOpacity={0.8}
        >
          <FontAwesome5
            name="bookmark"
            size={20}
            solid={spotIsBookmarked}
            color={spotIsBookmarked ? "#f4c542" : "#fff"}
          />
        </TouchableOpacity>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
          {item.location && (
            <View style={styles.locationContainer}>
              <Feather name="map-pin" size={12} color={colors.textMuted} />
              <Text style={styles.locationText}>{item.location}</Text>
            </View>
          )}
          {Array.isArray(item.categories) && item.categories.length > 1 && (
            <View style={styles.tagsRow}>
              {item.categories.map((cat) => (
                <View key={cat} style={styles.tag}>
                  <Text style={styles.tagText}>{cat}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── CHANGED: skeleton replaces ActivityIndicator ──────────────────────────
  if (loading) return <ListsSkeleton cardCount={4} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        {searchActive ? (
          <>
            <TouchableOpacity onPress={closeSearch} style={styles.backButton}>
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
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Feather name="x" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Feather name="chevron-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{displayName}</Text>
            <TouchableOpacity style={styles.searchButton} onPress={openSearch}>
              <Feather name="search" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info bar */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {visibleDestinations.length} destination{visibleDestinations.length !== 1 ? "s" : ""} found
          </Text>
          {usingFallback && (
            <View style={styles.offlineBadge}>
              <Feather name="wifi-off" size={12} color="#c0392b" />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </View>

        {visibleDestinations.length > 0 ? (
          <View style={styles.cardsContainer}>
            {visibleDestinations.map((item) => (
              <DestinationCard key={item._id} item={item} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="map" size={64} color={colors.cardBorder} />
            <Text style={styles.emptyText}>
              {searchQuery.trim().length > 0 ? "No matching spots" : "No destinations found"}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery.trim().length > 0
                ? "Try a different search term"
                : "Try selecting a different category"}
            </Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
    minHeight: 40,
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
    color: colors.textPrimary,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
  },
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },

  // ── Search input ──
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },

  scrollContent: { paddingHorizontal: 20 },

  // ── Info bar ──
  infoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  infoText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: "500",
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fde8e6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  offlineText: {
    fontSize: 12,
    color: "#c0392b",
    fontWeight: "600",
  },

  // ── Cards ──
  cardsContainer: { gap: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: 160,
    backgroundColor: colors.cardBorder,
  },
  bookmarkButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  cardContent: { padding: 14 },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  locationText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  tag: {
    backgroundColor: colors.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 10,
    color: colors.brandDark,
    fontWeight: "600",
  },

  // ── Empty state ──
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 14,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 5,
  },
});