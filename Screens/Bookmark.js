import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";
import { useBookmark } from "../context/BookmarkContext";
import { useUser } from "@clerk/clerk-expo";
import { useAuth } from "../context/AuthContext";
import { useProfileImage } from "../context/ProfileImageContext";

export default function Bookmark() {
  const navigation = useNavigation();
  const { bookmarks, toggleBookmark, loading } = useBookmark();
  const { user: clerkUser } = useUser();
  const { user: authUser } = useAuth();
  const { profileImage } = useProfileImage();
  const profilePhoto = profileImage;

  // Extract the actual spot data from bookmarks
  const bookmarkedSpots = useMemo(() => {
    return bookmarks.map(bookmark => {
      if (typeof bookmark.spotId === 'object' && bookmark.spotId?._id) {
        return bookmark.spotId;
      } else {
        console.warn('Bookmark spotId not populated:', bookmark);
        return null;
      }
    }).filter(Boolean);
  }, [bookmarks]);

  const BookmarkCard = ({ item }) => {
    if (!item || !item._id) {
      return (
        <View style={styles.card}>
          <View style={styles.cardImage}>
            <ActivityIndicator size="large" color="#6b4b45" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Loading...</Text>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("InformationScreen", { spot: item })}
        activeOpacity={0.85}
      >
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={styles.cardImage}
            resizeMode="cover"
            onError={(e) => console.log('Image load error:', e)}
          />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: '#e8d0ce', justifyContent: 'center', alignItems: 'center' }]}>
            <Feather name="image" size={40} color="#b0908c" />
          </View>
        )}

        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={() => toggleBookmark(item)}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="bookmark" size={20} solid color="#f4c542" />
        </TouchableOpacity>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.name || "Unknown Spot"}
          </Text>
          {item.location && (
            <View style={styles.locationContainer}>
              <Feather name="map-pin" size={12} color="#7a5a58" />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={26} color="#4a2e2c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Soon to Visit</Text>

        {/* Avatar — matches home screen */}
        <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.avatarWrap}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Feather name="user" size={18} color="#fff" />
            </View>
          )}
          <View style={styles.onlineDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {loading && bookmarks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color="#6b4b45" />
            <Text style={styles.emptyText}>Loading bookmarks...</Text>
          </View>
        ) : bookmarkedSpots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="bookmark" size={64} color="#d9b8b5" />
            <Text style={styles.emptyText}>No bookmarks yet</Text>
            <Text style={styles.emptySubtext}>
              Start exploring and save your favorite destinations
            </Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {bookmarkedSpots.map((spot) => (
              <BookmarkCard key={spot._id || spot.id} item={spot} />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
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

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
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

  // ── Avatar (matches home screen) ──
  avatarWrap: {
    position: "relative",
  },
  avatar: {
  width: 42,
  height: 42,
  borderRadius: 21,
  borderWidth: 2.5,
  borderColor: "#e8d0ce", // ← was "#fff", now visible on white bg
},
  avatarFallback: {
    backgroundColor: "rgba(107,75,69,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#6b4b45",
    borderWidth: 2,
    borderColor: "#fff",
  },

  scrollContent: { paddingHorizontal: 20 },

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
    height: 180,
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
    flex: 1,
  },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4a2e2c",
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#7a5a58",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});