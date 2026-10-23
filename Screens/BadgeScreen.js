// screens/BadgeScreen.js — "Achievements" (the stack route keeps its name, Badges)
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Animated,
  useWindowDimensions,
  RefreshControl,
  Modal,
  StatusBar,
  Pressable,
  ScrollView,
} from "react-native";
import { showAlert } from "../components/AppAlert";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme, fonts, typography, radius } from "../context/ThemeContext";
import {
  ScreenHeader, Segmented, EmptyState, ErrorState, LoadingState, PrimaryButton, SearchField,
} from "../components/ui";
import { useArrival } from "../context/ArrivalContext";
import { BASE_URL } from "../api";
import { useLive } from "../utils/live";
import { badgeImage } from "../utils/image";
import { shareBadge } from "../utils/badgeShare";
import { celebrate } from "../utils/rewards";
import { MISSION_KINDS, ARRIVAL_KIND } from "../utils/missionTiers";
import { nextTitleLine, titleName } from "../utils/titles";
import { starPath } from "../utils/townEmblem";
import Icon from "../components/Icon";
import TitleChip from "../components/TitleChip";
import TownEmblem from "../components/TownEmblem";
import ProgressRing from "../components/ProgressRing";
import { BadgeShine, Sparkles, GlowPulse, HoloTilt } from "../components/BadgeEffects";
// The grid is shared with the Bakit List, AR View and Navigate spot lists.
import { GRID_GAP, H_GUTTER, columnsFor, cardSizeFor, AnimatedCell } from "../components/Grid";

/*
 * Achievements (the thesis panel, 2026-10-21), from GET /api/achievements/me:
 *
 *   Spots   every spot's badge — earned for finishing every mission there —
 *           with a ring that fills as its steps are done
 *   Towns   a badge per town, for finishing every spot in it (the image the
 *           admin uploaded, or the plain medal icon until there is one)
 *   Titles  Explorer, Voyager, GOAT Traveler — by the number of towns finished
 *
 * Until then this was "Badges", one per spot, given on arrival.
 */

const RING = 72;    // the progress ring round each spot badge
const ICON_SIZE = 54;

const cardHeightFor = (fontScale) => Math.ceil(118 + 44 * fontScale);

const TABS = [
  { key: "spots",  label: "Spots" },
  { key: "towns",  label: "Towns" },
  { key: "titles", label: "Titles" },
];

const fmtDate = (d, month = "short") =>
  new Date(d).toLocaleDateString("en-PH", { month, day: "numeric", year: "numeric" });

const stepKind = (step) => (step.type === "arrive" ? ARRIVAL_KIND : MISSION_KINDS[step.type] || MISSION_KINDS.checkin);

// Earned first (newest first), then furthest along, then the rest.
const byProgress = (a, b) =>
  (b.earned - a.earned) ||
  (a.earned && b.earned ? new Date(b.earnedAt || 0) - new Date(a.earnedAt || 0) : 0) ||
  (b.done / Math.max(1, b.total) - a.done / Math.max(1, a.total)) ||
  a.name.localeCompare(b.name);

function TitleMedal({ earned, size = 56, colors }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="47" fill={earned ? colors.accentSoft : colors.backgroundSoft} stroke={earned ? colors.accent : colors.cardBorder} strokeWidth={3} />
      <Path d={starPath(50, 50, 36, 21, 9.5)} fill={earned ? colors.accent : colors.starEmpty} />
      <Path d={starPath(50, 50, 20, 12, 5.5)} fill={earned ? colors.accentDark : colors.cardBorder} opacity={earned ? 0.35 : 0.6} />
    </Svg>
  );
}

