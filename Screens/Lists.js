import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";
import { useBookmark } from "../context/BookmarkContext";

const API_URL = "https://libotbackend.onrender.com";

export default function Lists() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { isBookmarked, toggleBookmark } = useBookmark();

  const category    = route.params?.category    || "Religious";
  const displayName = route.params?.displayName || category;

  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

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

  useEffect(() => { loadDestinations(); }, [category]);

  const loadDestinations = async () => {
    try {
      setLoading(true);
      setError(null);
      setUsingFallback(false);

      const response = await fetch(
        `${API_URL}/api/spots/category/${encodeURIComponent(category)}`,
        { method: "GET", headers: { "Content-Type": "application/json" } }
      );

      if (!response.ok) throw new Error(`Backend returned ${response.status}`);

      const data  = await response.json();
      const spots = data.spots || data;

      if (spots.length > 0) {
        setDestinations(spots.map((spot) => ({
          ...spot, // ✅ spreads ALL fields — modelUrl, Badge, categories, coordinates, etc.
          visitingHours:   spot.visitingHours   || "6am to 10pm",
          entranceFee:     spot.entranceFee     || "Free",
          history:         spot.history         || "Historical information coming soon...",
          recommendations: spot.recommendations || "Recommendations coming soon...",
        })));
      } else {
        setDestinations(fallbackData[category] || []);
        setUsingFallback(true);
      }
    } catch (error) {
      setDestinations(fallbackData[category] || []);
      setError("Using offline data");
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

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
              <Feather name="map-pin" size={12} color="#7a5a58" />
              <Text style={styles.locationText}>{item.location}</Text>
            </View>
          )}
          {/* Show category tags if the spot has multiple categories */}
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b4b45" />
        <Text style={styles.loadingText}>Loading destinations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#4a2e2c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{displayName}</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Feather name="search" size={22} color="#4a2e2c" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Info bar */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            {destinations.length} destination{destinations.length !== 1 ? "s" : ""} found
          </Text>
          {usingFallback && (
            <View style={styles.offlineBadge}>
              <Feather name="wifi-off" size={12} color="#c0392b" />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </View>

        {destinations.length > 0 ? (
          <View style={styles.cardsContainer}>
            {destinations.map((item) => (
              <DestinationCard key={item._id} item={item} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="map" size={64} color="#d9b8b5" />
            <Text style={styles.emptyText}>No destinations found</Text>
            <Text style={styles.emptySubtext}>Try selecting a different category</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f7cfc9",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 15,
    color: "#7a5a58",
    fontWeight: "500",
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
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
    color: "#7a5a58",
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
    backgroundColor: "#faf5f4",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#4a2e2c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#e8d0ce",
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
    color: "#4a2e2c",
    marginBottom: 6,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  locationText: {
    fontSize: 13,
    color: "#7a5a58",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  tag: {
    backgroundColor: "#f0e0de",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 10,
    color: "#8b4440",
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
    color: "#4a2e2c",
    marginTop: 14,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#7a5a58",
    marginTop: 5,
  },
});