import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  useWindowDimensions,
  AppState,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { useProfileImage } from "../context/ProfileImageContext";
import { useTheme, radius, shadow, fonts, typography, MAX_FONT_SCALE } from "../context/ThemeContext";
import { Avatar, EmptyState, ErrorState, LoadingState, H_PAD, TAP } from "../components/ui";
import { showToast } from "../components/AppAlert";
import { BASE_URL } from "../api";
import { clerkPhoto } from "../utils/image";
import Icon from "../components/Icon";
import TitleChip from "../components/TitleChip";
import { titleName } from "../utils/titles";
import { subscribeLive } from "../utils/live";

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

// Each podium step is a place: the middle step is 1, the left 2, the right 3.
// Travelers with the same points share a place, so they stand together on its
// step instead of on separate steps that all say 1 (2026-10-20). A place that
// a tie skips stays empty, as at a medal ceremony: 1, 1, 3 has no silver. A
// step shows up to PODIUM_FACES faces; the rest of a bigger tie is counted as
// "+N" there and stays in the list below, with the same rank.
const PODIUM_FACES = 3;
const PLACES_LEFT_TO_RIGHT = [2, 1, 3];
// avatarRing's 3px border and 2px padding, both sides.
const FACE_RING = 10;
// How far along each face on a shared step sits from the one before it, as a
// share of a face's width (the rest is the overlap).
const FACE_STEP = 0.55;

export const podiumSteps = (users) => {
  const steps = {};
  for (const place of PLACES_LEFT_TO_RIGHT) {
    const tied = users.filter((u) => u.rank === place);
    if (!tied.length) continue;
    // You first, so you're never one of the faces a big tie leaves off.
    const all = [...tied.filter((u) => u.isMe), ...tied.filter((u) => !u.isMe)];
    steps[place] = { all, shown: all.slice(0, PODIUM_FACES) };
  }
  return steps;
};

const firstName = (u) => (u.isMe ? "You" : u.name.split(/\s+/)[0]);

// One traveler: the full name. A tie: first names, "Ana & Ben", "Ana, Ben &
// Cy", or "Ana, Ben, Cy +2" when not everyone fits on the step.
const stepNames = ({ all, shown }) => {
  if (all.length === 1) return shown[0].isMe ? "You" : shown[0].name;
  const names = shown.map(firstName);
  const more  = all.length - shown.length;
  if (more) return `${names.join(", ")} +${more}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
};

// Fixed row height so FlatList.getItemLayout can be exact: 40px avatar +
// 9px padding top/bottom + 1px border each side, plus the 8px gap below.
const ROW_H = 66;

const fmtPts = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

// The board comes a page at a time (the thesis panel, 2026-10-21: pagination),
// and your own standing is pinned first, above the rankings, on every page:
// the server sends it as `me`, with the page it is on. It used to be the top 50
// in one list, with your rank in a bar at the bottom.
export const PAGE_SIZE = 20;

/**
 * The page buttons to show: the first, the last, and the ones either side of
 * the current page, with "…" for the gaps. [1, "…", 4, 5, 6, "…", 12]
 */
export function pageButtons(page, pages) {
  if (pages <= 1) return [];
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const out = [];
  let last = 0;
  for (const p of [...keep].sort((a, b) => a - b)) {
    if (p - last === 2) out.push(last + 1);
    else if (p - last > 2) out.push("…");
    out.push(p);
    last = p;
  }
  return out;
}

// While it is on screen and the app is in front, the board refreshes the
// moment someone's points change (utils/live.js), and this often besides, for
// when the live connection is down (the specification asks for a leaderboard
// that updates in real time).
const LIVE_REFRESH_MS = 30 * 1000;

// The server ranks travelers by points, then distinct spots visited
// (LibotBackend utils/leaderboard.js); the board keeps its order and shows
// both, points first. Equal points share a rank: 1, 2, 2, 4 (QA 2026-10-16,
// "same points, same standing"). The server sends each `rank`; withRanks
// works it out here too, for a server from before it did.
const withRanks = (list) => {
  let rank = 0;
  let lastPoints = null;
  return list.map((u, i) => {
    if (u.points !== lastPoints) { rank = i + 1; lastPoints = u.points; }
    return { ...u, rank: u.rank ?? rank };
  });
};

const toEntry = (u) => ({
  rank:    typeof u.rank === "number" ? u.rank : undefined,
  id:          u._id,
  clerkUserId: u.clerkUserId,
  name:
    u.name && u.name !== "User"
      ? u.name
      : `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
        u.email?.split("@")[0] || "User",
  points:  typeof u.points === "number" ? u.points : 0,
  visited: typeof u.spotsVisited === "number" ? u.spotsVisited : 0,
  avatar:  u.profileImage || null,
  // The title they show (utils/titles.js: a town's, a district's or The GOAT
  // Traveler); null without one, or for one the app doesn't know.
  title:   titleName(u.title) ? u.title : null,
  isMe:    false,
});

