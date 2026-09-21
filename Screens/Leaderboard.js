import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useProfileImage } from "../context/ProfileImageContext";
import { useTheme, radius, shadow, fonts, typography, TAB_BAR_CLEARANCE } from "../context/ThemeContext";
import { BASE_URL } from "../api";
import { avatarImage } from "../utils/image";
import Icon from "../components/Icon";

// Was a hardcoded "https://libotbackend.onrender.com".

// Podium layout (sizes only — colours come from MEDAL / theme below).
const PODIUM = {
  1: { blockH: 96, avatarSz: 78, order: 1 },
  2: { blockH: 68, avatarSz: 62, order: 0 },
  3: { blockH: 52, avatarSz: 58, order: 2 },
};

// Medal palette — gold uses the app's yellow accent; silver / bronze are neutral.
const MEDAL = {
  1: { ring: "#F2CE1B", coin: "#F2CE1B", coinText: "#5E4B00" },
  2: { ring: "#C4D0D2", coin: "#C4D0D2", coinText: "#4B5859" },
  3: { ring: "#E0A66B", coin: "#E0A66B", coinText: "#5E3A17" },
};

// Fixed row height so FlatList.getItemLayout can be exact: 40px avatar +
// 9px padding top/bottom + 1px border each side, plus the 8px gap below.
const ROW_H = 66;

