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
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useProfileImage } from "../context/ProfileImageContext";

const BASE_URL      = "https://libotbackend.onrender.com";
const { width: SW } = Dimensions.get("window");

// Podium config
const PODIUM = {
  1: { blockH: 100, avatarSz: 72, blockColor: "#c87965", order: 1 },
  2: { blockH: 72,  avatarSz: 58, blockColor: "#a07870", order: 0 },
  3: { blockH: 56,  avatarSz: 54, blockColor: "#c4a49f", order: 2 },
};

const fmtPts = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

export default function Leaderboard() {
  const navigation                    = useNavigation();
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken }                  = useAuth();
  const { profileImage }              = useProfileImage();

  const [allUsers, setAllUsers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const isFetching                  = useRef(false);

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
      if (!res.ok || !ct.includes("application/json")) { setError("Could not reach the server."); return; }

      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data.users) ? data.users : null;
      if (!list) { setError("Unexpected response."); return; }

      let users = list.map((u) => ({
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
        const idx = users.findIndex((u) => u.clerkUserId === clerkUser.id);
        if (idx >= 0) {
          users[idx] = {
            ...users[idx],
            avatar: profileImage || clerkUser.imageUrl || clerkUser.profileImageUrl || users[idx].avatar,
            isMe: true,
          };
          AsyncStorage.setItem("userPoints", String(users[idx].points)).catch(() => {});
        }
      }

      users.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      setAllUsers(users);
    } catch (e) {
      console.warn("Leaderboard error:", e);
      setError("Failed to load leaderboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetching.current = false;
    }
  };

  useEffect(() => { if (!isLoaded) return; buildLeaderboard(); }, [isLoaded]);
  useEffect(() => {
    if (!isLoaded) return;
    setAllUsers((prev) => prev.map((u) => u.isMe ? { ...u, avatar: profileImage || u.avatar } : u));
  }, [profileImage]);
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => { if (isLoaded) buildLeaderboard(); });
    return unsub;
  }, [navigation, isLoaded]);

  const Avatar = ({ user, size }) => {
    if (user.avatar)
      return <Image source={{ uri: user.avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: user.isMe ? "#6b4b45" : "#a07870", justifyContent: "center", alignItems: "center" }}>
        <Feather name="user" size={size * 0.4} color="#fff" />
      </View>
    );
  };

  if (!isLoaded || loading) {
    return (
      <View style={[styles.fullScreen, styles.centered]}>
        <ActivityIndicator size="large" color="#6b4b45" />
        <Text style={styles.loadingText}>Loading leaderboard…</Text>
      </View>
    );
  }

  const ErrorOrEmpty = ({ emoji, title, sub, retry }) => (
    <View style={styles.fullScreen}>
      <View style={styles.hero}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>Leaderboard</Text>
      </View>
      <View style={styles.centered}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>{emoji}</Text>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySub}>{sub}</Text>
        {retry && (
          <TouchableOpacity style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (error) return <ErrorOrEmpty emoji="⚠️" title="Something went wrong" sub={error} retry={() => buildLeaderboard()} />;
  if (allUsers.length === 0) return <ErrorOrEmpty emoji="🏆" title="No rankings yet" sub="Visit locations to earn points!" />;

  // podium: visual order is [2nd, 1st, 3rd]
  const top3      = allUsers.slice(0, 3);
  const restUsers = allUsers.slice(3);
  const podiumVisual = [top3[1], top3[0], top3[2]]; // left=2nd, center=1st, right=3rd
  const podiumRanks  = [2, 1, 3];

  return (
    <View style={styles.fullScreen}>

      {/* ─── Hero ─── */}
      <View style={styles.hero}>
        {/* Sunburst rays */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 16 }).map((_, i) => (
            <View key={i} style={[styles.ray, { transform: [{ rotate: `${i * 22.5}deg` }] }]} />
          ))}
        </View>

        {/* Nav */}
        <View style={styles.heroNav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Podium */}
        <View style={styles.podiumRow}>
          {podiumVisual.map((user, i) => {
            if (!user) return <View key={i} style={{ flex: 1 }} />;
            const rank = podiumRanks[i];
            const cfg  = PODIUM[rank];
            return (
              <View key={user.id} style={styles.podiumCol}>

                {/* Crown above 1st */}
                {rank === 1 && <Text style={styles.crown}>👑</Text>}

                {/* Floating avatar */}
                <View style={[
                  styles.avatarRing,
                  rank === 1 && styles.avatarRingGold,
                  user.isMe && styles.avatarRingMe,
                ]}>
                  <Avatar user={user} size={cfg.avatarSz} />
                </View>

                {/* Name */}
                <Text style={[styles.podiumName, user.isMe && styles.meColor]} numberOfLines={1}>
                  {user.name}{user.isMe ? "\n(You)" : ""}
                </Text>

                {/* Pts */}
                <Text style={styles.podiumPts}>
                  <Feather name="thumbs-up" size={10} color="rgba(255,255,255,0.7)" />{" "}{fmtPts(user.points)}
                </Text>

                {/* Block */}
                <View style={[styles.podiumBlock, { height: cfg.blockH, backgroundColor: cfg.blockColor }]}>
                  <Text style={styles.podiumNum}>{rank}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* ─── White card ─── */}
      <View style={styles.card}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => buildLeaderboard(true)}
              tintColor="#6b4b45"
              colors={["#6b4b45"]}
            />
          }
        >
          {restUsers.map((user, idx) => (
            <View key={user.id} style={[styles.row, user.isMe && styles.rowMe]}>
              {user.isMe && <View style={styles.rowAccent} />}
              <Text style={styles.rowRank}>{idx + 4}</Text>
              <View style={styles.rowAvatarWrap}>
                <Avatar user={user} size={42} />
              </View>
              <Text style={[styles.rowName, user.isMe && styles.meColor]} numberOfLines={1}>
                {user.name}{user.isMe ? " (You)" : ""}
              </Text>
              <View style={styles.rowPtsWrap}>
                <Feather name="thumbs-up" size={13} color="#b0908c" />
                <Text style={styles.rowPts}>{fmtPts(user.points)}</Text>
              </View>
            </View>
          ))}

          {restUsers.length === 0 && (
            <Text style={styles.topThreeOnly}>Only the top 3 so far! 🎉</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const HERO_BG = "#8B5E58";

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: "#fff" },
  centered:   { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#7a5a58" },

  // ── Hero ──
  hero: {
    backgroundColor: HERO_BG,
    overflow: "hidden",
    paddingBottom: 0,
  },

  ray: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    width: SW * 2,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  heroNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 20,
  },
  backBtn:   { width: 40, height: 40, justifyContent: "center" },
  heroTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },

  // ── Podium ──
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    gap: 6,
  },
  podiumCol: { flex: 1, alignItems: "center" },

  crown: { fontSize: 24, marginBottom: 2 },

  avatarRing: {
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.35)",
    marginBottom: 6,
    // small shadow
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  avatarRingGold: { borderColor: "#f4d490" },
  avatarRingMe:   { borderColor: "#fff" },

  podiumName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 2,
    maxWidth: SW / 3 - 20,
  },
  podiumPts: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 6,
  },

  podiumBlock: {
    width: "100%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  podiumNum: {
    fontSize: 28,
    fontWeight: "800",
    color: "rgba(255,255,255,0.9)",
  },

  // ── White card ──
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,         // overlaps the hero bottom
    paddingTop: 20,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  listContent: { paddingBottom: 40 },

  // ── Rows ──
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  rowMe: {
    backgroundColor: "#faf5f4",
  },
  rowAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#6b4b45",
    borderRadius: 4,
  },
  rowRank: {
    width: 30,
    fontSize: 15,
    fontWeight: "700",
    color: "#7a5a58",
    textAlign: "center",
  },
  rowAvatarWrap: {
    marginRight: 12,
    borderRadius: 21,
    overflow: "hidden",
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#4a2e2c",
  },
  meColor: { color: "#6b4b45", fontWeight: "700" },
  rowPtsWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowPts:     { fontSize: 13, color: "#7a5a58", fontWeight: "600" },

  topThreeOnly: { textAlign: "center", color: "#a07870", fontSize: 13, marginTop: 20 },

  // ── Empty/error ──
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#4a2e2c", marginBottom: 6, textAlign: "center" },
  emptySub:   { fontSize: 13, color: "#7a5a58", textAlign: "center", lineHeight: 20 },
  retryBtn:   { marginTop: 20, backgroundColor: "#6b4b45", paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20 },
  retryText:  { color: "#fff", fontWeight: "700", fontSize: 14 },
});