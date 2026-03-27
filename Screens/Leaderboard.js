import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useProfileImage } from "../context/ProfileImageContext";

const BASE_URL = "https://libotbackend.onrender.com";

export default function Leaderboard() {
  const navigation                    = useNavigation();
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken }                  = useAuth();
  const { profileImage }              = useProfileImage();

  const [allUsers, setAllUsers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);

  const isFetching = useRef(false);

  /* ── Fetch leaderboard ── */
  const buildLeaderboard = async (isRefresh = false) => {
    if (isFetching.current) return;
    isFetching.current = true;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const res   = await fetch(`${BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !ct.includes("application/json")) {
        setError("Could not reach the server.");
        return;
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data.users) ? data.users : null;

      if (!list) { setError("Unexpected response from server."); return; }

      let serverUsers = list.map((u) => ({
        id:          u._id,
        clerkUserId: u.clerkUserId,
        name:
          u.name && u.name !== "User"
            ? u.name
            : `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
              u.email?.split("@")[0] || "User",
        points: typeof u.points === "number" ? u.points : 0,
        avatar: u.profileImage || null,
        isMe:   false,
      }));

      if (clerkUser?.id) {
        const idx = serverUsers.findIndex((u) => u.clerkUserId === clerkUser.id);
        if (idx >= 0) {
          serverUsers[idx] = {
            ...serverUsers[idx],
            // ✅ profileImage from context is the source of truth (Cloudinary URL)
            avatar: profileImage || clerkUser.imageUrl || clerkUser.profileImageUrl || serverUsers[idx].avatar,
            isMe: true,
          };
          await AsyncStorage.setItem("userPoints", String(serverUsers[idx].points)).catch(() => {});
        }
      }

      serverUsers.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      setAllUsers(serverUsers);
    } catch (e) {
      console.warn("Leaderboard error:", e);
      setError("Failed to load leaderboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetching.current = false;
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    buildLeaderboard();
  }, [isLoaded]);

  // ✅ Re-run whenever profileImage changes (e.g. after EditProfile saves)
  useEffect(() => {
    if (!isLoaded) return;
    setAllUsers((prev) =>
      prev.map((u) =>
        u.isMe ? { ...u, avatar: profileImage || u.avatar } : u
      )
    );
  }, [profileImage]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (isLoaded) buildLeaderboard();
    });
    return unsubscribe;
  }, [navigation, isLoaded]);

  /* ── Avatar ── */
  const renderAvatar = (user, size = "normal") => {
    const dim      = size === "winner" ? 85 : size === "small" ? 40 : 70;
    const radius   = dim / 2;
    const iconSize = size === "winner" ? 35 : size === "small" ? 18 : 30;
    const bg       = user.isMe ? "#6b4b45" : "#7a5a58";

    if (user.avatar) {
      return (
        <Image source={{ uri: user.avatar }} style={{ width: dim, height: dim, borderRadius: radius }} />
      );
    }
    return (
      <View style={{ width: dim, height: dim, borderRadius: radius, backgroundColor: bg, justifyContent: "center", alignItems: "center" }}>
        <Feather name="user" size={iconSize} color="#fff" />
      </View>
    );
  };

  /* ── Loading / error / empty ── */
  if (!isLoaded || loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6b4b45" />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-left" size={24} color="#4a2e2c" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => buildLeaderboard()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (allUsers.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-left" size={24} color="#4a2e2c" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptySubtitle}>
            Visit locations to earn points and appear on the leaderboard!
          </Text>
        </View>
      </View>
    );
  }

  /* ── Main render ── */
  const topThree        = allUsers.slice(0, 3);
  const podiumOrder     = [topThree[1], topThree[0], topThree[2]].filter(Boolean);
  const podiumPositions = [2, 1, 3];
  const otherUsers      = allUsers.slice(3);

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#4a2e2c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => buildLeaderboard(true)}
            tintColor="#6b4b45"
            colors={["#6b4b45"]}
          />
        }
      >
        <Text style={styles.totalLabel}>
          {allUsers.length} player{allUsers.length !== 1 ? "s" : ""} ranked
        </Text>

        {/* Top 3 podium */}
        <View style={styles.podiumContainer}>
          {podiumOrder.map((user, index) => {
            if (!user) return null;
            const position = podiumPositions[index];
            const isWinner = position === 1;
            return (
              <View key={user.id} style={[styles.podiumItem, isWinner && styles.winnerItem]}>
                {isWinner && (
                  <View style={styles.crownContainer}>
                    <Text style={styles.crown}>👑</Text>
                  </View>
                )}
                <View style={styles.avatarContainer}>
                  {renderAvatar(user, isWinner ? "winner" : "normal")}
                  {isWinner ? (
                    <View style={styles.winnerBadge}>
                      <Text style={styles.winnerBadgeText}>1</Text>
                    </View>
                  ) : (
                    <View style={[styles.rankBadge, position === 2 ? styles.rank2Badge : styles.rank3Badge]}>
                      <Text style={styles.rankBadgeText}>{position}</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.podiumName, isWinner && styles.winnerName, user.isMe && styles.meName]}
                  numberOfLines={1}
                >
                  {user.name}{user.isMe ? " (You)" : ""}
                </Text>
                <Text style={styles.podiumPts}>{user.points} pts</Text>
              </View>
            );
          })}
        </View>

        {/* Ranked list */}
        {otherUsers.length > 0 && (
          <View style={styles.rankedList}>
            {otherUsers.map((user, index) => (
              <View key={user.id} style={[styles.rankItem, user.isMe && styles.rankItemMe]}>
                <View style={styles.rankLeft}>
                  <Text style={styles.rankNumber}>{index + 4}</Text>
                  <View style={styles.rankAvatarWrap}>
                    {renderAvatar(user, "small")}
                  </View>
                  <Text style={[styles.rankName, user.isMe && styles.meName]} numberOfLines={1}>
                    {user.name}{user.isMe ? " (You)" : ""}
                  </Text>
                </View>
                <Text style={styles.rankPts}>{user.points} pts</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f7cfc9", paddingTop: 50 },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#7a5a58", fontWeight: "500" },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#4a2e2c" },

  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  totalLabel: {
    fontSize: 12,
    color: "#7a5a58",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 20,
  },

  // ── Empty / error ──
  emptyEmoji:    { fontSize: 56, marginBottom: 14 },
  emptyTitle:    { fontSize: 18, fontWeight: "700", color: "#4a2e2c", marginBottom: 6, textAlign: "center" },
  emptySubtitle: { fontSize: 13, color: "#7a5a58", textAlign: "center", lineHeight: 19 },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#6b4b45",
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // ── Podium ──
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: 30,
    gap: 12,
  },
  podiumItem:   { alignItems: "center", flex: 1 },
  winnerItem:   { marginBottom: 18 },
  crownContainer: { marginBottom: 4 },
  crown:        { fontSize: 32 },
  avatarContainer: { position: "relative", marginBottom: 8 },
  winnerBadge: {
    position: "absolute",
    bottom: -5,
    alignSelf: "center",
    backgroundColor: "#f4c542",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: "#f7cfc9",
  },
  winnerBadgeText: { color: "#4a2e2c", fontSize: 14, fontWeight: "800" },
  rankBadge: {
    position: "absolute",
    bottom: -5,
    alignSelf: "center",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#f7cfc9",
  },
  rank2Badge:      { backgroundColor: "#a8a8a8" },
  rank3Badge:      { backgroundColor: "#cd7f32" },
  rankBadgeText:   { color: "#fff", fontSize: 11, fontWeight: "800" },
  podiumName:      { fontSize: 13, fontWeight: "600", color: "#4a2e2c", marginBottom: 2, textAlign: "center" },
  winnerName:      { fontSize: 14, fontWeight: "700" },
  meName:          { color: "#6b4b45" },
  podiumPts:       { fontSize: 11, color: "#7a5a58", fontWeight: "500" },

  // ── Ranked list ──
  rankedList: { marginBottom: 10 },
  rankItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f0e0de",
  },
  rankItemMe: {
    borderColor: "#6b4b45",
    borderWidth: 1.5,
    backgroundColor: "#faf5f4",
  },
  rankLeft:      { flexDirection: "row", alignItems: "center", flex: 1 },
  rankNumber:    { fontSize: 15, fontWeight: "700", color: "#6b4b45", width: 30, textAlign: "center" },
  rankAvatarWrap: { marginRight: 11 },
  rankName:      { fontSize: 15, fontWeight: "500", color: "#4a2e2c", flex: 1 },
  rankPts:       { fontSize: 13, color: "#7a5a58", fontWeight: "600" },
});