// screens/BadgeScreen.js
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
} from "react-native";
import { showAlert } from "../components/AppAlert";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import RNShare from "react-native-share";
import * as Haptics from "expo-haptics";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import {
  ScreenHeader, Segmented, EmptyState, ErrorState, LoadingState, PrimaryButton, SearchField,
} from "../components/ui";
import { useArrival } from "../context/ArrivalContext";
import { BASE_URL } from "../api";
import { badgeShareUrl } from "../utils/legalLinks";
import { badgeImage } from "../utils/image";
import Icon from "../components/Icon";
// The grid is shared with the Bakit List, AR View and Navigate spot lists.
import { GRID_GAP, H_GUTTER, columnsFor, cardSizeFor, AnimatedCell } from "../components/Grid";

const ICON_SIZE = 60; // the round badge in each grid card

// Every card is one height: padding, the badge, a two-line name and the footer
// chip, with the text parts grown by the phone's text size so large text
// doesn't spill. Cards used to be as tall as their own text, so a one-line
// name made a shorter card than its neighbours.
const cardHeightFor = (fontScale) => Math.ceil(104 + 44 * fontScale);

// The spot's name under a locked badge, only when it says something the
// badge's name doesn't. A badge is named after its spot, so this was nearly
// always the same name twice.
const spotLine = (badge) => {
  if (badge.claimed) return null;
  const spot = badge.spotId?.name;
  return spot === badge.name ? null : spot || "Unknown spot";
};

const FILTERS = [
  { key: "all",     label: "All" },
  { key: "claimed",  label: "Claimed" },
  { key: "locked",   label: "Locked" },
];

