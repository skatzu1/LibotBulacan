import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";
import { useBookmark } from "../context/BookmarkContext";
import { useUser } from "@clerk/clerk-expo";
import { useAuth } from "../context/AuthContext";
import { useProfileImage } from "../context/ProfileImageContext";
import { useTheme } from "../context/ThemeContext";

export default function Bookmark() {
  const navigation = useNavigation();
  const { bookmarks, toggleBookmark, loading } = useBookmark();
  const { user: clerkUser } = useUser();
  const { user: authUser }  = useAuth();
  const { profileImage }    = useProfileImage();
  const { colors, isDark }  = useTheme();
  const profilePhoto = profileImage;

  const bookmarkedSpots = useMemo(() => {
    return bookmarks.map(bookmark => {
      if (typeof bookmark.spotId === "object" && bookmark.spotId?._id) return bookmark.spotId;
      console.warn("Bookmark spotId not populated:", bookmark);
      return null;
    }).filter(Boolean);
  }, [bookmarks]);

  const BookmarkCard = ({ item }) => {
    if (!item || !item._id) return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.cardImage}><ActivityIndicator size="large" color={colors.brand} /></View>
        <View style={styles.cardContent}><Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Loading...</Text></View>
      </View>
    );
    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={() => navigation.navigate("InformationScreen", { spot: item })} activeOpacity={0.85}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: colors.backgroundHero ?? "#e8d0ce", justifyContent:"center", alignItems:"center" }]}>
            <Feather name="image" size={40} color={colors.textMuted} />
          </View>
        )}
        <TouchableOpacity style={styles.bookmarkButton} onPress={() => toggleBookmark(item)} activeOpacity={0.8}>
          <FontAwesome5 name="bookmark" size={20} solid color="#f4c542" />
        </TouchableOpacity>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: colors.brandDark }]} numberOfLines={2}>{item.name || "Unknown Spot"}</Text>
          {item.location && (
            <View style={styles.locationContainer}>
              <Feather name="map-pin" size={12} color={colors.brand} />
              <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>{item.location}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={26} color={colors.brandDark} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.brandDark }]}>Soon to Visit</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.avatarWrap}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={[styles.avatar, { borderColor: colors.cardBorder ?? "#e8d0ce" }]} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.brand }]}>
              <Feather name="user" size={18} color="#fff" />
            </View>
          )}
          <View style={[styles.onlineDot, { backgroundColor: colors.brand, borderColor: colors.background }]} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading && bookmarks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={[styles.emptyText, { color: colors.brandDark }]}>Loading bookmarks...</Text>
          </View>
        ) : bookmarkedSpots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="bookmark" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.brandDark }]}>No bookmarks yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Start exploring and save your favorite destinations</Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {bookmarkedSpots.map((spot) => <BookmarkCard key={spot._id || spot.id} item={spot} />)}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, paddingTop: 50 },
  header:         { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:20, marginBottom:20 },
  backButton:     { width:40, height:40, justifyContent:"center", alignItems:"flex-start" },
  headerTitle:    { fontSize:20, fontWeight:"700" },
  avatarWrap:     { position:"relative" },
  avatar:         { width:42, height:42, borderRadius:21, borderWidth:2.5 },
  avatarFallback: { justifyContent:"center", alignItems:"center" },
  onlineDot:      { position:"absolute", bottom:1, right:1, width:11, height:11, borderRadius:6, borderWidth:2 },
  scrollContent:  { paddingHorizontal:20 },
  cardsContainer: { gap:14 },
  card:           { borderRadius:16, overflow:"hidden", shadowColor:"#4a2e2c", shadowOffset:{width:0,height:2}, shadowOpacity:0.08, shadowRadius:6, elevation:3, position:"relative" },
  cardImage:      { width:"100%", height:180 },
  bookmarkButton: { position:"absolute", top:12, right:12, width:36, height:36, borderRadius:18, backgroundColor:"rgba(0,0,0,0.35)", justifyContent:"center", alignItems:"center", zIndex:10 },
  cardContent:    { padding:14 },
  cardTitle:      { fontSize:17, fontWeight:"700", marginBottom:6 },
  locationContainer: { flexDirection:"row", alignItems:"center", gap:5 },
  locationText:   { fontSize:13, flex:1 },
  emptyContainer: { flex:1, justifyContent:"center", alignItems:"center", paddingVertical:80 },
  emptyText:      { fontSize:20, fontWeight:"700", marginTop:20, marginBottom:8 },
  emptySubtext:   { fontSize:14, textAlign:"center", paddingHorizontal:40 },
});