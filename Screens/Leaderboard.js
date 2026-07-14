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
import { useTheme } from "../context/ThemeContext";

const BASE_URL      = "https://libotbackend.onrender.com";
const { width: SW } = Dimensions.get("window");

// Podium config — block heights/avatar sizes are layout, not color
const PODIUM = {
  1: { blockH: 110, avatarSz: 76, order: 1 },
  2: { blockH: 85,  avatarSz: 64, order: 0 },
  3: { blockH: 75,  avatarSz: 60, order: 2 },
};

const fmtPts = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

export default function Leaderboard() {
  const navigation                    = useNavigation();
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken }                  = useAuth();
  const { profileImage }              = useProfileImage();
  const { colors, isDark }            = useTheme();

  // Podium block colors — 1st/2nd/3rd get progressively lighter tints of brand.
  // Note: original used fixed hex per rank regardless of theme; these are
  // theme-derived approximations. Adjust if you want distinct tokens per rank.
  const podiumBlockColor = {
    1: colors.brand,
    2: isDark ? "#8a6058" : "#a07870",
    3: isDark ? "#5a4038" : "#c4a49f",
  };

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
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: user.isMe ? colors.brand : podiumBlockColor[2], justifyContent: "center", alignItems: "center" }}>
        <Feather name="user" size={size * 0.4} color={colors.textInverse} />
      </View>
    );
  };

  if (!isLoaded || loading) {
    return (
      <View style={[styles.fullScreen, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading leaderboard…</Text>
      </View>
    );
  }

  const ErrorOrEmpty = ({ emoji, title, sub, retry }) => (
    <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>
      <View style={[styles.hero, { backgroundColor: colors.brand }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.textInverse} />
        </TouchableOpacity>
        <Text style={[styles.heroTitle, { color: colors.textInverse }]}>Leaderboard</Text>
      </View>
      <View style={styles.centered}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>{emoji}</Text>
        <Text style={[styles.emptyTitle, { color: colors.brandDark }]}>{title}</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{sub}</Text>
        {retry && (
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.brand }]} onPress={retry}>
            <Text style={[styles.retryText, { color: colors.textInverse }]}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (error) return <ErrorOrEmpty emoji="⚠️" title="Something went wrong" sub={error} retry={() => buildLeaderboard()} />;
  if (allUsers.length === 0) return <ErrorOrEmpty emoji="🏆" title="No rankings yet" sub="Visit locations to earn points!" />;

  const top3      = allUsers.slice(0, 3);
  const restUsers = allUsers.slice(3);
  const podiumVisual = [top3[1], top3[0], top3[2]];
  const podiumRanks  = [2, 1, 3];

  return (
    <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>

      {/* ─── Hero ─── */}
      <View style={[styles.hero, { backgroundColor: colors.brand }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 16 }).map((_, i) => (
            <View key={i} style={[styles.ray, { transform: [{ rotate: `${i * 22.5}deg` }] }]} />
          ))}
        </View>

        <View style={styles.heroNav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color={colors.textInverse} />
          </TouchableOpacity>
          <Text style={[styles.heroTitle, { color: colors.textInverse }]}>Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.podiumRow}>
          {podiumVisual.map((user, i) => {
            if (!user) return <View key={i} style={{ flex: 1 }} />;
            const rank = podiumRanks[i];
            const cfg  = PODIUM[rank];
            return (
              <View
                key={user.id || i}
                style={[
                  styles.podiumCol,
                  rank === 3 && { marginBottom: 6 },
                ]}>

                {rank === 1 && <Text style={styles.crown}>👑</Text>}

                <View style={[
                  styles.avatarRing,
                  { borderColor: "rgba(255,255,255,0.35)" },
                  rank === 1 && { borderColor: colors.star },
                  user.isMe && { borderColor: colors.textInverse },
                ]}>
                  <Avatar user={user} size={cfg.avatarSz} />
                </View>

                <Text style={[styles.podiumName, { color: colors.textInverse }, user.isMe && { color: colors.textInverse, fontWeight: "800" }]} numberOfLines={1}>
                  {user.name}{user.isMe ? "\n(You)" : ""}
                </Text>

                <Text style={[styles.podiumPts, { color: "rgba(255,255,255,0.7)" }]}>
                  <Feather name="star" size={10} color="rgba(255,255,255,0.7)" />{" "}{fmtPts(user.points)}
                </Text>

                <View style={[styles.podiumBlock, { height: cfg.blockH, backgroundColor: podiumBlockColor[rank] }]}>
                  <Text style={styles.podiumNum}>{rank}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* ─── Card ─── */}
      <View style={[styles.card, { backgroundColor: colors.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => buildLeaderboard(true)}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
        >
          {restUsers.map((user, idx) => (
            <View key={user.id} style={[styles.row, user.isMe && { backgroundColor: colors.card }]}>
              {user.isMe && <View style={[styles.rowAccent, { backgroundColor: colors.brand }]} />}
              <Text style={[styles.rowRank, { color: colors.textSecondary }]}>{idx + 4}</Text>
              <View style={styles.rowAvatarWrap}>
                <Avatar user={user} size={42} />
              </View>
              <Text style={[styles.rowName, { color: colors.textPrimary }, user.isMe && { color: colors.brand, fontWeight: "700" }]} numberOfLines={1}>
                {user.name}{user.isMe ? " (You)" : ""}
              </Text>
              <View style={styles.rowPtsWrap}>
                <Feather name="star" size={13} color={colors.textMuted} />
                <Text style={[styles.rowPts, { color: colors.textSecondary }]}>{fmtPts(user.points)}</Text>
              </View>
            </View>
          ))}

          {restUsers.length === 0 && (
            <Text style={[styles.topThreeOnly, { color: colors.textMuted }]}>Only the top 3 so far! 🎉</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  centered:   { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 },
  loadingText: { marginTop: 12, fontSize: 14 },

  hero: {
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
  heroTitle: { fontSize: 20, fontWeight: "700" },

  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-evenly",
    paddingHorizontal: 16,
  },
  podiumCol: { flex: 1, alignItems: "center" },

  crown: { fontSize: 24, marginBottom: 2 },

  avatarRing: {
    borderRadius: 999,
    borderWidth: 2.5,
    marginBottom: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  podiumName: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
    maxWidth: SW / 3 - 20,
  },
  podiumPts: {
    fontSize: 11,
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

  card: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 20,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  listContent: { paddingBottom: 40 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  rowAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 4,
  },
  rowRank: {
    width: 30,
    fontSize: 15,
    fontWeight: "700",
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
  },
  rowPtsWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowPts:     { fontSize: 13, fontWeight: "600" },

  topThreeOnly: { textAlign: "center", fontSize: 13, marginTop: 20 },

  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  emptySub:   { fontSize: 13, textAlign: "center", lineHeight: 20 },
  retryBtn:   { marginTop: 20, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20 },
  retryText:  { fontWeight: "700", fontSize: 14 },
});