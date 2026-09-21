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
  ActivityIndicator,
  RefreshControl,
  Modal,
  StatusBar,
  Pressable,
} from "react-native";
import { showAlert } from "../components/AppAlert";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "@clerk/clerk-expo";
import { captureRef } from "react-native-view-shot";
import RNShare from "react-native-share";
import * as Haptics from "expo-haptics";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import { ScreenHeader } from "../components/ui";
import { BASE_URL } from "../api";
import { badgeImage } from "../utils/image";
import Icon from "../components/Icon";

const GRID_GAP = 16;
const H_GUTTER = 40; // total horizontal screen padding

// Columns scale with the viewport instead of being pinned at 3 — on a tablet or
// in split-screen the old fixed grid produced either giant cells or clipping.
const columnsFor = (w) => (w >= 900 ? 6 : w >= 600 ? 4 : 3);
const cardSizeFor = (w) => (w - H_GUTTER - GRID_GAP * (columnsFor(w) - 1)) / columnsFor(w);

// Self-contained fade-in wrapper — safe with FlatList recycling since each
// mounted cell owns its own Animated.Value instead of indexing into a shared
// array (which would replay stale values onto recycled/filtered cells).
function AnimatedCell({ children, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1, duration: 300, delay, useNativeDriver: true,
    }).start();
  }, []);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

const FILTERS = [
  { key: "all",     label: "All" },
  { key: "claimed",  label: "Claimed" },
  { key: "locked",   label: "Locked" },
];