const fmtPts = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export default function Leaderboard() {
  const navigation                    = useNavigation();
  const insets                        = useSafeAreaInsets();
  const { width: SW }                 = useWindowDimensions();
  // The decorative hero blob and the podium name width both scale with the
  // viewport instead of a Dimensions.get() frozen at module import.
  const blob = {
    top: -SW * 0.35, right: -SW * 0.25,
    width: SW * 0.9, height: SW * 0.9, borderRadius: SW * 0.45,
  };
  const podiumNameMax = { maxWidth: SW / 3 - 16 };
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken }                  = useAuth();
  const { profileImage }              = useProfileImage();
  const { colors }                    = useTheme();

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
      return <Image source={{ uri: avatarImage(user.avatar, size) }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: user.isMe ? colors.brand : colors.brandLight,
        justifyContent: "center", alignItems: "center",
      }}>
        <Icon name="user" size={size * 0.42} color={user.isMe ? colors.onBrand : colors.brand} />
      </View>
    );
  };

  const StateScreen = ({ icon, tone, title, sub, retry }) => (
    <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>
      <View style={[styles.hero, { backgroundColor: colors.backgroundHero, paddingTop: insets.top + 8 }]}>
        <View style={styles.heroNav}>
          <TouchableOpacity
            accessibilityRole="button" onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.background }]}>
            <Icon name="chevron-left" size={22} color={colors.brand} />
          </TouchableOpacity>
          <Text style={[styles.heroTitle, { color: colors.brandDark }]}>Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>
      <View style={styles.centered}>
        <View style={[styles.stateBadge, { backgroundColor: tone === "error" ? colors.dangerBg : colors.brandSoft }]}>
          <Icon name={icon} size={26} color={tone === "error" ? colors.danger : colors.brand} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.brandDark }]}>{title}</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{sub}</Text>
        {retry && (
          <TouchableOpacity
            accessibilityRole="button" style={[styles.retryBtn, { backgroundColor: colors.accent }, shadow.sm]} onPress={retry} activeOpacity={0.85}>
            <Text style={[styles.retryText, { color: colors.onAccent }]}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (!isLoaded || loading) {
    return (
      <View style={[styles.fullScreen, styles.centered, { backgroundColor: colors.background }]}>
        <View style={[styles.stateBadge, { backgroundColor: colors.brandSoft }]}>
          <Icon name="award" size={26} color={colors.brand} />
        </View>
        <ActivityIndicator size="small" color={colors.brand} style={{ marginTop: 16 }} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading leaderboard…</Text>
      </View>
    );
  }

  if (error)
    return <StateScreen icon="alert-triangle" tone="error" title="Something went wrong" sub={error} retry={() => buildLeaderboard()} />;
  if (allUsers.length === 0)
    return <StateScreen icon="award" title="No rankings yet" sub="Visit locations around Bulacan to earn points and climb the board." />;

  const renderRow = ({ item: user, index }) => {
    const rank = index + 4;
    return (
      <View
        style={[
          styles.row,
          { borderColor: colors.divider },
          user.isMe && { backgroundColor: colors.brandSoft, borderColor: colors.brand },
        ]}
      >
        <View style={[styles.rankCoin, { backgroundColor: colors.brandSoft }]}>
          <Text style={[styles.rankCoinText, { color: colors.brand }]}>{rank}</Text>
        </View>

        <View style={[styles.rowAvatarWrap, { borderColor: colors.cardBorder }]}>
          <Avatar user={user} size={40} />
        </View>

        <Text
          style={[styles.rowName, { color: colors.textPrimary }, user.isMe && { color: colors.brand, fontFamily: fonts.sansBold }]}
          numberOfLines={1}
        >
          {user.name}{user.isMe ? " · You" : ""}
        </Text>

        <View style={[styles.rowPtsPill, { backgroundColor: colors.background, borderColor: colors.divider }]}>
          <Icon name="star" size={12} color={colors.accent} weight="fill" />
          <Text style={[styles.rowPts, { color: colors.brandDark }]}>{fmtPts(user.points)}</Text>
        </View>
      </View>
    );
  };

  const top3      = allUsers.slice(0, 3);
  const restUsers = allUsers.slice(3);
  const podiumVisual = [top3[1], top3[0], top3[2]];
  const podiumRanks  = [2, 1, 3];

  const myIndex = allUsers.findIndex((u) => u.isMe);
  const myRank  = myIndex >= 0 ? myIndex + 1 : null;
  const showMyRankBar = myRank != null && myRank > 3;

  return (
    <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>

      {/* ─── Hero ─── */}
      <View style={[styles.hero, { backgroundColor: colors.backgroundHero, paddingTop: insets.top + 8 }]}>
        <View style={[styles.heroBlob, blob, { backgroundColor: "rgba(255,255,255,0.22)" }]} pointerEvents="none" />

        <View style={styles.heroNav}>
          <TouchableOpacity
            accessibilityRole="button" onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.background }]} activeOpacity={0.8}>
            <Icon name="chevron-left" size={22} color={colors.brand} />
          </TouchableOpacity>
          <Text style={[styles.heroTitle, { color: colors.brandDark }]}>Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>Top explorers of Bulacan</Text>

        <View style={styles.podiumRow}>
          {podiumVisual.map((user, i) => {
            if (!user) return <View key={i} style={{ flex: 1 }} />;
            const rank  = podiumRanks[i];
            const cfg   = PODIUM[rank];
            const medal = MEDAL[rank];
            return (
              <View key={user.id || i} style={styles.podiumCol}>
                {rank === 1 && <Icon name="star" size={16} color={colors.accent} style={{ marginBottom: 4 }} />}

                <View style={[styles.avatarRing, { borderColor: medal.ring }, user.isMe && { borderColor: colors.brand }]}>
                  <Avatar user={user} size={cfg.avatarSz} />
                  <View style={[styles.medalCoin, { backgroundColor: medal.coin }]}>
                    <Text style={[styles.medalCoinText, { color: medal.coinText }]}>{rank}</Text>
                  </View>
                </View>

                <Text
                  style={[styles.podiumName, podiumNameMax, { color: colors.brandDark }, user.isMe && { fontFamily: fonts.sansBold }]}
                  numberOfLines={1}
                >
                  {user.isMe ? "You" : user.name}
                </Text>

                <View style={[styles.podiumPts, { backgroundColor: colors.background }]}>
                  <Icon name="star" size={10} color={colors.accent} />
                  <Text style={[styles.podiumPtsText, { color: colors.brandDark }]}>{fmtPts(user.points)}</Text>
                </View>

                <View style={[
                  styles.podiumBlock,
                  { height: cfg.blockH, backgroundColor: "rgba(255,255,255,0.42)" },
                ]}>
                  <Text style={[styles.podiumNum, { color: colors.brand }]}>{rank}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* ─── Sheet ─── */}
      <View style={[styles.card, { backgroundColor: colors.background }]}>
        <View style={styles.sheetHeaderRow}>
          <Text style={[styles.sheetTitle, { color: colors.brandDark }]}>All rankings</Text>
          <Text style={[styles.sheetCount, { color: colors.textMuted }]}>{allUsers.length} explorers</Text>
        </View>

        {/* FlatList, not ScrollView + .map — this list is EVERY registered user,
            so it grows with the product. A .map rendered all of them (plus an
            <Avatar> image each) on every render. `getItemLayout` is safe to give
            because every row is a fixed ROW_H, and it lets the list jump
            straight to an offset without measuring. */}
        <FlatList
          data={restUsers}
          keyExtractor={(user) => String(user.id)}
          renderItem={renderRow}
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: (showMyRankBar ? 172 : 116) + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => buildLeaderboard(true)}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          ListEmptyComponent={
            <>
              <View style={[styles.stateBadge, { backgroundColor: colors.brandSoft, alignSelf: "center", marginTop: 24 }]}>
                <Icon name="users" size={22} color={colors.brand} />
              </View>
              <Text style={[styles.topThreeOnly, { color: colors.textMuted }]}>
                Only the top 3 so far — invite friends to explore!
              </Text>
            </>
          }
        />

        {showMyRankBar && (
          <View style={[styles.myRankBar, { backgroundColor: colors.brand, bottom: insets.bottom + 92 }, shadow.lg]}>
            <View style={[styles.myRankCoin, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Text style={[styles.myRankCoinText, { color: colors.onBrand }]}>{myRank}</Text>
            </View>
            <View style={styles.rowAvatarWrap}>
              <Avatar user={allUsers[myIndex]} size={36} />
            </View>
            <Text style={[styles.myRankName, { color: colors.onBrand }]} numberOfLines={1}>
              You
            </Text>
            <View style={styles.rowPtsWrap}>
              <Icon name="star" size={13} color={colors.onBrand} />
              <Text style={[styles.myRankPts, { color: colors.onBrand }]}>{fmtPts(allUsers[myIndex].points)}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  centered:   { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  loadingText: { marginTop: 12, fontSize: 13.5, fontFamily: fonts.sansMedium },

  hero: {
    overflow: "hidden",
    paddingBottom: 0,
  },
  // Sized inline from useWindowDimensions — see `blob` in the component.
  heroBlob: { position: "absolute" },

  heroNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
    ...shadow.sm,
  },
  heroTitle: { fontSize: 20, fontFamily: fonts.sansBold, letterSpacing: -0.3 },
  heroSub:   { fontSize: 12.5, fontFamily: fonts.sansSemi, textAlign: "center", marginTop: 2, marginBottom: 4 },

  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-evenly",
    paddingHorizontal: 14,
    marginTop: 12,
  },
  podiumCol: { flex: 1, alignItems: "center" },

  avatarRing: {
    borderRadius: 999,
    borderWidth: 3,
    padding: 2,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.5)",
    ...shadow.md,
  },
  medalCoin: {
    position: "absolute",
    bottom: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  medalCoinText: { fontSize: 11, fontFamily: fonts.sansBold },

  podiumName: {
    fontSize: 12,
    fontFamily: fonts.sansBold,
    textAlign: "center",
    marginBottom: 5,
  },
  podiumPts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 8,
    ...shadow.sm,
  },
  podiumPtsText: { fontSize: 11.5, fontFamily: fonts.sansBold },

  podiumBlock: {
    width: "82%",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  podiumNum: { fontSize: 26, fontFamily: fonts.sansBold, opacity: 0.6 },

  card: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 18,
    shadowColor: "#0B2E31",
    shadowOpacity: 0.08,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -12 },
    elevation: 12,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontFamily: fonts.sansBold, letterSpacing: -0.3 },
  sheetCount: { fontSize: 12, fontFamily: fonts.sansSemi },

  listContent: { paddingTop: 2 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    // Must stay in sync with ROW_H (height + marginBottom) — getItemLayout
    // above assumes it.
    height: ROW_H - 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rankCoin: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: "center", alignItems: "center",
    marginRight: 10,
  },
  rankCoinText: { fontSize: 13, fontFamily: fonts.sansBold },
  rowAvatarWrap: {
    marginRight: 11,
    borderRadius: 21,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  rowName: { flex: 1, fontSize: 14.5, fontFamily: fonts.sansSemi },
  rowPtsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  rowPtsWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowPts:     { fontSize: 12.5, fontFamily: fonts.sansBold },

  myRankBar: {
    position: "absolute",
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  myRankCoin: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: "center", alignItems: "center",
    marginRight: 10,
  },
  myRankCoinText: { fontSize: 13, fontFamily: fonts.sansBold },
  myRankName: { flex: 1, fontSize: 14.5, fontFamily: fonts.sansBold },
  myRankPts:  { fontSize: 13, fontFamily: fonts.sansBold },

  topThreeOnly: { textAlign: "center", fontSize: 13, marginTop: 12, fontFamily: fonts.sansMedium },

  stateBadge: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: "center", alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 19, fontFamily: fonts.sansBold, letterSpacing: -0.3, marginBottom: 8, textAlign: "center" },
  emptySub:   { fontSize: 13, textAlign: "center", lineHeight: 20 },
  retryBtn:   { marginTop: 20, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999 },
  retryText:  { fontFamily: fonts.sansBold, fontSize: 13.5 },
});
