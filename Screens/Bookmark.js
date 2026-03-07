import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";
import { useBookmark } from "../context/BookmarkContext";
import { useUser } from "@clerk/clerk-expo";
import { useAuth } from "../context/AuthContext";

export default function Bookmark() {
  const navigation    = useNavigation();
  const { bookmarks, toggleBookmark } = useBookmark();
  const { user: clerkUser } = useUser();
  const { user: authUser }  = useAuth();

  const profilePhoto =
    clerkUser?.imageUrl || clerkUser?.profileImageUrl || authUser?.profilePhoto;

  const BookmarkCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("InformationScreen", { spot: item })}
      activeOpacity={0.85}
    >
      <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />

      <TouchableOpacity
        style={styles.bookmarkButton}
        onPress={() => toggleBookmark(item)}
        activeOpacity={0.8}
      >
        <FontAwesome5 name="bookmark" size={20} solid color="#f4c542" />
      </TouchableOpacity>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.locationContainer}>
          <Feather name="map-pin" size={12} color="#7a5a58" />
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#4a2e2c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Soon to Visit</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileButton}>
              <Feather name="user" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {bookmarks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="bookmark" size={64} color="#d9b8b5" />
            <Text style={styles.emptyText}>No bookmarks yet</Text>
            <Text style={styles.emptySubtext}>
              Start exploring and save your favorite destinations
            </Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {bookmarks.map((item) => (
              <BookmarkCard key={item._id || item.id} item={item} />
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
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6b4b45",
    justifyContent: "center",
    alignItems: "center",
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6b4b45",
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