export default function BadgeScreen() {
  const navigation   = useNavigation();
  const route        = useRoute();
  const { getToken } = useAuth();
  const { colors, isDark } = useTheme();
  const { allSpots } = useArrival();
  const hasLoaded    = useRef(false);
  const { width: winWidth, fontScale } = useWindowDimensions();
  const columns    = columnsFor(winWidth);
  const cardSize   = cardSizeFor(winWidth);
  const cardHeight = cardHeightFor(fontScale);
  const townCols   = Math.max(2, columns - 1);
  const townSize   = (winWidth - H_GUTTER - GRID_GAP * (townCols - 1)) / townCols;

  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState(null);
  const [tab, setTab]                 = useState(route?.params?.tab || "spots");
  const [query, setQuery]             = useState("");
  const [selected, setSelected]       = useState(null); // { kind: "spot" | "town", item }
  const [modalVisible, setModalVisible] = useState(false);
  const [sharing, setSharing]         = useState(false);

  const modalOpacity   = useRef(new Animated.Value(0)).current;
  const modalScale     = useRef(new Animated.Value(0.85)).current;
  const modalTranslate = useRef(new Animated.Value(40)).current;

  // A reward moment's "View achievements" opens a particular tab.
  useEffect(() => { if (route?.params?.tab) setTab(route.params.tab); }, [route?.params?.tab]);

  // `quiet`: a live update, which keeps what's shown if it fails.
  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/achievements/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`achievements ${res.status}`);
      const body = await res.json();
      setData(body);
      hasLoaded.current = true;
      // Anything owed from before — a mission that stopped counting, say —
      // is awarded by that request; celebrate it here.
      celebrate(body.unlocked);
    } catch (e) {
      console.warn("Achievements load error:", e);
      if (!quiet) setError("Couldn't load your achievements. Check your connection.");
    }
  };

  // Only the first load shows the loading state; coming back to the screen
  // refreshes in place.
  const initialLoad = async () => {
    if (!hasLoaded.current) setLoading(true);
    await load();
    setLoading(false);
  };
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  useEffect(() => {
    initialLoad();
    const unsub = navigation.addListener("focus", initialLoad);
    return unsub;
  }, [navigation]); // eslint-disable-line react-hooks/exhaustive-deps
  // An admin's new town badge art or a new spot (utils/live.js).
  useLive(["badges", "spots"], () => { if (hasLoaded.current) load({ quiet: true }); });

  const spots = useMemo(() => (data?.spots || []).filter((s) => s.badge).sort(byProgress), [data]);
  const towns = useMemo(() => (data?.towns || []).map((t) => ({ ...t, name: t.name || t.municipality, done: t.spotsDone, total: t.spotsTotal })).sort(byProgress), [data]);
  const titles = data?.titles || [];
  // The title on the profile and the leaderboard: the traveler's pick, else the highest.
  const shownKey = data?.shownTitle?.key ?? data?.title?.key ?? null;
  const titlesEarned = titles.filter((t) => t.earned).length;
  const spotsEarned = spots.filter((s) => s.earned).length;
  const townsEarned = towns.filter((t) => t.earned).length;

  const q = query.trim().toLowerCase();
  const matches = (fields) => !q || fields.filter(Boolean).some((f) => String(f).toLowerCase().includes(q));
  const visible = tab === "spots"
    ? spots.filter((s) => matches([s.name, s.badge?.name, s.town]))
    : tab === "towns" ? towns.filter((t) => matches([t.name, t.municipality])) : titles;

  // ── Detail ──
  const open = (kind, item) => {
    if (item.earned) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.selectionAsync().catch(() => {});
    setSelected({ kind, item });
    setModalVisible(true);
    modalOpacity.setValue(0);
    modalScale.setValue(item.earned ? 0.7 : 0.85);
    modalTranslate.setValue(40);
    Animated.parallel([
      Animated.timing(modalOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      // An earned badge overshoots on the way in; a locked one just settles.
      Animated.spring(modalScale, { toValue: 1, tension: item.earned ? 90 : 120, friction: item.earned ? 6 : 9, useNativeDriver: true }),
      Animated.timing(modalTranslate, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };
  const close = (then) => {
    Animated.parallel([
      Animated.timing(modalOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(modalScale, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      Animated.timing(modalTranslate, { toValue: 30, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      setSelected(null);
      if (typeof then === "function") then();
    });
  };

  const handleShare = async () => {
    const spot = selected?.item;
    if (!spot?.earned || !spot.badge) return;
    setSharing(true);
    const ok = await shareBadge({ _id: spot.badge.badgeId, name: spot.badge.name }, getToken);
    setSharing(false);
    if (!ok) showAlert("Error", "Could not open sharing. Please try again.");
  };

  // Shows the pick at once, and puts the old one back if the server says no.
  const showTitle = async (t) => {
    if (!t.earned || t.key === shownKey) return;
    Haptics.selectionAsync().catch(() => {});
    const before = data?.shownTitle ?? null;
    setData((d) => d && { ...d, shownTitle: { key: t.key, name: t.name } });
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users/me/title`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ key: t.key }),
      });
      if (!res.ok) throw new Error(`title ${res.status}`);
    } catch (e) {
      console.warn("Show title error:", e);
      setData((d) => d && { ...d, shownTitle: before });
      showAlert("Couldn't change your title", "Check your connection and try again.");
    }
  };

  const fullSpot = (spotId) => allSpots.find((s) => String(s._id) === String(spotId));
  const openSpot = (spotId) => {
    const spot = fullSpot(spotId);
    close(() => { if (spot) navigation.navigate("InformationScreen", { spot, tab: "BucketList" }); });
  };

  // ── Cards ──
  const renderSpot = useCallback(({ item: s, index }) => (
    <AnimatedCell delay={Math.min(index, 12) * 40}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => open("spot", s)}
        style={[styles.cellWrap, { width: cardSize }]}
        accessibilityRole="button"
        accessibilityLabel={s.earned
          ? `${s.badge.name} badge, earned${s.earnedAt ? ` on ${fmtDate(s.earnedAt, "long")}` : ""}`
          : `${s.badge.name} badge, locked, ${s.done} of ${s.total} done`}
        accessibilityHint="Opens the badge details"
      >
        {/* Earned badges lift off the page on a white card; the rest recede. */}
        <View style={[
          styles.card, { minHeight: cardHeight },
          s.earned ? { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 } : { backgroundColor: colors.backgroundSoft },
        ]}>
          <View>
            <ProgressRing done={s.done} total={s.total} size={RING} stroke={4}>
              {s.badge.image ? (
                <View style={styles.badgeImgBox}>
                  <Image
                    source={{ uri: badgeImage(s.badge.image, ICON_SIZE, { locked: !s.earned }) }}
                    style={[styles.badgeImg, !s.earned && styles.locked]}
                    resizeMode="cover"
                  />
                  {/* Earned: a light sweeps across it now and then, each card in its own time. */}
                  {s.earned && <BadgeShine size={ICON_SIZE} delay={(index % 6) * 560} />}
                </View>
              ) : (
                <Icon name="award" size={26} color={s.earned ? colors.brand : colors.textMuted} />
              )}
            </ProgressRing>
            {s.earned && <Sparkles size={RING} count={3} seed={index} />}
          </View>
          <Text style={[styles.cardName, { color: s.earned ? colors.textPrimary : colors.textSecondary }]} numberOfLines={2}>
            {s.badge.name}
          </Text>
          <View style={styles.cardFooter}>
            {s.earned ? (
              <View style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
                <Icon name="check" size={10} color={colors.accentDark} />
                <Text style={[styles.chipText, { color: colors.accentDark }]}>{s.earnedAt ? fmtDate(s.earnedAt) : "Earned"}</Text>
              </View>
            ) : (
              <Text style={[styles.footerText, { color: s.done ? colors.brand : colors.textMuted }]}>{s.done} of {s.total}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </AnimatedCell>
  ), [colors, cardSize, cardHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderTown = useCallback(({ item: t, index }) => (
    <AnimatedCell delay={Math.min(index, 8) * 50}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => open("town", t)}
        style={[styles.cellWrap, { width: townSize }]}
        accessibilityRole="button"
        accessibilityLabel={t.earned
          ? `${t.name} town badge, earned${t.earnedAt ? ` on ${fmtDate(t.earnedAt, "long")}` : ""}`
          : `${t.name} town badge, locked, ${t.spotsDone} of ${t.spotsTotal} spots done`}
        accessibilityHint="Opens the town's badge"
      >
        <View style={[
          styles.townCard,
          t.earned ? { backgroundColor: colors.card, borderColor: colors.accent, borderWidth: 1.5 } : { backgroundColor: colors.backgroundSoft },
        ]}>
          {/* A town badge is a tier up from a spot's: it also glows. */}
          <View>
            {t.earned && <GlowPulse size={96} />}
            <ProgressRing done={t.spotsDone} total={t.spotsTotal} size={104} stroke={5}>
              <View style={!t.earned && styles.locked}>
                <TownEmblem image={t.image} size={84} color={t.earned ? colors.brand : colors.textMuted} />
                {t.earned && t.image && <BadgeShine size={84} delay={(index % 4) * 700} every={3000} />}
              </View>
            </ProgressRing>
            {t.earned && <Sparkles size={104} count={4} seed={index + 3} />}
          </View>
          <Text style={[styles.townName, { color: colors.textPrimary }]} numberOfLines={1}>{t.name}</Text>
          {t.earned ? (
            <Text style={[styles.footerText, { color: colors.accentDark }]}>Finished{t.earnedAt ? ` · ${fmtDate(t.earnedAt)}` : ""}</Text>
          ) : (
            <Text style={[styles.footerText, { color: t.spotsDone ? colors.brand : colors.textMuted }]}>
              {t.spotsDone} of {t.spotsTotal} spot{t.spotsTotal === 1 ? "" : "s"}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </AnimatedCell>
  ), [colors, townSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // The earned titles are a pick-one list: the one picked shows next to the
  // traveler's name on their profile and the leaderboard.
  const renderTitle = ({ item: t, index }) => {
    const need = t.all ? `Finish every town with spots (${t.towns})` : `Finish ${t.towns} town${t.towns === 1 ? "" : "s"}`;
    const have = Math.min(townsEarned, t.towns);
    const shown = t.earned && t.key === shownKey;
    const Row = t.earned ? TouchableOpacity : View;
    return (
      <AnimatedCell delay={index * 60}>
        <Row
          style={[styles.titleRow, {
            backgroundColor: t.earned ? colors.card : colors.backgroundSoft,
            borderColor: shown ? colors.accent : colors.cardBorder,
          }]}
          {...(t.earned
            ? {
                activeOpacity: 0.75,
                onPress: () => showTitle(t),
                accessibilityRole: "radio",
                accessibilityState: { checked: shown },
                accessibilityLabel: `${t.name}, earned`,
                accessibilityHint: shown ? "Shown on your profile and the leaderboard" : "Shows this title on your profile and the leaderboard",
              }
            : { accessible: true, accessibilityLabel: `${t.name}: ${need}. ${have} of ${t.towns} towns` })}
        >
          <View>
            {t.earned && t.key === "goat" && <GlowPulse size={56} />}
            <TitleMedal earned={t.earned} colors={colors} />
            {t.earned && <BadgeShine size={56} delay={index * 600} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.titleName, { color: t.earned ? colors.textPrimary : colors.textSecondary }]}>{t.name}</Text>
            <Text style={[styles.titleNeed, { color: shown ? colors.accentDark : colors.textMuted }]}>
              {shown ? "On your profile and the leaderboard" : t.earned ? "Earned · tap to show it" : need}
            </Text>
            {!t.earned && (
              <View style={[styles.bar, { backgroundColor: colors.divider }]}>
                <View style={[styles.barFill, { backgroundColor: colors.brand, width: `${(have / Math.max(1, t.towns)) * 100}%` }]} />
              </View>
            )}
          </View>
          {t.earned ? (
            <View style={[styles.radio, shown ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.cardBorder }]}>
              {shown && <Icon name="check" size={14} color={colors.onAccent} />}
            </View>
          ) : <Text style={[styles.footerText, { color: colors.textMuted }]}>{have}/{t.towns}</Text>}
        </Row>
      </AnimatedCell>
    );
  };

  const header = (
    <ScreenHeader
      title="Achievements"
      onBack={() => navigation.goBack()}
      right={spots.length > 0 ? (
        <View style={[styles.countBadge, { backgroundColor: colors.brandLight }]} accessible accessibilityLabel={`${spotsEarned} of ${spots.length} spot badges`}>
          <Text style={[styles.countText, { color: colors.brandDark }]}>{spotsEarned}/{spots.length}</Text>
        </View>
      ) : null}
    />
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <LoadingState label="Loading achievements…" />
      </View>
    );
  }

  // Your title and the next one up: the top of the screen.
  const next = data?.nextTitle;
  const nextShare = next && Number.isFinite(next.townsLeft) ? townsEarned / Math.max(1, townsEarned + next.townsLeft) : 1;
  const summary = data && (
    <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.summaryTop}>
        <View style={{ flex: 1 }}>
          {data.title ? <TitleChip title={data.title} /> : (
            <Text style={[styles.summaryEyebrow, { color: colors.textMuted }]}>NO TITLE YET</Text>
          )}
          <Text style={[styles.summaryHeadline, { color: colors.textPrimary }]}>
            {data.title ? data.title.name : "Finish a town for your first title"}
          </Text>
          <Text style={[styles.summaryNext, { color: colors.textSecondary }]}>{nextTitleLine(next)}</Text>
        </View>
        <View>
          {data.title?.key === "goat" && <GlowPulse size={64} />}
          <TitleMedal earned={!!data.title} size={64} colors={colors} />
          {data.title && <BadgeShine size={64} every={4200} />}
        </View>
      </View>
      {next && (
        <View style={[styles.bar, styles.summaryBar, { backgroundColor: colors.divider }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(nextShare * 100) }}>
          <View style={[styles.barFill, { backgroundColor: colors.accent, width: `${nextShare * 100}%` }]} />
        </View>
      )}
      <View style={styles.summaryStats}>
        <Text style={[styles.summaryStat, { color: colors.textSecondary }]}><Text style={[styles.summaryNum, { color: colors.textPrimary }]}>{spotsEarned}</Text>/{spots.length} spot badges</Text>
        <Text style={[styles.summaryStat, { color: colors.textSecondary }]}><Text style={[styles.summaryNum, { color: colors.textPrimary }]}>{townsEarned}</Text>/{towns.length} towns</Text>
      </View>
      {/* With more than one title there's a choice of which one others see. */}
      {titlesEarned > 1 && (
        <TouchableOpacity
          style={[styles.shownRow, { borderTopColor: colors.divider }]}
          onPress={() => { setTab("titles"); setQuery(""); }}
          accessibilityRole="button"
          accessibilityLabel={`${titleName(shownKey)} shows on your profile and the leaderboard`}
          accessibilityHint="Opens Titles to change it"
        >
          <Text style={[styles.shownLabel, { color: colors.textSecondary }]}>Shown to others</Text>
          <TitleChip title={shownKey} size="sm" />
          <Text style={[styles.shownChange, { color: colors.brand }]}>Change</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const counts = { spots: `${spotsEarned}/${spots.length}`, towns: `${townsEarned}/${towns.length}`, titles: `${titles.filter((t) => t.earned).length}/${titles.length}` };
  const listKey = tab === "spots" ? `spots-${columns}` : tab === "towns" ? `towns-${townCols}` : "titles";
  const numColumns = tab === "spots" ? columns : tab === "towns" ? townCols : 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      {header}

      <FlatList
        key={listKey}
        data={visible}
        keyExtractor={(item) => String(item.spotId || item.municipality || item.key)}
        extraData={shownKey}
        renderItem={tab === "spots" ? renderSpot : tab === "towns" ? renderTown : renderTitle}
        numColumns={numColumns}
        {...(numColumns > 1 && { columnWrapperStyle: styles.row })}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        windowSize={7}
        initialNumToRender={12}
        maxToRenderPerBatch={9}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
        ListHeaderComponent={
          <>
            {error && <ErrorState text={error} onRetry={onRefresh} style={styles.errorBox} />}
            {summary}
            {data && (
              <Segmented
                style={styles.filterBar}
                value={tab}
                onChange={(k) => { setTab(k); setQuery(""); }}
                options={TABS.map((t) => ({ key: t.key, label: `${t.label} ${counts[t.key]}`, a11y: `${t.label}, ${counts[t.key]} earned` }))}
              />
            )}
            {data && tab !== "titles" && (
              <SearchField
                value={query}
                onChangeText={setQuery}
                onClear={() => setQuery("")}
                placeholder={tab === "spots" ? "Search badges or spots" : "Search towns"}
                style={styles.search}
              />
            )}
            {tab === "titles" && data && (
              <Text style={[styles.titlesIntro, { color: colors.textSecondary }]}>
                A town is finished when every mission at every spot in it is done. Titles stay once earned
                {titlesEarned > 0 ? ". Pick the one to show next to your name on your profile and the leaderboard." : "."}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          !data ? null
            : q ? <EmptyState icon="search" text={tab === "spots" ? "No badge matches that. Try a spot or town name." : "No town matches that."} />
            : <EmptyState icon="award" title="Nothing here yet" text="Finish every mission at a spot to earn its badge." />
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* ── Detail ── */}
      <Modal visible={modalVisible} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
        <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity, backgroundColor: colors.overlay }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => close()} />
          {selected && (
            <Animated.View
              style={[
                styles.modalCard,
                { width: Math.min(winWidth - 48, 420), backgroundColor: colors.background },
                { opacity: modalOpacity, transform: [{ scale: modalScale }, { translateY: modalTranslate }] },
              ]}
            >
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close details" style={[styles.modalClose, { backgroundColor: colors.card }]} onPress={() => close()}>
                <Icon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                {selected.kind === "spot" ? renderSpotDetail(selected.item) : renderTownDetail(selected.item)}
              </ScrollView>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>
    </View>
  );

  function renderSpotDetail(s) {
    return (
      <>
        {/* Earned, up close: a holographic badge to tilt, glowing and twinkling. */}
        <View>
          {s.earned && <GlowPulse size={124} strength={0.26} />}
          <ProgressRing done={s.done} total={s.total} size={136} stroke={6}>
            {s.badge.image ? (
              <HoloTilt size={110} active={s.earned}>
                <Image source={{ uri: badgeImage(s.badge.image, 110, { locked: !s.earned }) }} style={[styles.modalBadgeImg, !s.earned && styles.locked]} resizeMode="cover" />
              </HoloTilt>
            ) : <Icon name="award" size={52} color={s.earned ? colors.brand : colors.textMuted} />}
          </ProgressRing>
          {s.earned && <Sparkles size={136} count={6} spread={0.6} />}
        </View>
        {s.earned && <Text style={[styles.tiltHint, { color: colors.textMuted }]}>Drag the badge to tilt it</Text>}
        <View style={[styles.earnedPill, { backgroundColor: s.earned ? colors.accent : colors.textMuted }]}>
          <Icon name={s.earned ? "check-circle" : "lock"} size={11} color={s.earned ? colors.onAccent : colors.textInverse} style={{ marginRight: 4 }} />
          <Text style={[styles.earnedPillText, { color: s.earned ? colors.onAccent : colors.textInverse }]}>
            {s.earned ? "Badge earned" : `${s.done} of ${s.total} done`}
          </Text>
        </View>
        <Text style={[styles.modalName, { color: colors.textPrimary }]}>{s.badge.name}</Text>
        {s.town && <Text style={[styles.modalSub, { color: colors.textMuted }]}>{s.town}</Text>}

        {s.earned ? (
          <>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              {s.badge.description || "You finished every mission here."}
            </Text>
            {s.earnedAt && <Text style={[styles.modalSub, { color: colors.textMuted }]}>Earned on {fmtDate(s.earnedAt, "long")}</Text>}
          </>
        ) : (
          <Text style={[styles.modalText, { color: colors.textSecondary }]}>Finish every one of these to earn it:</Text>
        )}

        {/* The steps, ticked as they're done. */}
        <View style={[styles.steps, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
          {s.steps.map((st) => {
            const kind = stepKind(st);
            return (
              <View key={st.key} style={styles.stepRow} accessible accessibilityLabel={`${kind.label}, ${st.done ? "done" : "not done"}`}>
                <View style={[styles.stepIcon, { backgroundColor: st.done ? colors.successBg : colors.brandLight }]}>
                  <Icon name={st.done ? "check" : kind.icon} size={15} color={st.done ? colors.success : colors.brand} />
                </View>
                <Text style={[styles.stepLabel, { color: colors.textPrimary }]}>{kind.label}</Text>
                <Text style={[styles.stepState, { color: st.done ? colors.success : colors.textMuted }]}>{st.done ? "Done" : "To do"}</Text>
              </View>
            );
          })}
        </View>

        {s.earned ? (
          <PrimaryButton title="Share badge" icon="share-2" onPress={handleShare} loading={sharing} style={styles.modalButton} accessibilityLabel="Share a link to this badge" />
        ) : fullSpot(s.spotId) ? (
          <PrimaryButton title="Go to this spot's Bakit List" icon="map-pin" variant="secondary" onPress={() => openSpot(s.spotId)} style={styles.modalButton} />
        ) : (
          <PrimaryButton title="Close" variant="secondary" onPress={() => close()} style={styles.modalButton} />
        )}
      </>
    );
  }

  function renderTownDetail(t) {
    const townSpots = spots.filter((s) => s.town === t.municipality);
    return (
      <>
        <View>
          {t.earned && <GlowPulse size={128} />}
          <View style={!t.earned && styles.locked}>
            <HoloTilt size={132} active={t.earned}>
              <TownEmblem image={t.image} size={132} color={t.earned ? colors.brand : colors.textMuted} />
            </HoloTilt>
          </View>
          {t.earned && <Sparkles size={132} count={7} spread={0.64} seed={2} />}
        </View>
        {t.earned && <Text style={[styles.tiltHint, { color: colors.textMuted }]}>Drag the badge to tilt it</Text>}
        <View style={[styles.earnedPill, { backgroundColor: t.earned ? colors.accent : colors.textMuted }]}>
          <Icon name={t.earned ? "check-circle" : "lock"} size={11} color={t.earned ? colors.onAccent : colors.textInverse} style={{ marginRight: 4 }} />
          <Text style={[styles.earnedPillText, { color: t.earned ? colors.onAccent : colors.textInverse }]}>
            {t.earned ? "Town finished" : `${t.spotsDone} of ${t.spotsTotal} spots`}
          </Text>
        </View>
        <Text style={[styles.modalName, { color: colors.textPrimary }]}>{t.name}</Text>
        <Text style={[styles.modalText, { color: colors.textSecondary }]}>
          {t.earned ? t.description : `Finish every mission at every spot in ${t.municipality} to earn it.`}
        </Text>
        {t.earned && t.earnedAt && <Text style={[styles.modalSub, { color: colors.textMuted }]}>Finished on {fmtDate(t.earnedAt, "long")}</Text>}
        {t.earned && t.spotsDone < t.spotsTotal && (
          <Text style={[styles.modalSub, { color: colors.textMuted }]}>New spot added since · {t.spotsDone} of {t.spotsTotal}</Text>
        )}

        <View style={[styles.steps, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
          {townSpots.map((s) => (
            <TouchableOpacity
              key={s.spotId}
              style={styles.stepRow}
              onPress={() => openSpot(s.spotId)}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}, ${s.earned ? "badge earned" : `${s.done} of ${s.total} done`}`}
            >
              <View style={[styles.stepIcon, { backgroundColor: s.earned ? colors.accentSoft : colors.brandLight }]}>
                <Icon name={s.earned ? "award" : "map-pin"} size={15} color={s.earned ? colors.accentDark : colors.brand} />
              </View>
              <Text style={[styles.stepLabel, { color: colors.textPrimary }]} numberOfLines={1}>{s.name}</Text>
              <Text style={[styles.stepState, { color: s.earned ? colors.accentDark : colors.textMuted }]}>{s.earned ? "Done" : `${s.done}/${s.total}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <PrimaryButton title="Close" variant="secondary" onPress={() => close()} style={styles.modalButton} />
      </>
    );
  }
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  countBadge:  { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  countText:   { fontFamily: fonts.sansBold, fontSize: 13 },

  scrollContent: { paddingHorizontal: H_GUTTER / 2, paddingTop: 8, flexGrow: 1 },
  row: { justifyContent: "flex-start", gap: GRID_GAP, marginBottom: GRID_GAP },

  summary:         { borderRadius: radius.card, borderWidth: 1, padding: 16, marginBottom: 16 },
  summaryTop:      { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryEyebrow:  { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.2 },
  summaryHeadline: { ...typography.display, fontSize: 24, lineHeight: 29, marginTop: 6 },
  summaryNext:     { fontFamily: fonts.sansMedium, fontSize: 13, marginTop: 3 },
  summaryBar:      { marginTop: 14 },
  summaryStats:    { flexDirection: "row", gap: 18, marginTop: 12 },
  summaryStat:     { fontFamily: fonts.sansMedium, fontSize: 12.5 },
  summaryNum:      { fontFamily: fonts.sansBold, fontSize: 14 },
  shownRow:        { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  shownLabel:      { fontFamily: fonts.sansMedium, fontSize: 12.5 },
  shownChange:     { fontFamily: fonts.sansBold, fontSize: 13, marginLeft: "auto" },

  bar:      { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 8 },
  barFill:  { height: "100%", borderRadius: 3 },

  search:      { marginBottom: 14 },
  filterBar:   { marginBottom: 12 },
  errorBox:    { marginBottom: 16 },
  titlesIntro: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, marginBottom: 12 },

  cellWrap: { flexGrow: 1 },
  card:     { flexGrow: 1, borderRadius: 16, padding: 10, alignItems: "center" },
  badgeImgBox: { width: ICON_SIZE, height: ICON_SIZE },
  badgeImg: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2 },
  locked:   { opacity: 0.5 },
  cardName: { fontSize: 11.5, fontFamily: fonts.sansSemi, textAlign: "center", lineHeight: 15, marginTop: 8 },
  cardFooter: { marginTop: "auto", paddingTop: 6, alignItems: "center" },
  footerText: { fontSize: 11.5, fontFamily: fonts.sansBold },
  chip:     { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  chipText: { fontSize: 10, lineHeight: 13, fontFamily: fonts.sansBold },

  townCard: { borderRadius: 20, paddingVertical: 14, paddingHorizontal: 10, alignItems: "center", gap: 6 },
  townName: { ...typography.display, fontSize: 18, lineHeight: 23, marginTop: 4 },

  titleRow:  { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radius.card, borderWidth: 1, marginBottom: 12 },
  titleName: { ...typography.display, fontSize: 21, lineHeight: 26 },
  titleNeed: { fontFamily: fonts.sansMedium, fontSize: 12.5, marginTop: 2 },
  radio:     { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },

  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalCard: {
    borderRadius: 28, maxHeight: "86%",
    shadowColor: "#0B2E31", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 18,
  },
  modalBody:  { alignItems: "center", paddingTop: 36, paddingBottom: 26, paddingHorizontal: 26 },
  modalClose: { position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", zIndex: 2 },
  modalBadgeImg: { width: 110, height: 110, borderRadius: 55 },
  tiltHint:   { fontSize: 11.5, fontFamily: fonts.sansMedium, marginTop: 8 },
  earnedPill:  { flexDirection: "row", alignItems: "center", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 14, marginBottom: 10 },
  earnedPillText: { fontSize: 11, fontFamily: fonts.sansBold, letterSpacing: 0.3 },
  modalName:  { ...typography.display, fontSize: 22, textAlign: "center", lineHeight: 28 },
  modalSub:   { fontSize: 12, fontFamily: fonts.sansMedium, textAlign: "center", marginTop: 4 },
  modalText:  { fontSize: 13.5, fontFamily: fonts.sans, textAlign: "center", lineHeight: 20, marginTop: 10 },
  steps:      { alignSelf: "stretch", borderRadius: 16, borderWidth: 1, marginTop: 14, paddingVertical: 4 },
  stepRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  stepIcon:   { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stepLabel:  { flex: 1, fontFamily: fonts.sansSemi, fontSize: 14 },
  stepState:  { fontFamily: fonts.sansBold, fontSize: 12 },
  modalButton: { alignSelf: "stretch", marginTop: 18 },
});