export default function BadgeScreen() {
  const navigation   = useNavigation();
  const { getToken } = useAuth();
  const { colors, isDark } = useTheme();
  const { width: winWidth } = useWindowDimensions();
  const columns  = columnsFor(winWidth);
  const cardSize = cardSizeFor(winWidth);

  const [badges, setBadges]             = useState([]); // full catalog, each tagged with .claimed
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);
  const [filter, setFilter]             = useState("all");
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [modalVisible, setModalVisible]   = useState(false);
  const [sharing, setSharing]             = useState(false);

  const modalOpacity   = useRef(new Animated.Value(0)).current;
  const modalScale     = useRef(new Animated.Value(0.85)).current;
  const modalTranslate = useRef(new Animated.Value(40)).current;

  const shareCardRef = useRef(null);

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
    } catch (e) {
      console.warn("BadgeScreen load error:", e);
      setError("Could not load badges. Pull down to retry.");
    }
  };

  const initialLoad = async () => {
    setLoading(true);
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

  const visibleBadges = useMemo(() => {
    if (filter === "claimed") return badges.filter((b) => b.claimed);
    if (filter === "locked")  return badges.filter((b) => !b.claimed);
    return badges;
  }, [badges, filter]);

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

  const handleShare = async () => {
    if (!selectedBadge?.claimed || !shareCardRef.current) return;
    try {
      setSharing(true);

      // Give the hidden card a frame to render selectedBadge's image before
      // capture — avoids the classic "captured blank" race on Android when
      // the ref updates and captureRef fires in the same tick.
      await new Promise((r) => setTimeout(r, 50));

      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      await RNShare.open({
        title: `${selectedBadge.name} Badge`,
        url: uri,
        type: "image/png",
        message: `I just earned the "${selectedBadge.name}" badge on Libot! Discover Bulacan\'s history!`,
        failOnCancel: false,
      });
    } catch (e) {
      if (e?.message !== "User did not share") {
        console.warn("[Share] Failed:", e);
        showAlert("Error", "Could not prepare the badge image to share.");
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
          badge.claimed
            ? { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }
            : { backgroundColor: colors.backgroundSoft },
        ]}>
          <View style={styles.iconCircle}>
            {badge.image ? (
              <Image
                source={{ uri: badgeImage(badge.image, Math.round(cardSize)) }}
                style={[styles.badgeImage, !badge.claimed && styles.badgeImageLocked]}
                resizeMode="contain"
              />
            ) : (
              <Icon name="award" size={26} color={badge.claimed ? colors.brand : colors.textMuted} />
            )}
            {!badge.claimed && (
              <View style={[styles.lockOverlay, { backgroundColor: colors.overlay }]}>
                <Icon name="lock" size={16} color={colors.textInverse} />
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
            numberOfLines={2}
          >
            {badge.name}
          </Text>

          {badge.claimed ? (
            badge.claimedAt && (
              <Text style={[styles.claimedDate, { color: colors.textMuted }]}>
                {new Date(badge.claimedAt).toLocaleDateString("en-PH", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </Text>
            )
          ) : (
            <>
              <Text style={[styles.lockedSpot, { color: colors.textMuted }]} numberOfLines={1}>
                {badge.spotId?.name || "Unknown spot"}
              </Text>
              {typeof badge.points === "number" && badge.points > 0 && (
                <View style={[styles.ptsChip, { backgroundColor: colors.brandLight }]}>
                  <Icon name="star" size={9} color={colors.brand} />
                  <Text style={[styles.ptsChipText, { color: colors.brand }]}>+{badge.points}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    </AnimatedCell>
  ), [colors, cardSize]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading badges...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ── Hidden shareable badge card, captured as PNG ──
          Kept inside normal document bounds (top:0/left:0) rather than
          thousands of px offscreen — large negative offsets risk being
          culled or producing a blank/cropped capture on some Android
          renderers. opacity:0 + zIndex:-1 keeps it invisible and inert
          without moving it out of the measured viewport. */}
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={shareCardRef} style={styles.shareCard} collapsable={false}>
          {selectedBadge?.image && (
            <Image
              source={{ uri: selectedBadge.image }}
              style={styles.shareCardImage}
              resizeMode="contain"
            />
          )}
          <Text style={[styles.shareCardName, { color: colors.textPrimary }]}>{selectedBadge?.name}</Text>
          <Text style={[styles.shareCardSub, { color: colors.brand }]}>Libot · Bulacan Heritage Explorer</Text>
        </View>
      </View>

      <ScreenHeader
        title="Badges"
        onBack={() => navigation.goBack()}
        right={
          <View style={[styles.countBadge, { backgroundColor: colors.brandLight }]}>
            <Text style={[styles.countText, { color: colors.brandDark }]}>{claimedCount}/{badges.length}</Text>
          </View>
        }
      />

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
            {error && (
              <TouchableOpacity
                accessibilityRole="button" onPress={onRefresh} style={[styles.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                <Text style={[styles.retryText, { color: colors.danger }]}>Tap to retry</Text>
              </TouchableOpacity>
            )}

            {badges.length > 0 && (
              <View style={[styles.filterBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {FILTERS.map((f) => {
                  const count = f.key === "all" ? badges.length : f.key === "claimed" ? claimedCount : lockedCount;
                  const active = filter === f.key;
                  return (
                    <TouchableOpacity
                      accessibilityRole="button"
                      key={f.key}
                      onPress={() => setFilter(f.key)}
                      style={[styles.filterTab, active && { backgroundColor: colors.brand }]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.filterTabText, { color: active ? colors.textInverse : colors.textSecondary }]}>
                        {f.label} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !error && badges.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="award" size={52} color={colors.brand} style={styles.emptyIcon} />
              <Text style={[styles.emptyTitle, { color: colors.brandDark }]}>No badges yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Navigate to a historical spot and arrive to earn your first badge!
              </Text>
            </View>
          ) : !error && visibleBadges.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name={filter === "claimed" ? "target" : "check-circle"} size={52} color={colors.brand} style={styles.emptyIcon} />
              <Text style={[styles.emptyTitle, { color: colors.brandDark }]}>
                {filter === "claimed" ? "Nothing claimed yet" : "All badges unlocked!"}
              </Text>
            </View>
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
              accessibilityRole="button" style={[styles.modalClose, { backgroundColor: colors.card }]} onPress={closeBadge}>
              <Icon name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.modalIconRing}>
              <View style={styles.modalIconInner}>
                {selectedBadge?.image ? (
                  <Image
                    source={{ uri: selectedBadge.image }}
                    style={[styles.modalBadgeImage, !selectedBadge?.claimed && styles.badgeImageLocked]}
                    resizeMode="contain"
                  />
                ) : (
                  <Icon name="award" size={52} color={selectedBadge?.claimed ? colors.brand : colors.textMuted} />
                )}
                {!selectedBadge?.claimed && (
                  <View style={[styles.modalLockOverlay, { backgroundColor: colors.overlay }]}>
                    <Icon name="lock" size={30} color={colors.textInverse} />
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
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.shareButton, { backgroundColor: colors.accent }, sharing && { opacity: 0.7 }]}
                onPress={handleShare}
                activeOpacity={0.82}
                disabled={sharing}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={colors.onAccent} style={{ marginRight: 8 }} />
                ) : (
                  <Icon name="share-2" size={17} color={colors.onAccent} style={{ marginRight: 8 }} />
                )}
                <Text style={[styles.shareButtonText, { color: colors.onAccent }]}>
                  {sharing ? "Preparing..." : "Share This Badge"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.shareButton, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}
                onPress={closeBadge}
                activeOpacity={0.82}
              >
                <Icon name="map-pin" size={17} color={colors.brand} style={{ marginRight: 8 }} />
                <Text style={[styles.shareButtonText, { color: colors.brand }]}>Go Explore</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  centered:    { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: fonts.sansMedium },

  offscreen: {
    position: "absolute",
    top: 0,
    left: 0,
    opacity: 0,
    zIndex: -1,
  },
  shareCard: {
    width: 400,
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 40,
    backgroundColor: "transparent",
  },
  shareCardImage: {
    width: 200,
    height: 200,
    backgroundColor: "transparent",
  },
  // The shared image is the app's billboard — it goes out to Facebook and
  // Messenger, so it carries the serif.
  shareCardName: {
    ...typography.display,
    fontSize: 27,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 33,
  },
  shareCardSub: {
    fontSize: 14,
    marginTop: 8,
    fontFamily: fonts.sansSemi,
    letterSpacing: 0.3,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontFamily: fonts.sansBold },
  countBadge:  { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  countText:   { fontFamily: fonts.sansBold, fontSize: 13 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 15 },
  row: { justifyContent: "flex-start", gap: GRID_GAP, marginBottom: GRID_GAP },

  filterBar: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  filterTabText: { fontSize: 12, fontFamily: fonts.sansBold },

  errorBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: fonts.sansSemi, textAlign: "center" },
  retryText: { fontSize: 12, marginTop: 4 },

  emptyState:    { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyIcon:     { marginBottom: 14 },
  emptyTitle:    { fontSize: 18, fontFamily: fonts.sansBold, marginBottom: 6, textAlign: "center" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 19 },

  badgeWrapper: {},
  badgeCard: {
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    shadowColor: "#0B2E31",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 128,
  },
  iconCircle: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
    backgroundColor: "transparent",
  },
  badgeImage:       { width: 56, height: 56, backgroundColor: "transparent" },
  badgeImageLocked: { opacity: 0.3 },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  checkOverlay: {
    position: "absolute",
    bottom: -4,
    right: -4,
    borderRadius: 10,
  },
  badgeName: {
    fontSize: 10,
    fontFamily: fonts.sansSemi,
    textAlign: "center",
    lineHeight: 13,
  },
  claimedDate: {
    fontSize: 9,
    marginTop: 4,
    textAlign: "center",
  },
  lockedSpot: {
    fontSize: 9,
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
    marginTop: 4,
  },
  ptsChipText: { fontSize: 9, fontFamily: fonts.sansBold },

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
    shadowColor: "#2c1210",
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
    backgroundColor: "transparent",
  },
  modalLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 55,
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
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 10,
  },
  modalDescriptionFallback: {
    fontSize: 13,
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
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    shadowColor: "#0B2E31",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  shareButtonText: { fontSize: 15, fontFamily: fonts.sansBold, letterSpacing: 0.2 },
});