export default function BadgeScreen() {
  const navigation   = useNavigation();
  const { getToken } = useAuth();
  const { colors, isDark } = useTheme();
  const { allSpots } = useArrival();
  const hasLoaded    = useRef(false);
  const { width: winWidth, fontScale } = useWindowDimensions();
  const columns    = columnsFor(winWidth);
  const cardSize   = cardSizeFor(winWidth);
  const cardHeight = cardHeightFor(fontScale);

  const [badges, setBadges]             = useState([]); // full catalog, each tagged with .claimed
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);
  const [filter, setFilter]             = useState("all");
  const [query, setQuery]               = useState("");
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [modalVisible, setModalVisible]   = useState(false);
  const [sharing, setSharing]             = useState(false);

  const modalOpacity   = useRef(new Animated.Value(0)).current;
  const modalScale     = useRef(new Animated.Value(0.85)).current;
  const modalTranslate = useRef(new Animated.Value(40)).current;

  const loadBadges = async () => {
    setError(null);
    try {
      const token = await getToken();

      const [catalogRes, userRes] = await Promise.all([
        fetch(`${BASE_URL}/api/badges`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${BASE_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!catalogRes.ok) throw new Error("Failed to fetch badge catalog");
      if (!userRes.ok) throw new Error("Failed to fetch profile");

      const catalogData = await catalogRes.json();
      const userData     = await userRes.json();

      const catalog = catalogData?.badges ?? [];
      const earned  = userData?.user?.badges ?? [];

      const earnedMap = new Map(
        earned.map((b) => [String(b.spotId?._id ?? b.spotId), b])
      );

      const combined = catalog.map((b) => {
        const spotKey = String(b.spotId?._id ?? b.spotId);
        const earnedBadge = earnedMap.get(spotKey);
        return {
          ...b,
          claimed:   !!earnedBadge,
          claimedAt: earnedBadge?.claimedAt ?? null,
        };
      });

      combined.sort((a, b) => (b.claimed === a.claimed ? 0 : b.claimed ? 1 : -1));
      setBadges(combined);
      hasLoaded.current = true;
    } catch (e) {
      console.warn("BadgeScreen load error:", e);
      setError("Couldn't load your badges. Check your connection.");
    }
  };

  // Only the first load shows the loading state. The focus listener re-runs
  // this every time the screen comes back into view (e.g. closing a spot you
  // opened from a badge), and each of those used to blank the grid.
  const initialLoad = async () => {
    if (!hasLoaded.current) setLoading(true);
    await loadBadges();
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBadges();
    setRefreshing(false);
  };

  useEffect(() => {
    initialLoad();
    const unsub = navigation.addListener("focus", initialLoad);
    return unsub;
  }, [navigation]);

  const claimedCount = useMemo(() => badges.filter((b) => b.claimed).length, [badges]);
  const lockedCount  = badges.length - claimedCount;

  // The filter, then the search (QA 2026-10-16): a badge matches on its own
  // name, its description, or the name or town of its spot.
  const q = query.trim().toLowerCase();
  const visibleBadges = useMemo(() => {
    const byFilter =
      filter === "claimed" ? badges.filter((b) => b.claimed)
      : filter === "locked" ? badges.filter((b) => !b.claimed)
      : badges;
    if (!q) return byFilter;
    return byFilter.filter((b) =>
      [b.name, b.description, b.spotId?.name, b.spotId?.city]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [badges, filter, q]);

  const openBadge = (badge) => {
    // Opening a badge you actually earned is the reward moment of the whole
    // points system — it should feel like something. A locked badge gets the
    // lighter selection tick instead, so the two are distinguishable by touch.
    if (badge.claimed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.selectionAsync().catch(() => {});
    }

    setSelectedBadge(badge);
    setModalVisible(true);
    modalOpacity.setValue(0);
    modalScale.setValue(badge.claimed ? 0.7 : 0.85);
    modalTranslate.setValue(40);

    Animated.parallel([
      Animated.timing(modalOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      // A claimed badge overshoots on the way in; a locked one just settles.
      Animated.spring(modalScale, {
        toValue: 1,
        tension: badge.claimed ? 90 : 120,
        friction: badge.claimed ? 6 : 9,
        useNativeDriver: true,
      }),
      Animated.timing(modalTranslate, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeBadge = () => {
    Animated.parallel([
      Animated.timing(modalOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(modalScale, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      Animated.timing(modalTranslate, { toValue: 30, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      setSelectedBadge(null);
    });
  };

  // A badge is shared as a link, never as a picture (2026-10-20, the user:
  // "remove the share as image"). The link becomes a preview card showing the
  // badge — libotbulacan.com/badge/<id> writes per-badge preview tags into its
  // HTML, which chat apps' link crawlers read — and tapping it opens the badge
  // on the website, where the app can be downloaded. The link goes as `url`,
  // not inside the text: Android still sends "text link", but iOS then shares
  // it as a real link, which is what gets the preview card there.
  const handleShare = async () => {
    if (!selectedBadge?.claimed) return;
    try {
      setSharing(true);
      await RNShare.open({
        title: `${selectedBadge.name} Badge`,
        message: `I just earned the "${selectedBadge.name}" badge on Libot Bulacan! Discover Bulacan's history!`,
        url: badgeShareUrl(selectedBadge._id),
        failOnCancel: false,
      });
    } catch (e) {
      if (e?.message !== "User did not share") {
        console.warn("[Share] Failed:", e);
        showAlert("Error", "Could not open sharing. Please try again.");
      }
    } finally {
      setSharing(false);
    }
  };

  const renderBadge = useCallback(({ item: badge, index }) => (
    <AnimatedCell delay={Math.min(index, 12) * 40}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => openBadge(badge)}
        style={[styles.badgeWrapper, { width: cardSize }]}
        accessibilityRole="button"
        accessibilityLabel={
          badge.claimed
            ? `${badge.name} badge, earned${badge.claimedAt ? ` on ${new Date(badge.claimedAt).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}` : ""}`
            : `${badge.name} badge, locked`
        }
        accessibilityHint="Opens the badge details"
      >
        {/* Claimed badges sit on a white card so they LIFT off the warm page;
            locked ones recede into the page tint. Previously this was inverted,
            so the thing you earned looked flatter than the thing you hadn't. */}
        <View style={[
          styles.badgeCard,
          { minHeight: cardHeight },
          badge.claimed
            ? { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }
            : { backgroundColor: colors.backgroundSoft },
        ]}>
          {/* A locked badge shows its own art in grayscale with a lock chip.
              It used to sit at 30% under a dark overlay that covered it, so
              every locked badge looked like the same dark seal. */}
          <View style={styles.iconCircle}>
            {badge.image ? (
              <Image
                source={{ uri: badgeImage(badge.image, ICON_SIZE, { locked: !badge.claimed }) }}
                style={[styles.badgeImage, !badge.claimed && styles.badgeImageLocked]}
                resizeMode="cover"
              />
            ) : (
              <Icon name="award" size={26} color={badge.claimed ? colors.brand : colors.textMuted} />
            )}
            {!badge.claimed && (
              <View style={[styles.lockChip, { backgroundColor: colors.background }]}>
                <Icon name="lock" size={11} color={colors.textMuted} />
              </View>
            )}
            {badge.claimed && (
              <View style={[styles.checkOverlay, { backgroundColor: colors.background }]}>
                <Icon name="check-circle" size={16} color={colors.brand} />
              </View>
            )}
          </View>

          <Text
            style={[styles.badgeName, { color: badge.claimed ? colors.textPrimary : colors.textSecondary }]}
            numberOfLines={spotLine(badge) ? 1 : 2}
          >
            {badge.name}
          </Text>
          {spotLine(badge) && (
            <Text style={[styles.lockedSpot, { color: colors.textMuted }]} numberOfLines={1}>
              {spotLine(badge)}
            </Text>
          )}

          {/* Pinned to the bottom, so it lines up across cards whatever the
              length of the name above it. */}
          <View style={styles.cardFooter}>
            {badge.claimed ? (
              badge.claimedAt && (
                <Text style={[styles.claimedDate, { color: colors.textMuted }]}>
                  {new Date(badge.claimedAt).toLocaleDateString("en-PH", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </Text>
              )
            ) : (
              typeof badge.points === "number" && badge.points > 0 && (
                <View style={[styles.ptsChip, { backgroundColor: colors.brandLight }]}>
                  <Icon name="star" size={9} color={colors.brand} />
                  <Text style={[styles.ptsChipText, { color: colors.brand }]}>+{badge.points}</Text>
                </View>
              )
            )}
          </View>
        </View>
      </TouchableOpacity>
    </AnimatedCell>
  ), [colors, cardSize, cardHeight]);

  // The spot a badge belongs to, in full, so the detail modal can open it.
  const spotForBadge = (badge) => {
    const id = badge?.spotId?._id ?? badge?.spotId;
    return id ? allSpots.find((s) => String(s._id) === String(id)) : null;
  };
  const selectedSpot = spotForBadge(selectedBadge);

  const openSelectedSpot = () => {
    const spot = selectedSpot;
    closeBadge();
    if (spot) navigation.navigate("InformationScreen", { spot });
  };

  const header = (
    <ScreenHeader
      title="Badges"
      onBack={() => navigation.goBack()}
      right={
        badges.length > 0 ? (
          <View style={[styles.countBadge, { backgroundColor: colors.brandLight }]}>
            <Text style={[styles.countText, { color: colors.brandDark }]}>{claimedCount}/{badges.length}</Text>
          </View>
        ) : null
      }
    />
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <LoadingState label="Loading badges…" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {header}

      <FlatList
        data={visibleBadges}
        keyExtractor={(item) => item._id}
        renderItem={renderBadge}
        // FlatList cannot change numColumns in place, so the key forces a
        // remount when the viewport crosses a breakpoint.
        key={columns}
        numColumns={columns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // Virtualization tuning — grid cells are small/cheap, so a modest
        // window keeps memory bounded even if the catalog grows past 50+.
        windowSize={7}
        initialNumToRender={12}
        maxToRenderPerBatch={9}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListHeaderComponent={
          <>
            {error && <ErrorState text={error} onRetry={onRefresh} style={styles.errorBox} />}

            {badges.length > 0 && (
              <SearchField
                value={query}
                onChangeText={setQuery}
                onClear={() => setQuery("")}
                placeholder="Search badges or spots"
                style={styles.search}
              />
            )}

            {badges.length > 0 && (
              <Segmented
                style={styles.filterBar}
                value={filter}
                onChange={setFilter}
                options={FILTERS.map((f) => {
                  const count = f.key === "all" ? badges.length : f.key === "claimed" ? claimedCount : lockedCount;
                  return { key: f.key, label: `${f.label} (${count})`, a11y: `${f.label}, ${count} badges` };
                })}
              />
            )}
          </>
        }
        ListEmptyComponent={
          !error && badges.length === 0 ? (
            <EmptyState
              icon="award"
              title="No badges yet"
              text="Arrive at a spot in person to earn its badge."
            />
          ) : !error && q && visibleBadges.length === 0 ? (
            <EmptyState icon="search" text="No badge matches that. Try a spot or town name." />
          ) : !error && visibleBadges.length === 0 ? (
            <EmptyState
              icon={filter === "claimed" ? "target" : "check-circle"}
              title={filter === "claimed" ? "Nothing claimed yet" : "All badges unlocked!"}
            />
          ) : null
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* ── Badge Detail Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeBadge}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity, backgroundColor: colors.overlay }]}>
          <Pressable
            accessibilityRole="button" style={styles.modalBackdrop} onPress={closeBadge} />

          <Animated.View
            style={[
              styles.modalCard,
              // Width comes from the live viewport, capped so the card doesn't
              // stretch edge-to-edge on a tablet. It used to read a module-scope
              // `Dimensions.get("window")` that no longer exists.
              { width: Math.min(winWidth - 48, 420), backgroundColor: colors.background },
              {
                opacity: modalOpacity,
                transform: [{ scale: modalScale }, { translateY: modalTranslate }],
              },
            ]}
          >
            <TouchableOpacity
              accessibilityRole="button" accessibilityLabel="Close badge details" style={[styles.modalClose, { backgroundColor: colors.card }]} onPress={closeBadge}>
              <Icon name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.modalIconRing}>
              <View style={styles.modalIconInner}>
                {selectedBadge?.image ? (
                  <Image
                    source={{ uri: badgeImage(selectedBadge.image, 110, { locked: !selectedBadge?.claimed }) }}
                    style={[styles.modalBadgeImage, !selectedBadge?.claimed && styles.badgeImageLocked]}
                    resizeMode="cover"
                  />
                ) : (
                  <Icon name="award" size={52} color={selectedBadge?.claimed ? colors.brand : colors.textMuted} />
                )}
                {!selectedBadge?.claimed && (
                  <View style={[styles.modalLockChip, { backgroundColor: colors.background }]}>
                    <Icon name="lock" size={16} color={colors.textMuted} />
                  </View>
                )}
              </View>

              {selectedBadge?.claimed && [...Array(6)].map((_, i) => {
                const angle = (i / 6) * 2 * Math.PI;
                const r = 68;
                return (
                  <View
                    key={i}
                    style={[
                      styles.sparkleDot,
                      { backgroundColor: colors.brandLight },
                      { left: 70 + r * Math.cos(angle) - 4, top: 70 + r * Math.sin(angle) - 4 },
                    ]}
                  />
                );
              })}
            </View>

            <View style={[
              styles.earnedPill,
              { backgroundColor: selectedBadge?.claimed ? colors.brand : colors.textMuted },
            ]}>
              <Icon
                name={selectedBadge?.claimed ? "check-circle" : "lock"}
                size={11}
                color={colors.textInverse}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.earnedPillText, { color: colors.textInverse }]}>
                {selectedBadge?.claimed ? "Badge Earned" : "Not Yet Earned"}
              </Text>
            </View>

            <Text style={[styles.modalBadgeName, { color: colors.textPrimary }]}>{selectedBadge?.name}</Text>

            {!selectedBadge?.claimed && (
              <View style={styles.modalSpotRow}>
                <Icon name="map-pin" size={12} color={colors.brand} />
                <Text style={[styles.modalSpotText, { color: colors.brand }]}>
                  {" "}{selectedBadge?.spotId?.name || "Unknown spot"}
                  {typeof selectedBadge?.points === "number" && selectedBadge.points > 0
                    ? ` · +${selectedBadge.points} pts` : ""}
                </Text>
              </View>
            )}

            {selectedBadge?.claimed ? (
              selectedBadge?.description ? (
                <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>{selectedBadge.description}</Text>
              ) : (
                <Text style={[styles.modalDescriptionFallback, { color: colors.textMuted }]}>
                  You visited this historical spot and claimed your badge. Keep exploring to discover more!
                </Text>
              )
            ) : (
              <Text style={[styles.modalDescriptionFallback, { color: colors.textMuted }]}>
                {selectedBadge?.description || "Visit this spot in person to unlock this badge."}
              </Text>
            )}

            {selectedBadge?.claimed && selectedBadge?.claimedAt && (
              <View style={styles.modalDateRow}>
                <Icon name="calendar" size={12} color={colors.textMuted} />
                <Text style={[styles.modalDate, { color: colors.textMuted }]}>
                  {" "}Claimed on{" "}
                  {new Date(selectedBadge.claimedAt).toLocaleDateString("en-PH", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </Text>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: colors.divider }]} />

            {selectedBadge?.claimed ? (
              <PrimaryButton
                title="Share badge"
                icon="share-2"
                onPress={handleShare}
                loading={sharing}
                style={styles.modalButton}
                accessibilityLabel="Share a link to this badge"
              />
            ) : selectedSpot ? (
              // "Go Explore" used to just close the modal. It now opens the
              // spot the badge is earned at.
              <PrimaryButton
                title="View this spot"
                icon="map-pin"
                variant="secondary"
                onPress={openSelectedSpot}
                style={styles.modalButton}
              />
            ) : (
              <PrimaryButton title="Close" variant="secondary" onPress={closeBadge} style={styles.modalButton} />
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },

  countBadge:  { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  countText:   { fontFamily: fonts.sansBold, fontSize: 13 },

  scrollContent: { paddingHorizontal: H_GUTTER / 2, paddingTop: 8, flexGrow: 1 },
  row: { justifyContent: "flex-start", gap: GRID_GAP, marginBottom: GRID_GAP },

  search:    { marginBottom: 12 },
  filterBar: { marginBottom: 16 },
  errorBox:  { marginBottom: 16 },

  // flexGrow down the chain lets each card stretch to its row, so the cards in
  // a row still match if a very large text size outgrows cardHeightFor.
  badgeWrapper: { flexGrow: 1 },
  // Border, not a drop shadow — the same depth cue as every other card.
  badgeCard: {
    flexGrow: 1,
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
  },
  cardFooter: {
    marginTop: "auto",
    paddingTop: 6,
    alignItems: "center",
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
    backgroundColor: "transparent",
  },
  badgeImage: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: "transparent",
  },
  badgeImageLocked: { opacity: 0.55 },
  lockChip: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkOverlay: {
    position: "absolute",
    bottom: -4,
    right: -4,
    borderRadius: 10,
  },
  // These were 9–10pt, below comfortable reading size on a phone.
  badgeName: {
    fontSize: 11.5,
    fontFamily: fonts.sansSemi,
    textAlign: "center",
    lineHeight: 15,
  },
  claimedDate: {
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: fonts.sansMedium,
    textAlign: "center",
  },
  lockedSpot: {
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: fonts.sansMedium,
    marginTop: 3,
    textAlign: "center",
  },
  ptsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ptsChipText: { fontSize: 10, lineHeight: 13, fontFamily: fonts.sansBold },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    borderRadius: 28,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 28,
    alignItems: "center",
    // Was a brown #2c1210 left over from the old terracotta palette.
    shadowColor: "#0B2E31",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 18,
  },
  modalClose: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalIconRing: {
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
  },
  modalIconInner: {
    width: 110,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    position: "relative",
  },
  modalBadgeImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "transparent",
  },
  modalLockChip: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sparkleDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.7,
  },
  earnedPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  earnedPillText: { fontSize: 11, fontFamily: fonts.sansBold, letterSpacing: 0.3 },
  modalBadgeName: {
    ...typography.display,
    fontSize: 22,
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 28,
  },
  modalSpotRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  modalSpotText: { fontSize: 12, fontFamily: fonts.sansBold },
  modalDescription: {
    fontSize: 13,
    fontFamily: fonts.sans,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 10,
  },
  modalDescriptionFallback: {
    fontSize: 13,
    fontFamily: fonts.sans,
    textAlign: "center",
    lineHeight: 20,
    fontStyle: "italic",
    marginBottom: 10,
  },
  modalDateRow: { flexDirection: "row", alignItems: "center", marginTop: 2, marginBottom: 4 },
  modalDate:    { fontSize: 11, fontFamily: fonts.sansMedium },
  divider: {
    width: "100%",
    height: 1,
    marginVertical: 20,
  },
  modalButton: { alignSelf: "stretch" },
});