const spotsLabel = (n) => `${n} ${n === 1 ? "spot" : "spots"}`;
const ptsLabel   = (n) => `${fmtPts(n)} pts`;

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
  // Faces on a shared step shrink so the row fits the step's width, keeping
  // first place's faces the largest, as they are when it stands alone.
  const faceSize = (place, faces) => {
    const own = PODIUM[place].avatarSz;
    if (faces === 1) return own;
    const fits = podiumNameMax.maxWidth / (1 + FACE_STEP * (faces - 1)) - FACE_RING;
    return Math.floor(Math.min(own, (fits * own) / PODIUM[1].avatarSz));
  };
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken }                  = useAuth();
  const { profileImage, loading: photoLoading } = useProfileImage();
  const { colors }                    = useTheme();

  const [allUsers, setAllUsers]     = useState([]); // this page's travelers
  // You, wherever you are on the board: your entry, `rank` and `page`.
  const [me, setMe]                 = useState(null);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [pages, setPages]           = useState(1);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging]         = useState(false);
  const [error, setError]           = useState(null);
  const isFetching                  = useRef(false);
  const hasLoaded                   = useRef(false);
  // The page on screen, for the focus reload and the live refresh.
  const pageRef                     = useRef(1);
  const listRef                     = useRef(null);

  // Only the FIRST load shows the loading state. This is a tab, so the focus
  // listener below fires on every switch back to it — each of those used to
  // blank the whole board behind a spinner. Later loads refresh in place.
  // `toPage` opens another page; without it, the one on screen reloads.
  const buildLeaderboard = async (isRefresh = false, toPage = null) => {
    if (isFetching.current) return;
    isFetching.current = true;
    if (isRefresh) setRefreshing(true);
    else if (!hasLoaded.current) setLoading(true);
    else if (toPage) setPaging(true);
    setError(null);
    const want = toPage || pageRef.current;

    // A board already on screen stays when a later load fails. The focus
    // reload and the live refresh used to swap it for the full-screen error
    // whenever one request was slow, so on a weak signal the board kept
    // vanishing. Only a pull, which the user asked for, says it didn't work.
    const fail = (message) => {
      if (!hasLoaded.current) setError(message);
      else if (isRefresh || toPage) showToast("Couldn't load the leaderboard. Check your connection.", { type: "error" });
    };

    try {
      const token = await getToken();
      const res   = await fetch(`${BASE_URL}/api/users?page=${want}&limit=${PAGE_SIZE}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !ct.includes("application/json")) { fail("Could not reach the server."); return; }

      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data.users) ? data.users : null;
      if (!list) { fail("Unexpected response."); return; }

      // A server from before pages answers with page 1 only.
      const onPage = typeof data.page === "number" ? data.page : 1;
      const users = withRanks(list.map(toEntry)).map((u) => (u.clerkUserId === clerkUser?.id ? { ...u, isMe: true } : u));
      const mine = data.me
        ? { ...toEntry(data.me), isMe: true, rank: data.me.rank, page: data.me.page ?? null }
        : (() => {
          const i = users.findIndex((u) => u.isMe);
          return i >= 0 ? { ...users[i], page: onPage } : null;
        })();
      if (mine) AsyncStorage.setItem("userPoints", String(mine.points)).catch(() => {});

      // No re-sort here: the server's order is the ranking.
      setAllUsers(users);
      setMe(mine);
      setTotal(typeof data.total === "number" ? data.total : users.length);
      setPage(onPage);
      setPages(typeof data.pages === "number" ? data.pages : 1);
      if (onPage !== pageRef.current) listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
      pageRef.current = onPage;
      hasLoaded.current = true;
    } catch (e) {
      console.warn("Leaderboard error:", e);
      fail("Failed to load leaderboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setPaging(false);
      isFetching.current = false;
    }
  };
  const goToPage = (p) => { if (p !== page && p >= 1 && p <= pages) buildLeaderboard(false, p); };

  useEffect(() => { if (!isLoaded) return; buildLeaderboard(); }, [isLoaded]);
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => { if (isLoaded) buildLeaderboard(); });
    return unsub;
  }, [navigation, isLoaded]);

  // Live refresh while this screen is focused. Through a ref, so the timer
  // always calls this render's buildLeaderboard rather than the first one.
  const buildRef = useRef(buildLeaderboard);
  buildRef.current = buildLeaderboard;
  useFocusEffect(
    useCallback(() => {
      if (!isLoaded) return undefined;
      const id = setInterval(() => {
        if (AppState.currentState === "active") buildRef.current();
      }, LIVE_REFRESH_MS);
      const stopLive = subscribeLive(["progress"], () => buildRef.current());
      return () => {
        clearInterval(id);
        stopLive();
      };
    }, [isLoaded])
  );

  // Your own photo is read here, at render, from the phone's copy — Edit
  // Profile updates it the moment you save. It used to be baked into allUsers
  // when the board loaded, and the focus listener's buildLeaderboard still held
  // the photo from when it was registered, so a removed photo came back on
  // every visit. The board's copy only stands in until the phone's has loaded.
  const myPhoto  = profileImage || clerkPhoto(clerkUser);
  const avatarOf = (user) =>
    user.isMe ? myPhoto || (photoLoading ? user.avatar : null) : user.avatar;

  // Plain render helpers, not components: a component declared inside render is
  // a new type every render, so React remounted every avatar (and re-fetched
  // its image) on each update.
  const personAvatar = (user, size) => (
    <Avatar uri={avatarOf(user)} name={user.name} size={size} strong={user.isMe} />
  );

  // The hero's top bar. Loading, error and empty states render it too — the
  // loading state used to replace the whole screen, back button included.
  const heroNav = (
    <View style={styles.heroNav}>
      {navigation.canGoBack() ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: colors.background }]}
          activeOpacity={0.8}
        >
          <Icon name="chevron-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backBtn} />
      )}
      <Text
        style={[styles.heroTitle, { color: colors.textPrimary }]}
        accessibilityRole="header"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      >
        Leaderboard
      </Text>
      <View style={styles.backBtn} />
    </View>
  );

  const stateScreen = (children) => (
    <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>
      <View style={[styles.hero, styles.heroStateOnly, { backgroundColor: colors.backgroundHero, paddingTop: insets.top + 8 }]}>
        {heroNav}
      </View>
      <View style={styles.stateBody}>{children}</View>
    </View>
  );

  if (!isLoaded || loading) {
    return stateScreen(<LoadingState label="Loading leaderboard…" />);
  }

  if (error) {
    return stateScreen(<ErrorState text={error} onRetry={() => buildLeaderboard()} />);
  }
  if (allUsers.length === 0) {
    return stateScreen(
      <EmptyState
        icon="award"
        title="No rankings yet"
        text="Visit places around Bulacan to earn points and climb the board."
      />
    );
  }

  // How many on the board share this rank: "Tied" shows when it's more than one.
  const tiedAt = (rank) => allUsers.filter((u) => u.rank === rank).length > 1;

  const renderRow = ({ item: user }) => {
    const rank = user.rank;
    const tied = tiedAt(rank);
    return (
      <View
        style={[
          styles.row,
          { borderColor: colors.divider },
          user.isMe && { backgroundColor: colors.brandSoft, borderColor: colors.brand },
        ]}
        accessible
        accessibilityLabel={`Rank ${rank}${tied ? ", tied" : ""}, ${user.isMe ? "you" : user.name}, ${user.points} points, ${spotsLabel(user.visited)} visited${user.title ? `, ${titleName(user.title)}` : ""}`}
      >
        <View style={[styles.rankCoin, { backgroundColor: colors.brandSoft }]}>
          <Text style={[styles.rankCoinText, { color: colors.brand }]}>{rank}</Text>
        </View>

        <View style={[styles.rowAvatarWrap, { borderColor: colors.cardBorder }]}>
          {personAvatar(user, 40)}
        </View>

        <View style={styles.rowNameCol}>
          <Text
            style={[styles.rowName, { color: colors.textPrimary }, user.isMe && { color: colors.brand, fontFamily: fonts.sansBold }]}
            numberOfLines={1}
          >
            {user.name}{user.isMe ? " · You" : ""}
          </Text>
          <View style={styles.rowSubLine}>
            {user.title && <TitleChip title={user.title} size="sm" />}
            {/* "visited" goes when a title takes the room. */}
            <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
              {spotsLabel(user.visited)}{user.title ? "" : " visited"}{tied ? " · Tied" : ""}
            </Text>
          </View>
        </View>

        {/* Points, with the sparkle the points pill on Home uses. */}
        <View style={[styles.rowPtsPill, { backgroundColor: colors.background, borderColor: colors.divider }]}>
          <Icon name="stars" size={12} color={colors.brand} weight="fill" />
          <Text style={[styles.rowPts, { color: colors.brandDark }]}>{ptsLabel(user.points)}</Text>
        </View>
      </View>
    );
  };

  // The podium is the top of the board, so only page 1 has it.
  const steps     = page === 1 ? podiumSteps(allUsers) : {};
  const onPodium  = new Set(Object.values(steps).flatMap((step) => step.shown));
  const restUsers = allUsers.filter((u) => !onPodium.has(u));
  const firstRank = (page - 1) * PAGE_SIZE + 1;
  const lastRank  = Math.min(page * PAGE_SIZE, total || allUsers.length);

  // You, first: your standing, pinned above the rankings on every page (the
  // thesis panel, 2026-10-21). Tapping it opens the page you're on.
  const meOnOtherPage = !!me?.page && me.page !== page;
  const youCard = me && (
    <TouchableOpacity
      activeOpacity={meOnOtherPage ? 0.85 : 1}
      disabled={!meOnOtherPage || paging}
      onPress={() => goToPage(me.page)}
      style={[styles.youCard, { backgroundColor: colors.card, borderColor: colors.brand }, shadow.md]}
      accessibilityRole={meOnOtherPage ? "button" : undefined}
      accessibilityLabel={
        `Your standing: rank ${me.rank} of ${total}, ${me.points} points, ${spotsLabel(me.visited)} visited` +
        `${me.title ? `, ${titleName(me.title)}` : ""}${meOnOtherPage ? `. Opens page ${me.page}` : ""}`
      }
    >
      <View style={styles.youRankCol}>
        <Text style={[styles.youEyebrow, { color: colors.brand }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>YOU</Text>
        <Text style={[styles.youRank, { color: colors.textPrimary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>#{me.rank}</Text>
        <Text style={[styles.youOf, { color: colors.textMuted }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>of {total}</Text>
      </View>
      <View style={[styles.youDivider, { backgroundColor: colors.divider }]} />
      <View style={[styles.rowAvatarWrap, { borderColor: colors.brand }]}>{personAvatar(me, 44)}</View>
      <View style={styles.youInfo}>
        <Text style={[styles.youName, { color: colors.textPrimary }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{me.name}</Text>
        {me.title ? <TitleChip title={me.title} size="sm" style={styles.youChip} /> : null}
        <Text style={[styles.youStats, { color: colors.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {ptsLabel(me.points)} · {spotsLabel(me.visited)}
        </Text>
      </View>
      {meOnOtherPage ? (
        <View style={[styles.youGo, { backgroundColor: colors.brand }]}>
          <Text style={[styles.youGoText, { color: colors.onBrand }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>Page {me.page}</Text>
          <Icon name="chevron-right" size={14} color={colors.onBrand} />
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const pager = pages > 1 && (
    <View style={styles.pager} accessibilityRole="toolbar" accessibilityLabel={`Page ${page} of ${pages}`}>
      <TouchableOpacity
        onPress={() => goToPage(page - 1)}
        disabled={page <= 1 || paging}
        style={[styles.pageBtn, { borderColor: colors.divider, opacity: page <= 1 ? 0.4 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
      >
        <Icon name="chevron-left" size={18} color={colors.textPrimary} />
      </TouchableOpacity>
      {pageButtons(page, pages).map((p, i) => (p === "…" ? (
        <Text key={`gap${i}`} style={[styles.pageGap, { color: colors.textMuted }]}>…</Text>
      ) : (
        <TouchableOpacity
          key={p}
          onPress={() => goToPage(p)}
          disabled={paging}
          style={[
            styles.pageBtn,
            { borderColor: colors.divider },
            p === page && { backgroundColor: colors.brand, borderColor: colors.brand },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: p === page }}
          accessibilityLabel={`Page ${p}${me?.page === p ? ", your page" : ""}`}
        >
          <Text style={[styles.pageNum, { color: p === page ? colors.onBrand : colors.textPrimary }]}>{p}</Text>
          {me?.page === p && p !== page && <View style={[styles.pageMeDot, { backgroundColor: colors.brand }]} />}
        </TouchableOpacity>
      )))}
      <TouchableOpacity
        onPress={() => goToPage(page + 1)}
        disabled={page >= pages || paging}
        style={[styles.pageBtn, { borderColor: colors.divider, opacity: page >= pages ? 0.4 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Next page"
      >
        <Icon name="chevron-right" size={18} color={colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>

      {/* ─── Hero ─── */}
      <View style={[styles.hero, page !== 1 && styles.heroShort, { backgroundColor: colors.backgroundHero, paddingTop: insets.top + 8 }]}>
        <View style={[styles.heroBlob, blob, { backgroundColor: "rgba(255,255,255,0.22)" }]} pointerEvents="none" />

        {heroNav}

        {youCard}

        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
          {page === 1 ? "Top explorers of Bulacan, by points" : `Ranks ${firstRank}–${lastRank} of ${total}`}
        </Text>

        {page === 1 && <View style={styles.podiumRow}>
          {PLACES_LEFT_TO_RIGHT.map((place) => {
            const step = steps[place];
            if (!step) return <View key={place} style={{ flex: 1 }} />;
            const { all, shown } = step;
            const cfg   = PODIUM[place];
            const medal = MEDAL[place];
            const size  = faceSize(place, shown.length);
            const lead  = shown[0];
            const more  = all.length - shown.length;
            const label = all.length === 1
              ? `Rank ${place}, ${lead.points} points, ${spotsLabel(lead.visited)} visited`
              : `Rank ${place}, tied: ${shown.map((u) => (u.isMe ? "you" : u.name)).join(", ")}` +
                `${more ? `, and ${more} more listed below` : ""}, ${lead.points} points each`;
            return (
              <View key={place} style={styles.podiumCol}>
                {place === 1 && <Icon name="star" size={16} color={colors.accent} style={{ marginBottom: 4 }} />}

                <View style={styles.podiumFaces}>
                  {shown.map((user, j) => (
                    <View
                      key={user.id || j}
                      style={[
                        styles.avatarRing,
                        { borderColor: user.isMe ? colors.brand : medal.ring },
                        j > 0 && { marginLeft: -(size + FACE_RING) * (1 - FACE_STEP) },
                      ]}
                    >
                      {personAvatar(user, size)}
                      {j === shown.length - 1 && (
                        <View style={[styles.medalCoin, { backgroundColor: medal.coin }]}>
                          <Text style={[styles.medalCoinText, { color: medal.coinText }]}>{place}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>

                <Text
                  style={[styles.podiumName, podiumNameMax, { color: colors.brandDark }, lead.isMe && { fontFamily: fonts.sansBold }]}
                  numberOfLines={all.length > 1 ? 2 : 1}
                >
                  {stepNames(step)}
                </Text>

                <View
                  style={[styles.podiumPts, { backgroundColor: colors.background }]}
                  accessible
                  accessibilityLabel={label}
                >
                  <Icon name="stars" size={10} color={colors.brand} weight="fill" />
                  <Text style={[styles.podiumPtsText, { color: colors.brandDark }]}>{ptsLabel(lead.points)}</Text>
                </View>

                <View style={[
                  styles.podiumBlock,
                  { height: cfg.blockH, backgroundColor: "rgba(255,255,255,0.42)" },
                ]}>
                  <Text style={[styles.podiumNum, { color: colors.brand }]}>{place}</Text>
                </View>
              </View>
            );
          })}
        </View>}
      </View>

      {/* ─── Sheet ─── */}
      <View style={[styles.card, { backgroundColor: colors.background }]}>
        <View style={styles.sheetHeaderRow}>
          <Text style={[styles.sheetTitle, { color: colors.brandDark }]}>Rankings</Text>
          <Text style={[styles.sheetCount, { color: colors.textMuted }]}>
            {pages > 1 ? `Page ${page} of ${pages} · ` : ""}{total || allUsers.length} explorers
          </Text>
        </View>

        {/* FlatList, not ScrollView + .map — one page of PAGE_SIZE. `getItemLayout`
            is safe to give because every row is a fixed ROW_H, and it lets the
            list jump straight to an offset without measuring. */}
        <FlatList
          ref={listRef}
          style={paging && styles.paging}
          data={restUsers}
          keyExtractor={(user) => String(user.id)}
          renderItem={renderRow}
          extraData={myPhoto}
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: 116 + insets.bottom }]}
          ListFooterComponent={pager || null}
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
                Everyone's on the podium so far — invite friends to explore!
              </Text>
            </>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },

  hero: {
    overflow: "hidden",
    paddingBottom: 0,
  },
  heroStateOnly: { paddingBottom: 14 },
  heroShort:     { paddingBottom: 10 },

  // You, pinned first: a white card on the cyan, outlined in brand teal.
  youCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: H_PAD, marginTop: 6, marginBottom: 6,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: radius.lg, borderWidth: 1.5,
  },
  youRankCol: { alignItems: "center", minWidth: 46 },
  youEyebrow: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.4 },
  youRank:    { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  youOf:      { fontFamily: fonts.sansMedium, fontSize: 10.5 },
  youDivider: { width: 1, alignSelf: "stretch", marginVertical: 4 },
  youInfo:    { flex: 1, minWidth: 0, gap: 2 },
  youName:    { fontFamily: fonts.sansBold, fontSize: 15 },
  youChip:    { marginVertical: 1 },
  youStats:   { fontFamily: fonts.sansMedium, fontSize: 12 },
  youGo: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingLeft: 10, paddingRight: 6, paddingVertical: 6, borderRadius: 999,
  },
  youGoText: { fontFamily: fonts.sansBold, fontSize: 12 },

  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 10, paddingBottom: 6, flexWrap: "wrap" },
  pageBtn: {
    minWidth: 40, height: 40, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  pageNum:   { fontFamily: fonts.sansBold, fontSize: 14 },
  pageGap:   { fontFamily: fonts.sansBold, fontSize: 14, paddingHorizontal: 2 },
  // Under the number of the page you're on.
  pageMeDot: { position: "absolute", bottom: 5, width: 5, height: 5, borderRadius: 3 },
  paging:    { opacity: 0.5 },
  stateBody:     { flex: 1, paddingHorizontal: H_PAD, paddingTop: 24 },
  // Sized inline from useWindowDimensions — see `blob` in the component.
  heroBlob: { position: "absolute" },

  heroNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: H_PAD,
    paddingTop: 6,
    paddingBottom: 4,
  },
  backBtn: {
    width: TAP, height: TAP, borderRadius: TAP / 2,
    justifyContent: "center", alignItems: "center",
  },
  // Same face and size as every other screen title (ScreenHeader → h3).
  heroTitle: { ...typography.h3 },
  heroSub:   { fontSize: 12.5, fontFamily: fonts.sansSemi, textAlign: "center", marginTop: 2, marginBottom: 4 },

  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-evenly",
    paddingHorizontal: 14,
    marginTop: 12,
  },
  podiumCol: { flex: 1, alignItems: "center" },

  // The face, or the overlapping faces of a tie, on one step.
  podiumFaces: { flexDirection: "row", marginBottom: 8 },
  // borderWidth + padding must stay in sync with FACE_RING.
  avatarRing: {
    borderRadius: 999,
    borderWidth: 3,
    padding: 2,
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
  rowNameCol: { flex: 1, marginRight: 8 },
  rowName: { fontSize: 14.5, fontFamily: fonts.sansSemi },
  rowSubLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  rowSub:  { fontSize: 11.5, fontFamily: fonts.sansMedium, flexShrink: 1 },
  rowPtsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  rowPts:     { fontSize: 12.5, fontFamily: fonts.sansBold },

  topThreeOnly: { textAlign: "center", fontSize: 13, marginTop: 12, fontFamily: fonts.sansMedium },

  stateBadge: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: "center", alignItems: "center",
    marginBottom: 14,
  },
});
