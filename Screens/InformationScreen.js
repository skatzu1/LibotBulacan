import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, TextInput,
  Modal, StatusBar, FlatList, useWindowDimensions, Keyboard, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ImageCropPicker from "react-native-image-crop-picker";
import * as Haptics from "expo-haptics";
import { showAlert, showToast } from "../components/AppAlert";
import { useUser } from "@clerk/clerk-expo";
import { useIsFocused } from "@react-navigation/native";
import { useBookmark } from "../context/BookmarkContext";
import { useReviews, MAX_REVIEW_PHOTOS } from "../context/ReviewContext";
import { useMissions } from "../context/MissionContext";
import { usePoints } from "../context/PointsContext";
import { useProfileImage } from "../context/ProfileImageContext";
// Icon, label and how-to per mission type (missionKind); colour is theme-driven (see ChecklistRow).
import { splitByTier, isMajor, isDoable, missionKind, ARRIVAL_KIND, ARRIVAL_POINTS } from "../utils/missionTiers";
import { useTheme, radius, shadow, fonts, typography, MAX_FONT_SCALE } from "../context/ThemeContext";
import ModelViewer from "../utils/ModelViewer";
import { ensureAtSpotForAR, spotHasAR } from "../utils/arLocationGate";
import { afterAlertCloses, ensureCameraAccess, explainPickerError } from "../utils/cameraAccess";
import Skeleton from "../components/Skeleton";
import KeyboardAvoider from "../components/KeyboardAvoider";
import usePullToRefresh from "../hooks/usePullToRefresh";
import { useLive } from "../utils/live";
import api from "../api";
import {
  PhotoScrim, Segmented, EmptyState, ErrorState, PrimaryButton, Avatar, SearchField, H_PAD, TAP,
} from "../components/ui";
import { spotImage, cdn, clerkPhoto, badgeImage } from "../utils/image";
import {
  REVIEW_SORTS, ratingBreakdown, filterAndSortReviews, pageOf, pageNumbers, timeAgo,
} from "../utils/reviewList";
import Icon from "../components/Icon";
import { BadgeShine } from "../components/BadgeEffects";


// Spot facts up to this many characters fit beside their label ("Malolos",
// "₱50", "0917 123 4567"); longer ones go on their own line under it.
const FACT_INLINE_MAX = 22;

// Reviews can't be reported from here any more (mock defense 2026-10-21): the
// server masks bad words with *** as a review is posted (LibotBackend
// utils/reviewFilter.js), and admins act on reviews in the console.

// How much longer a mute/suspension lasts, e.g. "3 days 4 hr" / "45 min".
// Returns null once the window has actually elapsed (shouldn't normally be
// shown at that point — the backend would no longer reject the request).
const formatTimeRemaining = (untilIso) => {
  if (!untilIso) return null;
  const ms = new Date(untilIso).getTime() - Date.now();
  if (!(ms > 0)) return null;

  const days = Math.floor(ms / 86400000);
  if (days >= 1) {
    const hours = Math.floor((ms % 86400000) / 3600000);
    return `${days} day${days === 1 ? "" : "s"}` + (hours > 0 ? ` ${hours} hr` : "");
  }
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) {
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours} hr${hours === 1 ? "" : "s"}` + (minutes > 0 ? ` ${minutes} min` : "");
  }
  return `${Math.max(1, Math.floor(ms / 60000))} min`;
};

const formatUntilDate = (untilIso) =>
  untilIso
    ? new Date(untilIso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

// Centralized helpers: figure out whether a failed action came back because
// the user is muted or suspended, and show a single consistent popup for it.
// `result.isMuted`/`result.isSuspended` (+ their *Until dates) come from
// ReviewContext's addReview, which re-fetches /api/reviews/user/moderation-status
// on a 403 and merges the fresh fields onto the returned result — the message
// substring checks are just a defensive fallback.
const isMutedResult = (result) =>
  !!result && (
    result.isMuted === true ||
    result.muted === true ||
    result.error === "muted" ||
    result.reason === "muted" ||
    (typeof result.message === "string" && result.message.toLowerCase().includes("mut"))
  );

const isSuspendedResult = (result) =>
  !!result && (
    result.isSuspended === true ||
    (typeof result.message === "string" && result.message.toLowerCase().includes("suspend"))
  );

const showMutedAlert = (result) => {
  const remaining = formatTimeRemaining(result?.commentMuteUntil);
  const until = formatUntilDate(result?.commentMuteUntil);
  showAlert(
    "You're Muted",
    remaining && until
      ? `You can't comment right now — commenting is disabled until ${until} (${remaining} remaining).`
      : (result && result.message) ||
        "An admin has muted you from posting or reacting for a while. Please try again later.",
    undefined,
    { tone: "warning", icon: "volume-x" },
  );
};

const showSuspendedAlert = (result) => {
  const remaining = formatTimeRemaining(result?.suspendedUntil);
  const until = formatUntilDate(result?.suspendedUntil);
  showAlert(
    "You're Suspended",
    remaining && until
      ? `You can't comment right now — your account is suspended until ${until} (${remaining} remaining).`
      : (result && result.message) ||
        "Your account is currently suspended from commenting.",
    undefined,
    { tone: "danger", icon: "slash" },
  );
};

// Reviews live at the foot of Overview rather than in a tab of their own: what
// a place is and what people thought of it are read together.
// A review longer than this folds behind "See more".
const REVIEW_FOLD_LINES = 5;

// The search / sort toolbar only earns its space once there's a list worth
// searching, and the visitor-photo strip only once it isn't just repeating
// the photos already shown in one or two review cards.
const REVIEW_TOOLS_FROM = 4;
const PHOTO_STRIP_FROM = 3;

// Small taps of feedback, the same calls the rest of the app uses. Silent
// where haptics aren't available.
const tapFeel     = () => { Haptics.selectionAsync().catch(() => {}); };
const successFeel = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };
const warnFeel    = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); };

// The 3D model has its own tab, in the middle (QA 2026-10-16). It used to be
// a small cube button in the header that swapped the photo for the model,
// which testers missed. Spots without a model get the two outer tabs. The
// tab shows the model where the photo is, in the hero (user, 2026-10-20),
// not in a second card further down.
const OVERVIEW_TAB = { key: "Overview",   label: "Overview",   icon: "book-open" };
const MODEL_TAB    = { key: "Model3D",    label: "3D Model",   icon: "cube-scan" };
const BUCKET_TAB   = { key: "BucketList", label: "Bakit List", icon: "flag"      };
const tabsFor = (spot) => (spot?.modelUrl ? [OVERVIEW_TAB, MODEL_TAB, BUCKET_TAB] : [OVERVIEW_TAB, BUCKET_TAB]);

// The server's limit (LibotBackend utils/textLimits.js); QA 2026-10-16 asked
// for 250, down from 500.
const REVIEW_MAX = 250;

/* ── Pieces of the screen ─────────────────────────────────────────────────
   These used to be declared INSIDE InformationScreen, which makes each one a
   brand-new component type on every render. Typing a single character in the
   review box re-rendered the screen, so React unmounted and remounted every
   review card — avatars reloaded, and a like that was mid-request lost its
   `reacting` state. At module level they keep their identity. */

function StarRating({ rating, size = 14, colors }) {
  return (
    <View style={styles.starsRow}>
      {/* Earned stars are filled, the rest are outlines. */}
      {[1, 2, 3, 4, 5].map((s) => (
        <Icon
          key={s}
          name="star"
          size={size}
          weight={s <= rating ? "fill" : "regular"}
          color={s <= rating ? colors.star : colors.starEmpty}
        />
      ))}
    </View>
  );
}

function CircleBtn({ icon, onPress, active, iconNode, colors, ...rest }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.circleBtn, { backgroundColor: active ? colors.accent : colors.card, borderColor: colors.cardBorder }]}
      hitSlop={4}
      {...rest}
    >
      {iconNode ?? <Icon name={icon} size={19} color={active ? colors.onAccent : colors.textPrimary} />}
    </TouchableOpacity>
  );
}

/* Full-screen photos, swiped sideways. Black in both themes: it's a photo
   viewer, and the photos are what should carry the colour. */
function PhotoViewer({ viewer, onClose }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(viewer?.index ?? 0);
  useEffect(() => { setIndex(viewer?.index ?? 0); }, [viewer]);
  if (!viewer) return null;
  const caption = viewer.photos[index]?.caption;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        <FlatList
          data={viewer.photos}
          keyExtractor={(p) => p.url}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={viewer.index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <Image
              source={{ uri: cdn(item.url, { width: 1200 }) }}
              style={{ width, height }}
              resizeMode="contain"
              accessibilityLabel={`Photo ${i + 1} of ${viewer.photos.length}${item.caption ? ` by ${item.caption}` : ""}`}
            />
          )}
        />
        <View style={[styles.viewerTop, { paddingTop: insets.top + 8 }]}>
          <View style={styles.viewerInfo}>
            <Text style={styles.viewerCount}>{index + 1} / {viewer.photos.length}</Text>
            {!!caption && <Text style={styles.viewerCaption} numberOfLines={1}>{caption}</Text>}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.viewerClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close photos"
          >
            <Icon name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ReviewCard({ review, spotId, clerkUser, profileImage, reactToReview, onDelete, onOpenPhoto, colors }) {
  const isMe = clerkUser?.id === review.clerkUserId;
  // No more pravatar.cc fallback — a reviewer without a photo gets their
  // initials, not a random stranger's face.
  const avatarUri = isMe ? (profileImage || review.userImage || clerkPhoto(clerkUser)) : review.userImage;
  const [reacting, setReacting] = useState(false);
  const [expanded, setExpanded] = useState(false);   // "See more" opened
  const [foldable, setFoldable] = useState(false);   // text runs past the fold

  // Prefer a locally-patched userReaction (set right after a react call,
  // and correctly captures "null" meaning removed). Fall back to
  // deriving it from the raw reactions array on freshly-fetched reviews.
  const userReaction = ("userReaction" in review)
    ? review.userReaction
    : (review.reactions || []).find((r) => r.clerkUserId === clerkUser?.id)?.type || null;

  const handleReact = async (type) => {
    if (isMe || reacting) return;
    setReacting(true);
    try {
      tapFeel();
      const result = await reactToReview(review._id, spotId, type);
      if (isMutedResult(result)) showMutedAlert(result);
    } catch (err) {
      if (isMutedResult(err)) showMutedAlert(err);
    } finally {
      setReacting(false);
    }
  };

  const author = review.userName || "Anonymous";
  const when = timeAgo(review.createdAt) || "Just now";

  // ⋮ — on your own review only: delete it (onDelete asks to confirm).
  const openMenu = () => onDelete(review);

  // "Helpful" / "Unhelpful" are the like / dislike reactions, named for what
  // they mean on a review. A render helper, not a component: a component
  // declared in here would be a new type every render and remount each time.
  const reaction = ({ type, icon, label, count, activeColor }) => {
    const on = userReaction === type;
    const tint = on ? activeColor : colors.textMuted;
    if (isMe) {
      return (
        <View style={styles.reactionBtn}>
          <Icon name={icon} size={14} color={colors.textMuted} />
          <Text style={[styles.reactionLabel, { color: colors.textMuted }]}>{label} ({count})</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        onPress={() => handleReact(type)}
        disabled={reacting}
        hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
        style={styles.reactionBtn}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`Mark this review ${label.toLowerCase()}, ${count} so far`}
      >
        <Icon name={icon} size={14} weight={on ? "fill" : "regular"} color={tint} />
        <Text style={[styles.reactionLabel, { color: on ? activeColor : colors.textSecondary }]}>
          {label} <Text style={{ color: tint }}>({count})</Text>
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.reviewHead}>
        <Avatar uri={avatarUri} name={author} size={32} />
        <Text style={[styles.reviewAuthor, { color: colors.textPrimary }]} numberOfLines={1}>
          By {author}{isMe ? <Text style={{ color: colors.textMuted, fontFamily: fonts.sansMedium }}> (you)</Text> : null}
        </Text>
        {isMe && (
          <TouchableOpacity
            onPress={openMenu}
            hitSlop={10}
            style={styles.reviewMenu}
            accessibilityRole="button"
            accessibilityLabel="Options for your review"
          >
            <Icon name="more-vertical" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Stars, when, and whether they were really there — one line. */}
      <View style={styles.reviewMeta}>
        <StarRating rating={review.rating} size={15} colors={colors} />
        <View style={[styles.metaDot, { backgroundColor: colors.textMuted }]} />
        <Text style={[styles.reviewDate, { color: colors.textMuted }]}>{when}</Text>
        {review.verifiedVisit && (
          <>
            <View style={[styles.metaDot, { backgroundColor: colors.textMuted }]} />
            <Icon name="check-circle" size={14} weight="fill" color={colors.success} />
            <Text style={[styles.reviewVerified, { color: colors.textSecondary }]}>Verified visit</Text>
          </>
        )}
      </View>

      {/* Long reviews fold at 5 lines with "See more", like Facebook. The
          toggle only appears once the text is measured as longer than that. */}
      <Text
        style={[styles.reviewComment, { color: colors.textSecondary }]}
        numberOfLines={expanded ? undefined : REVIEW_FOLD_LINES}
        onTextLayout={(e) => { if (!expanded && e.nativeEvent.lines.length > REVIEW_FOLD_LINES) setFoldable(true); }}
      >
        {review.comment}
      </Text>
      {foldable && (
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          hitSlop={8}
          style={styles.seeMore}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={[styles.seeMoreText, { color: colors.textPrimary }]}>{expanded ? "See less" : "See more"}</Text>
        </TouchableOpacity>
      )}

      {review.photos?.length > 0 && (
        <View style={styles.reviewPhotos}>
          {review.photos.map((p, i) => (
            <TouchableOpacity
              key={p.url}
              onPress={() => onOpenPhoto(review.photos.map((x) => ({ ...x, caption: author })), i)}
              activeOpacity={0.85}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${i + 1} of ${review.photos.length} from ${author}'s review`}
            >
              <Image
                source={{ uri: cdn(p.url, { width: 76, height: 76, crop: "fill" }) }}
                style={[styles.reviewPhoto, { backgroundColor: colors.backgroundSoft, borderColor: colors.cardBorder }]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* On your own review the counts can't be pressed, so they only show
          once someone has reacted. */}
      {!(isMe && !review.likes && !review.dislikes) && (
      <View style={styles.reviewFooterRow}>
        <View style={styles.reactionsRow}>
          {reaction({ type: "like",    icon: "thumbs-up",   label: "Helpful",   count: review.likes || 0,    activeColor: colors.brand })}
          {reaction({ type: "dislike", icon: "thumbs-down", label: "Unhelpful", count: review.dislikes || 0, activeColor: colors.danger })}
        </View>
      </View>
      )}
    </View>
  );
}

// One item of the Bakit List tab's checklist: a ticked or to-do icon, the
// title, one line (Done, or how to do it), the points. Must-dos (arriving, AR;
// utils/missionTiers.js) say so on that line.
function ChecklistRow({ item, colors }) {
  // `soon`: can't be done yet (a food spot nobody has pinned), so it doesn't
  // count toward the badge until it can.
  const line = item.done ? "Done"
    : item.soon ? "Coming soon · doesn't count yet"
    : item.mustDo ? `Must-do · ${item.how}` : item.how;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.points} points, ${line}`}
      style={[styles.checkRow, item.soon && !item.done && styles.checkRowSoon]}
      onPress={item.onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.checkIcon, { backgroundColor: item.done ? colors.successBg : item.soon ? colors.backgroundSoft : colors.brandLight }]}>
        <Icon
          name={item.done ? "check" : item.icon}
          size={19}
          color={item.done ? colors.success : item.soon ? colors.textMuted : colors.brand}
          weight={item.done ? "bold" : "regular"}
        />
      </View>
      <View style={styles.checkBody}>
        <Text style={[styles.checkTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.checkLine, { color: item.done ? colors.success : colors.textMuted }]} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <Text style={[styles.checkPts, { color: item.done ? colors.textMuted : colors.brand }]}>+{item.points}</Text>
      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function InformationScreen({ route, navigation }) {
  const paramSpot = route?.params?.spot;
  // A pull to refresh re-reads the spot; its fields go over the copy the
  // screen was opened with.
  const [freshSpot, setFreshSpot] = useState(null);
  const spot = useMemo(
    () => (paramSpot && freshSpot?._id === paramSpot._id ? { ...paramSpot, ...freshSpot } : paramSpot),
    [paramSpot, freshSpot]
  );
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Callers can deep-link to a specific tab (e.g. the Missions flow lands here
  // on the missions list rather than Overview).
  const tabs = tabsFor(spot);
  const initialTab = tabs.some((t) => t.key === route?.params?.tab) ? route.params.tab : "Overview";
  const [activeTab,        setActiveTab]        = useState(initialTab);
  const [newRating,        setNewRating]        = useState(0);
  const [newReview,        setNewReview]        = useState("");
  // The Facebook-style review box at the end of the reviews: focused while
  // the user is typing (it opens up).
  const [composerFocused,  setComposerFocused]  = useState(false);
  const [ratingNudge,      setRatingNudge]      = useState(false); // tried to send with no stars
  // The review list's search / sort / filters / page (see utils/reviewList).
  const [reviewQuery,      setReviewQuery]      = useState("");
  const [reviewSort,       setReviewSort]       = useState("recent");
  const [starFilter,       setStarFilter]       = useState(null);
  const [onlyWithPhotos,   setOnlyWithPhotos]   = useState(false);
  const [showSortMenu,     setShowSortMenu]     = useState(false);
  const [reviewPageIndex,  setReviewPageIndex]  = useState(0);
  const [reviewPhotos,     setReviewPhotos]     = useState([]);   // [{ uri, mime }] for the review being written
  const [viewer,           setViewer]           = useState(null); // { photos, index } while the full-screen viewer is open
  // This spot's reviews / missions couldn't be loaded (shown only while none are held).
  const [reviewsFailed,    setReviewsFailed]    = useState(false);
  const [missionsFailed,   setMissionsFailed]   = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  // Where the review list starts (inside the body) and where the body starts
  // (inside the scroll view), for paging back to the top of the list.
  const reviewsTopY = useRef(0);
  const bodyY = useRef(0);
  const { user: clerkUser } = useUser();
  const { isBookmarked, toggleBookmark } = useBookmark();
  const { getReviewsForSpot, hasReviewsFor, addReview, reactToReview, getAverageRating, getReviewCount, fetchReviews, deleteReview } = useReviews();
  const { fetchMissions, refetchMissions, getMissionsForSpot, hasMissionsFor, completedMissions } = useMissions();
  const { hasVisited, refresh: refreshPoints } = usePoints();
  const { profileImage } = useProfileImage();
  const isFocused = useIsFocused();
  // The model only renders while its tab is open and this screen is in front:
  // a Viro scene left running behind another screen keeps the GPU busy.
  const showing3D = activeTab === "Model3D" && !!spot?.modelUrl && isFocused;

  // The model is in the hero, at the top of the page; opening its tab from
  // further down (the tabs stick under the header) brings it into view.
  const selectTab = (key) => {
    setActiveTab(key);
    if (key === "Model3D") scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // The review box is the last thing on the page. When the keyboard opens
  // for it, scroll to the end so the box sits just above the keyboard
  // instead of under it. One beat first, for the KeyboardAvoider's padding:
  // the end of the page moves once the padding is in.
  useEffect(() => {
    if (!composerFocused) return undefined;
    let timer;
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      clearTimeout(timer);
      timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [composerFocused]);
  // "Arrive at the spot" is ticked from the visit logs, so re-read them when
  // the user comes back here — e.g. from navigating to the spot.
  useEffect(() => { if (isFocused) refreshPoints(); }, [isFocused, refreshPoints]);
  // The page opens at once with the spot it was handed; its reviews and
  // missions load into their own sections. The whole page used to wait for
  // both behind a skeleton — on a slow signal, up to a minute of nothing.
  useEffect(() => {
    if (!spot?._id) return undefined;
    let live = true;
    setReviewsFailed(false);
    setMissionsFailed(false);
    fetchReviews(spot._id).then((ok) => { if (live) setReviewsFailed(!ok); });
    fetchMissions(spot._id).then((ok) => { if (live) setMissionsFailed(ok === false); });
    return () => { live = false; };
  }, [spot?._id]);

  const retryReviews = () => {
    setReviewsFailed(false);
    fetchReviews(spot._id).then((ok) => setReviewsFailed(!ok));
  };
  const retryMissions = () => {
    setMissionsFailed(false);
    refetchMissions(spot._id).then((ok) => setMissionsFailed(!ok));
  };

  // Pull to refresh: the spot itself (an admin may have edited it), its
  // reviews and missions, and the visit log behind "Arrive at the spot". Off
  // on the 3D Model tab: dragging down on the model turns it, and at the top
  // of the page the pull would take that drag instead.
  const reloadSpotPage = useCallback(async () => {
    const id = paramSpot?._id;
    if (!id) return;
    await Promise.allSettled([
      api.get(`/api/spots/${id}`).then((res) => {
        if (res.data?.success && res.data.spot) setFreshSpot(res.data.spot);
      }),
      fetchReviews(id).then((ok) => setReviewsFailed(!ok)),
      refetchMissions(id).then((ok) => setMissionsFailed(!ok)),
      refreshPoints(),
    ]);
  }, [paramSpot?._id, fetchReviews, refetchMissions, refreshPoints]);
  const { refreshControl } = usePullToRefresh(reloadSpotPage, { enabled: activeTab !== "Model3D" });

  // Live (utils/live.js): other travelers' reviews and likes as they come,
  // and an admin's edit to this spot. What's shown stays if a request fails.
  useLive(["reviews"], () => { if (paramSpot?._id) fetchReviews(paramSpot._id); });
  useLive(["spots"], () => {
    const id = paramSpot?._id;
    if (!id) return;
    api.get(`/api/spots/${id}`)
      .then((res) => { if (res.data?.success && res.data.spot) setFreshSpot(res.data.spot); })
      .catch(() => {});
  });

  const header = (right) => (
    <View style={[styles.header, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) + 6, borderBottomColor: colors.divider }]}>
      <CircleBtn icon="chevron-left" onPress={() => navigation.goBack()} accessibilityLabel="Go back" colors={colors} />
      <Text
        style={[styles.headerTitle, { color: colors.textPrimary }]}
        numberOfLines={1}
        accessibilityRole="header"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      >
        {spot?.name}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );

  if (!spot) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header(null)}
      <View style={styles.missingWrap}>
        <EmptyState
          icon="compass"
          title="Spot not found"
          text="We couldn't open this place. Go back and try again."
          action={<PrimaryButton title="Go back" onPress={() => navigation.goBack()} style={styles.missingBtn} />}
        />
      </View>
    </View>
  );

  const spotIsBookmarked = isBookmarked(spot._id || spot.id);
  const reviews          = getReviewsForSpot(spot._id);
  const reviewsLoaded    = hasReviewsFor(spot._id);
  const missionsLoaded   = hasMissionsFor(spot._id);
  // The spot list's figures until this page's own fetch of the reviews lands.
  const averageRating    = getAverageRating(spot._id, spot.ratingAvg) || "0.0";
  const reviewCount      = getReviewCount(spot._id, spot.ratingCount);
  // Every photo travelers attached to their reviews, newest review first,
  // each labelled with who took it.
  const visitorPhotos    = reviews.flatMap((r) => (r.photos || []).map((p) => ({ ...p, caption: r.userName || "Anonymous" })));
  const breakdown        = ratingBreakdown(reviews);
  const shownReviews     = filterAndSortReviews(reviews, { query: reviewQuery, sort: reviewSort, stars: starFilter, withPhotos: onlyWithPhotos });
  const reviewPage       = pageOf(shownReviews, reviewPageIndex);
  const sortLabel        = (REVIEW_SORTS.find((o) => o.key === reviewSort) || REVIEW_SORTS[0]).label;
  // One review per spot (the server refuses a second): once you've written
  // yours, a note takes the review box's place.
  const hasMyReview      = !!clerkUser?.id && reviews.some((r) => r.clerkUserId === clerkUser.id);
  // The review box opens up while in use or holding a draft.
  const composerOpen     = composerFocused || !!newReview || newRating > 0 || reviewPhotos.length > 0;
  const missions         = getMissionsForSpot(spot._id);
  // Hierarchy: arriving + AR are must-dos and come first, then the AI scan and
  // the eatery (utils/missionTiers). Arriving isn't a Mission document, so it's
  // counted in by hand.
  const isDoneMission    = (m) => !!completedMissions?.includes(m._id);
  const arrived          = hasVisited(spot._id);
  const tiers            = splitByTier(missions);
  // Finishing every mission here earns the spot's badge (2026-10-21); one that
  // can't be done yet — a food spot nobody has pinned — is listed but doesn't
  // count (utils/missionTiers.js isDoable, the server's rule).
  const countedMissions  = missions.filter((m) => isDoable(m, spot));
  const completedCount   = (arrived ? 1 : 0) + countedMissions.filter(isDoneMission).length;
  const totalCount       = 1 + countedMissions.length;
  const progressRatio    = completedCount / totalCount;
  const arMission        = missions.find((m) => m.type === "ar");
  const hasAR            = spotHasAR(spot);

  const cityText = spot.city || spot.address || "Bulacan, Philippines";

  // Only facts the spot actually has. Missing hours used to read
  // "6:00 AM – 10:00 PM", a missing fee "Free" and missing contact "N/A" —
  // invented details a visitor could plan a trip around.
  const facts = [
    { icon: "clock",   label: "Visiting hours", value: spot.visitingHours },
    { icon: "tag",     label: "Entrance fee",   value: spot.entranceFee, stacked: true },
    // Always under its label, like long visiting hours, however short.
    { icon: "map-pin", label: "Location",       value: cityText, stacked: true },
    { icon: "phone",   label: "Contact",        value: spot.contact },
  ].filter((row) => !!row.value);

  // The camera icon in the review box, like Facebook's: one tap, then where
  // the photo comes from.
  const pickPhotoSource = () => {
    showAlert("Add a photo", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Camera",  onPress: () => addPhotos("camera") },
      { text: "Gallery", onPress: () => addPhotos("gallery") },
    ]);
  };

  const chooseRating = (s) => { tapFeel(); setNewRating(s); setRatingNudge(false); };

  // Send with text but no stars: point at the stars instead of failing.
  const sendReview = () => {
    if (newRating === 0) { warnFeel(); setRatingNudge(true); return; }
    handleSubmit();
  };

  // "Write the first review" (no reviews yet): jump to the box and open it.
  const startReview = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    setTimeout(() => inputRef.current?.focus(), 250);
  };

  // A new page starts at the top of the list, not wherever the pager was.
  const goToReviewPage = (n) => {
    setReviewPageIndex(n);
    // Less the sticky tab bar, so the first review isn't hidden under it.
    scrollRef.current?.scrollTo({ y: Math.max(0, bodyY.current + reviewsTopY.current - 76), animated: true });
  };

  // Shrunk on the phone before upload: a 12 MP original is 4–6 MB, this is a
  // few hundred KB and still sharp full-screen.
  const PHOTO_PICK = {
    mediaType: "photo",
    compressImageMaxWidth: 1600,
    compressImageMaxHeight: 1600,
    compressImageQuality: 0.8,
    forceJpg: true,
  };

  // Opened from the Camera / Gallery choice, which is an AppAlert: wait for it
  // to close, and for the camera, make sure the app may use it. A refused
  // camera or photo permission is explained with a way to Settings
  // (utils/cameraAccess.js).
  const addPhotos = async (source) => {
    const room = MAX_REVIEW_PHOTOS - reviewPhotos.length;
    if (room <= 0) return;
    try {
      await afterAlertCloses();
      if (source === "camera" && !(await ensureCameraAccess("to take a photo for your review"))) return;
      const picked = source === "camera"
        ? [await ImageCropPicker.openCamera(PHOTO_PICK)]
        // maxFiles is honoured on iOS only, hence the slice below.
        : await ImageCropPicker.openPicker({ ...PHOTO_PICK, multiple: true, maxFiles: room });
      const list = (Array.isArray(picked) ? picked : [picked])
        .filter((p) => p?.path)
        .map((p) => ({ uri: p.path, mime: p.mime || "image/jpeg" }));
      if (list.length > room) {
        list.slice(room).forEach((p) => ImageCropPicker.cleanSingle(p.uri).catch(() => {}));
        showToast(`A review can have ${MAX_REVIEW_PHOTOS} photos. Kept the first ${room}.`, { type: "info" });
      }
      setReviewPhotos((prev) => [...prev, ...list.slice(0, room)]);
    } catch (err) {
      if (err?.code !== "E_PICKER_CANCELLED") console.error("[Review] photo pick error:", err);
      explainPickerError(err);
    }
  };

  const removePhoto = (i) => {
    setReviewPhotos((prev) => {
      const gone = prev[i];
      if (gone) ImageCropPicker.cleanSingle(gone.uri).catch(() => {});
      return prev.filter((_, j) => j !== i);
    });
  };

  const openPhotos = (photos, index) => setViewer({ photos, index });

  // Any change to what's listed goes back to page 1. Done in the handlers
  // rather than an effect: this component returns early above, so a hook
  // down here would break the rules of hooks.
  const changeReviewFilter = (setter, value) => { setter(value); setReviewPageIndex(0); };
  const clearReviewFilters = () => {
    setReviewQuery(""); setStarFilter(null); setOnlyWithPhotos(false); setReviewPageIndex(0);
  };

  const confirmDeleteReview = (review) => {
    showAlert("Delete your review?", "Your review and its photos will be removed. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const ok = await deleteReview(review._id, spot._id);
          showToast(ok ? "Review deleted." : "Couldn't delete the review. Please try again.", { type: ok ? "success" : "error" });
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    if (newRating === 0 || newReview.trim() === "" || submittingReview) return;

    setSubmittingReview(true);
    try {
      const result = await addReview(spot._id, newRating, newReview.trim(), reviewPhotos);
      // Suspended or muted: put the keyboard away (they can't post) before the alert.
      if (isSuspendedResult(result)) {
        inputRef.current?.blur();
        showSuspendedAlert(result);
        return;
      }
      if (isMutedResult(result)) {
        inputRef.current?.blur();
        showMutedAlert(result);
        return;
      }
      // Only visitors can review. The box is hidden until the visit is logged,
      // so this is a visit logged elsewhere being out of date here.
      if (result?.notVisited) {
        inputRef.current?.blur();
        refreshPoints();
        showAlert("Visit this spot first", result.message);
        return;
      }
      // One review per spot. The reloaded list now shows theirs; the draft is
      // kept, so it's still there if they delete the old review to post this.
      if (result?.alreadyReviewed) {
        inputRef.current?.blur();
        showAlert("You've already reviewed this spot", "To change your review, delete it from its ⋮ menu, then write a new one.");
        return;
      }
      // Any other failure leaves the box as it is, so the text isn't lost.
      if (result && result.success === false) {
        showAlert("Error", result.message || "Failed to post your review. Please try again.");
        return;
      }
      // The compressed copies the picker made are uploaded now; free the space.
      reviewPhotos.forEach((p) => ImageCropPicker.cleanSingle(p.uri).catch(() => {}));
      setNewRating(0); setNewReview(""); setReviewPhotos([]); setRatingNudge(false);
      inputRef.current?.blur();
      successFeel();
      showToast("Review posted. Thanks for sharing!", { type: "success" });
    } catch (err) {
      if (isSuspendedResult(err)) {
        inputRef.current?.blur();
        showSuspendedAlert(err);
      } else if (isMutedResult(err)) {
        inputRef.current?.blur();
        showMutedAlert(err);
      } else {
        showAlert("Error", "Failed to post your review. Please try again.");
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  // BookmarkContext re-renders this screen on its own, and says "Saved" or
  // "Removed" in a toast. This used to bump a `key` on the whole screen to
  // force a refresh, which remounted everything and threw the user back to
  // the top of a long review list.
  const handleBookmarkToggle = () => toggleBookmark(spot);

  const handleLaunchAR = async () => {
    // AR models are anchored to real places at the spot: away from it, AR
    // doesn't open (the alert offers directions instead). Then the camera.
    if (!(await ensureAtSpotForAR(spot, { onDirections: () => navigation.navigate("Track", { spot }) }))) return;
    await afterAlertCloses();
    if (!(await ensureCameraAccess("for AR View"))) return;
    navigation.navigate("ar", { spot, arMissionId: arMission?._id ?? null });
  };

  const openMission = (mission) => {
    if (mission.type === "ar") handleLaunchAR();
    else if (mission.type === "location") navigation.navigate("LocationMission", { spot, mission });
    else navigation.navigate("Mission", { spot, mission });
  };

  // The Bakit List tab: arriving, the must-dos, then the rest (ChecklistRow).
  const checklist = [
    {
      key: "arrive", ...ARRIVAL_KIND, title: `Arrive at ${spot.name}`, points: ARRIVAL_POINTS,
      done: arrived, mustDo: true, onPress: () => navigation.navigate("Track", { spot }),
    },
    ...[...tiers.major, ...tiers.minor].map((m) => ({
      key: String(m._id), ...missionKind(m), title: m.title, points: m.points ?? 0,
      done: isDoneMission(m), mustDo: isMajor(m), soon: !isDoable(m, spot), onPress: () => openMission(m),
    })),
  ];
  const allDone = missionsLoaded && completedCount === totalCount;

  return (
    <KeyboardAvoider style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {header(
        <>
          <CircleBtn
            colors={colors}
            accessibilityLabel={spotIsBookmarked ? "Remove bookmark" : "Bookmark this spot"}
            accessibilityState={{ selected: spotIsBookmarked }}
            onPress={handleBookmarkToggle}
            active={spotIsBookmarked}
            iconNode={<Icon name="bookmark" size={17} weight={spotIsBookmarked ? "fill" : "regular"} color={spotIsBookmarked ? colors.onAccent : colors.textPrimary} />}
          />
        </>
      )}

      <ScrollView
        ref={scrollRef}
        refreshControl={refreshControl}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
      >
        {/* [0] Hero */}
        <View style={styles.heroWrap}>
          <View style={[styles.heroCard, { backgroundColor: colors.card }, shadow.md]}>
            {/* The 3D Model tab turns the photo into the model, in the same
                place. It only mounts while that tab is open (see showing3D). */}
            {showing3D ? (
              <ModelViewer url={spot.modelUrl} style={styles.heroImage} />
            ) : (
              <Image source={{ uri: spotImage(spot.image, 400, 260) }} style={styles.heroImage} resizeMode="cover" />
            )}
            {/* Over the model the scrim only needs to back the caption; from
                halfway down it would dim the lower half of the model. */}
            <PhotoScrim from={showing3D ? 0.72 : 0.5} />
            {reviewCount > 0 && (
              <View style={styles.heroRating}>
                <Icon name="star" size={13} color={colors.accent} weight="fill" />
                <Text style={styles.heroRatingText}>{averageRating}</Text>
                <Text style={styles.heroRatingCount}>({reviewCount})</Text>
              </View>
            )}
            <View style={styles.heroCaption} pointerEvents="none">
              <Icon name="map-pin" size={12} color="#fff" />
              <Text style={styles.heroCaptionText} numberOfLines={1}>{cityText}</Text>
            </View>
          </View>
        </View>

        {/* [1] Sticky tabs */}
        <View style={[styles.segmentWrap, { backgroundColor: colors.background }]}>
          <Segmented
            options={tabs}
            value={activeTab}
            onChange={selectTab}
          />
        </View>

        {/* [2] Body */}
        <View style={styles.bodyPad} onLayout={(e) => { bodyY.current = e.nativeEvent.layout.y; }}>
          <Text style={[styles.title, { color: colors.textPrimary }]} accessibilityRole="header">{spot.name}</Text>

          {/* What you came here to do, right under the name, on both tabs —
              like Directions on a map app's place page. It used to float over
              the bottom of the screen and sat on top of the reviews. Navigate
              alone for Nature and Festivals spots, which have no AR. */}
          <View style={styles.actionRow}>
            <PrimaryButton
              title="Navigate"
              icon="navigation"
              onPress={() => navigation.navigate("Track", { spot })}
              accessibilityLabel={`Navigate to ${spot.name}`}
              style={styles.actionBtn}
            />
            {hasAR && (
              <PrimaryButton
                variant="secondary"
                title="AR View"
                icon="aperture"
                onPress={handleLaunchAR}
                accessibilityLabel={`Open ${spot.name} in AR`}
                style={styles.actionBtn}
              />
            )}
          </View>

          {activeTab === "Overview" && (
            <>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>About</Text>
              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                {spot.description || "No description for this place yet."}
              </Text>

              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {facts.map((row, i) => {
                  // A short value sits on the right of its label. A long one
                  // ("9:00 a.m. to 4:00 p.m., Tuesday to Sunday…") gets its own
                  // full-width line under the label, all of it: squeezed into
                  // the right column at two lines it was cut off mid-word.
                  // A row marked `stacked` (Location) always goes underneath.
                  const long = row.stacked || String(row.value).length > FACT_INLINE_MAX;
                  return (
                    <React.Fragment key={row.label}>
                      <View style={[styles.infoRow, long && styles.infoRowLong]} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
                        <View style={[styles.infoIcon, { backgroundColor: colors.brandLight }]}>
                          <Icon name={row.icon} size={14} color={colors.brand} />
                        </View>
                        {long ? (
                          <View style={styles.infoStack}>
                            <Text style={[styles.infoLabel, styles.infoLabelStacked, { color: colors.textMuted }]}>{row.label}</Text>
                            <Text style={[styles.infoValue, styles.infoValueStacked, { color: colors.textPrimary }]}>{row.value}</Text>
                          </View>
                        ) : (
                          <>
                            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{row.label}</Text>
                            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{row.value}</Text>
                          </>
                        )}
                      </View>
                      {i < facts.length - 1 && <View style={[styles.infoDivider, { backgroundColor: colors.cardBorder }]} />}
                    </React.Fragment>
                  );
                })}
              </View>

              {/* ── Rate and Review (the paper's name for it, mock defense 2026-10-21) ── */}
              <View style={styles.rrHeading}>
                <Icon name="star" size={18} color={colors.textPrimary} />
                <Text style={[styles.sectionHeading, styles.rrHeadingText, { color: colors.textPrimary }]} accessibilityRole="header">
                  Rate and Review
                </Text>
              </View>

              {/* Until this spot's reviews are in: a placeholder, or a retry
                  when they couldn't be loaded — never "No reviews yet" for
                  reviews that are only slow to arrive. */}
              {!reviewsLoaded ? (
                reviewsFailed ? (
                  <ErrorState text="Couldn't load the reviews. Check your connection." onRetry={retryReviews} />
                ) : (
                  <View accessible accessibilityLabel="Loading reviews">
                    <Skeleton width="100%" height={120} radius={radius.card} style={styles.reviewsSkeleton} />
                    <Skeleton width="100%" height={88} radius={radius.card} />
                  </View>
                )
              ) : (
              <>
              {/* No reviews: an invitation instead of "–" and five empty bars;
                  tapping it jumps to the review box below. Otherwise the
                  average on the left and the 5→1 breakdown on the right — a
                  bar is also a filter: tap it to see only that rating. */}
              {reviewCount === 0 ? (
                <TouchableOpacity
                  onPress={arrived ? startReview : undefined}
                  disabled={!arrived}
                  activeOpacity={0.85}
                  style={[styles.firstReview, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  accessibilityRole={arrived ? "button" : undefined}
                  accessibilityLabel={arrived ? "No reviews yet. Write the first review." : "No reviews yet."}
                >
                  <View style={[styles.firstReviewIcon, { backgroundColor: colors.brandLight }]}>
                    <Icon name="star" size={22} color={colors.brand} />
                  </View>
                  <View style={styles.firstReviewText}>
                    <Text style={[styles.firstReviewTitle, { color: colors.textPrimary }]}>No reviews yet</Text>
                    <Text style={[styles.firstReviewSub, { color: colors.textSecondary }]}>
                      {arrived
                        ? "You've been here. Be the first to tell the next visitor what it was like."
                        : "Reviews here come from travelers who visited with Libot Bulacan."}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
              <View style={[styles.ratingSummary, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.ratingLeft}>
                  <Text style={[styles.ratingBig, { color: colors.textPrimary }]}>{reviewCount > 0 ? averageRating : "–"}</Text>
                  <Text style={[styles.reviewCountText, { color: colors.textMuted }]}>
                    {reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}` : "No ratings yet"}
                  </Text>
                  <StarRating rating={Math.round(parseFloat(averageRating))} size={14} colors={colors} />
                </View>
                <View style={styles.ratingBars}>
                  {breakdown.map((row) => {
                    const on = starFilter === row.stars;
                    return (
                      <TouchableOpacity
                        key={row.stars}
                        onPress={() => changeReviewFilter(setStarFilter, on ? null : row.stars)}
                        disabled={row.count === 0 && !on}
                        style={[styles.barRow, on && { backgroundColor: colors.brandLight }]}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on, disabled: row.count === 0 && !on }}
                        accessibilityLabel={`${row.stars} stars: ${row.count} ${row.count === 1 ? "review" : "reviews"}, ${row.percent} percent. ${on ? "Showing only these; tap to show all." : "Tap to show only these."}`}
                      >
                        <Text style={[styles.barStars, { color: colors.textSecondary }]}>{row.stars}</Text>
                        <Icon name="star" size={11} weight="fill" color={colors.star} />
                        <View style={[styles.barTrack, { backgroundColor: colors.brandLight }]}>
                          <View style={[styles.barFill, { width: `${row.percent}%`, backgroundColor: colors.brand }]} />
                        </View>
                        <Text style={[styles.barPct, { color: colors.textMuted }]}>{row.percent}%</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              )}

              {visitorPhotos.length >= PHOTO_STRIP_FROM && (
                <>
                  <Text style={[styles.photoStripLabel, { color: colors.textSecondary }]}>
                    Visitor photos ({visitorPhotos.length})
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.photoStrip}
                    contentContainerStyle={styles.photoStripContent}
                  >
                    {visitorPhotos.map((p, i) => (
                      <TouchableOpacity
                        key={p.url}
                        onPress={() => openPhotos(visitorPhotos, i)}
                        activeOpacity={0.85}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={`Visitor photo ${i + 1} of ${visitorPhotos.length}, by ${p.caption}`}
                      >
                        <Image
                          source={{ uri: cdn(p.url, { width: 112, height: 112, crop: "fill" }) }}
                          style={[styles.stripPhoto, { backgroundColor: colors.backgroundSoft }]}
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {reviews.length > 0 && (
                <>
                  {/* Search + sort + "with photos" — only once there are enough
                      reviews to be worth searching. */}
                  {reviews.length >= REVIEW_TOOLS_FROM && (
                  <>
                    <SearchField
                      value={reviewQuery}
                      onChangeText={(v) => changeReviewFilter(setReviewQuery, v)}
                      onClear={() => changeReviewFilter(setReviewQuery, "")}
                      placeholder="Search a specific review…"
                      style={styles.reviewSearch}
                    />
                    <View style={styles.reviewToolbar}>
                      <TouchableOpacity
                        onPress={() => setShowSortMenu((v) => !v)}
                        style={[styles.toolChip, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: showSortMenu }}
                        accessibilityLabel={`Sort reviews, currently ${sortLabel}`}
                        activeOpacity={0.8}
                      >
                        <Icon name="sliders" size={15} color={colors.textSecondary} />
                        <Text style={[styles.toolChipText, { color: colors.textPrimary }]}>Sort: {sortLabel}</Text>
                        <Icon name="chevron-down" size={14} color={colors.textSecondary} style={showSortMenu ? styles.chevronUp : undefined} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => changeReviewFilter(setOnlyWithPhotos, !onlyWithPhotos)}
                        style={[
                          styles.toolChip,
                          onlyWithPhotos
                            ? { backgroundColor: colors.brand, borderColor: colors.brand }
                            : { backgroundColor: colors.card, borderColor: colors.cardBorder },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: onlyWithPhotos }}
                        accessibilityLabel="Only reviews with photos"
                        activeOpacity={0.8}
                      >
                        <Icon name="image" size={15} color={onlyWithPhotos ? colors.onBrand : colors.textSecondary} />
                        <Text style={[styles.toolChipText, { color: onlyWithPhotos ? colors.onBrand : colors.textPrimary }]}>With photos</Text>
                      </TouchableOpacity>
                    </View>

                    {showSortMenu && (
                      <View style={[styles.sortMenu, { backgroundColor: colors.card, borderColor: colors.cardBorder }, shadow.md]} accessibilityRole="menu">
                        {REVIEW_SORTS.map((o) => {
                          const on = o.key === reviewSort;
                          return (
                            <TouchableOpacity
                              key={o.key}
                              onPress={() => { changeReviewFilter(setReviewSort, o.key); setShowSortMenu(false); }}
                              style={styles.sortOption}
                              accessibilityRole="menuitem"
                              accessibilityState={{ selected: on }}
                            >
                              <Text style={[styles.sortOptionText, { color: on ? colors.brand : colors.textPrimary, fontFamily: on ? fonts.sansBold : fonts.sans }]}>
                                {o.label}
                              </Text>
                              {on && <Icon name="check" size={16} color={colors.brand} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                  )}

                  {(starFilter || onlyWithPhotos || reviewQuery.trim()) && (
                    <View style={styles.filterNote}>
                      <Text style={[styles.filterNoteText, { color: colors.textMuted }]}>
                        {shownReviews.length} of {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                        {starFilter ? ` · ${starFilter}-star` : ""}
                        {onlyWithPhotos ? " · with photos" : ""}
                      </Text>
                      <TouchableOpacity
                        onPress={clearReviewFilters}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Clear review filters"
                      >
                        <Text style={[styles.filterClear, { color: colors.brand }]}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View onLayout={(e) => { reviewsTopY.current = e.nativeEvent.layout.y; }}>
                    {shownReviews.length === 0 ? (
                      <EmptyState icon="search" text="No reviews match. Try another word, or clear the filters." />
                    ) : (
                      reviewPage.items.map((review) => (
                        <ReviewCard
                          key={review._id}
                          review={review}
                          spotId={spot._id}
                          clerkUser={clerkUser}
                          profileImage={profileImage}
                          reactToReview={reactToReview}
                          onDelete={confirmDeleteReview}
                          onOpenPhoto={openPhotos}
                          colors={colors}
                        />
                      ))
                    )}
                  </View>

                  {reviewPage.pageCount > 1 && (
                    <View style={styles.pager} accessibilityRole="tablist" accessibilityLabel="Review pages">
                      <TouchableOpacity
                        onPress={() => goToReviewPage(reviewPage.page - 1)}
                        disabled={reviewPage.page === 0}
                        style={[styles.pagerArrow, { backgroundColor: colors.backgroundSoft }, reviewPage.page === 0 && styles.pagerOff]}
                        accessibilityRole="button"
                        accessibilityLabel="Previous page"
                      >
                        <Icon name="chevron-left" size={18} color={colors.textPrimary} />
                      </TouchableOpacity>
                      <View style={styles.pagerNumbers}>
                        {pageNumbers(reviewPage.page, reviewPage.pageCount).map((n, i) => (
                          n === null ? (
                            <Text key={`gap${i}`} style={[styles.pagerGap, { color: colors.textMuted }]}>…</Text>
                          ) : (
                            <TouchableOpacity
                              key={n}
                              onPress={() => goToReviewPage(n)}
                              style={[styles.pagerNum, n === reviewPage.page && { backgroundColor: colors.brandLight }]}
                              accessibilityRole="tab"
                              accessibilityState={{ selected: n === reviewPage.page }}
                              accessibilityLabel={`Page ${n + 1} of ${reviewPage.pageCount}`}
                            >
                              <Text style={[styles.pagerNumText, { color: n === reviewPage.page ? colors.brand : colors.textSecondary }]}>{n + 1}</Text>
                            </TouchableOpacity>
                          )
                        ))}
                      </View>
                      <TouchableOpacity
                        onPress={() => goToReviewPage(reviewPage.page + 1)}
                        disabled={reviewPage.page >= reviewPage.pageCount - 1}
                        style={[styles.pagerArrow, { backgroundColor: colors.backgroundSoft }, reviewPage.page >= reviewPage.pageCount - 1 && styles.pagerOff]}
                        accessibilityRole="button"
                        accessibilityLabel="Next page"
                      >
                        <Icon name="chevron-right" size={18} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* Already reviewed: one review per spot, so a note instead of
                  the box. Deleting the review brings the box back. */}
              {hasMyReview && (
                <View style={[styles.fbComposer, styles.fbDone, { borderTopColor: colors.divider }]}>
                  <Avatar
                    uri={profileImage || clerkPhoto(clerkUser)}
                    name={clerkUser?.fullName || clerkUser?.firstName}
                    size={36}
                  />
                  <View style={styles.fbDoneText}>
                    <Text style={[styles.fbDoneTitle, { color: colors.textPrimary }]}>You've reviewed this spot</Text>
                    <Text style={[styles.fbDoneSub, { color: colors.textSecondary }]}>
                      One review per spot. To change yours, delete it from its ⋮ menu, then write a new one.
                    </Text>
                  </View>
                </View>
              )}

              {/* Not been here yet: the reviews above can be read, but only
                  travelers who visited can write one (QA 2026-10-16; the
                  server refuses it too). Arriving opens the box. */}
              {!hasMyReview && !arrived && (
                <View style={[styles.fbComposer, styles.fbDone, { borderTopColor: colors.divider }]}>
                  <View style={[styles.visitIcon, { backgroundColor: colors.brandLight }]}>
                    <Icon name="map-pin" size={18} color={colors.brand} />
                  </View>
                  <View style={styles.fbDoneText}>
                    <Text style={[styles.fbDoneTitle, { color: colors.textPrimary }]}>Visit to write a review</Text>
                    <Text style={[styles.fbDoneSub, { color: colors.textSecondary }]}>
                      Only travelers who have been to {spot.name} with Libot Bulacan can review it.
                      Arrive there and the review box opens here.
                    </Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("Track", { spot })}
                      hitSlop={8}
                      style={styles.visitLink}
                      accessibilityRole="button"
                      accessibilityLabel={`Get directions to ${spot.name}`}
                    >
                      <Text style={[styles.visitLinkText, { color: colors.brand }]}>Get directions</Text>
                      <Icon name="chevron-right" size={15} color={colors.brand} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Write a review, Facebook-comment style: your avatar and a
                  rounded box with a camera icon. It opens up (stars, photo
                  thumbnails, send) once you tap in or start. */}
              {!hasMyReview && arrived && (
              <View style={[styles.fbComposer, { borderTopColor: colors.divider }]}>
                {composerOpen && (
                  <View style={styles.fbRateRow}>
                    <Text style={[styles.fbRateLabel, { color: ratingNudge ? colors.danger : colors.textSecondary }]}>
                      {ratingNudge ? "Tap a star to rate first" : "Your rating"}
                    </Text>
                    <View style={styles.fbStars} accessibilityRole="radiogroup" accessibilityLabel="Your rating">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <TouchableOpacity
                          key={s}
                          onPress={() => chooseRating(s)}
                          hitSlop={6}
                          accessibilityRole="radio"
                          accessibilityLabel={`${s} out of 5 stars`}
                          accessibilityState={{ checked: s === newRating }}
                        >
                          <Icon
                            name="star"
                            size={24}
                            weight={s <= newRating ? "fill" : "regular"}
                            color={s <= newRating ? colors.star : ratingNudge ? colors.danger : colors.starEmpty}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {reviewPhotos.length > 0 && (
                  <View style={styles.fbPhotos}>
                    {reviewPhotos.map((p, i) => (
                      <View key={p.uri} style={styles.fbThumbWrap}>
                        <Image source={{ uri: p.uri }} style={[styles.fbThumb, { backgroundColor: colors.backgroundSoft }]} />
                        <TouchableOpacity
                          onPress={() => removePhoto(i)}
                          disabled={submittingReview}
                          style={[styles.fbThumbRemove, { backgroundColor: colors.textPrimary, borderColor: colors.background }]}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove photo ${i + 1}`}
                        >
                          <Icon name="x" size={11} color={colors.background} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.fbRow}>
                  <Avatar
                    uri={profileImage || clerkPhoto(clerkUser)}
                    name={clerkUser?.fullName || clerkUser?.firstName}
                    size={36}
                    style={styles.fbAvatar}
                  />
                  <View
                    style={[
                      styles.fbPill,
                      { backgroundColor: colors.backgroundSoft, borderColor: composerFocused ? colors.inputBorderFocus : "transparent" },
                    ]}
                  >
                    <TextInput
                      ref={inputRef}
                      style={[styles.fbInput, { color: colors.textPrimary }]}
                      placeholder="Write a review…"
                      placeholderTextColor={colors.placeholder}
                      value={newReview}
                      onChangeText={setNewReview}
                      onFocus={() => setComposerFocused(true)}
                      onBlur={() => setComposerFocused(false)}
                      editable={!submittingReview}
                      multiline
                      maxLength={REVIEW_MAX}
                      accessibilityLabel="Write a review"
                      accessibilityHint={`Up to ${REVIEW_MAX} characters`}
                    />
                    <TouchableOpacity
                      onPress={pickPhotoSource}
                      disabled={submittingReview || reviewPhotos.length >= MAX_REVIEW_PHOTOS}
                      style={[styles.fbIconBtn, reviewPhotos.length >= MAX_REVIEW_PHOTOS && styles.fbIconOff]}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={reviewPhotos.length >= MAX_REVIEW_PHOTOS ? `Photo limit reached (${MAX_REVIEW_PHOTOS})` : "Add photos"}
                    >
                      <Icon name="camera" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    {/* Like Facebook, the send arrow only appears once there's something to send. */}
                    {!!newReview.trim() && (
                      <TouchableOpacity
                        onPress={sendReview}
                        disabled={submittingReview}
                        style={styles.fbIconBtn}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={submittingReview ? "Posting review" : "Post review"}
                      >
                        {submittingReview
                          ? <ActivityIndicator size="small" color={colors.brand} />
                          : <Icon name="send" size={20} weight="fill" color={colors.brand} />}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Always showing while the box is open, so the 250 limit is
                    known before it's hit. */}
                {composerOpen && (
                  <Text
                    style={[styles.fbCount, { color: newReview.length >= REVIEW_MAX - 25 ? colors.warning : colors.textMuted }]}
                    accessibilityLabel={`${newReview.length} of ${REVIEW_MAX} characters`}
                  >
                    {newReview.length}/{REVIEW_MAX}
                  </Text>
                )}
                {submittingReview && reviewPhotos.length > 0 && (
                  <Text style={[styles.fbNote, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
                    Uploading {reviewPhotos.length} {reviewPhotos.length === 1 ? "photo" : "photos"}. This can take a moment on mobile data.
                  </Text>
                )}
              </View>
              )}
              </>
              )}
            </>
          )}

          {/* The model itself is in the hero, where the photo was. */}
          {activeTab === "Model3D" && spot.modelUrl && (
            <View style={styles.modelHintRow}>
              <Icon name="rotate-3d-variant" size={16} color={colors.textMuted} />
              <Text style={[styles.modelHint, { color: colors.textSecondary }]}>
                Drag the model above to turn it around. Pinch or use the buttons to zoom.
              </Text>
            </View>
          )}

          {/* One checklist (user, 2026-10-20: "make it simple"). It used to be
              a % card, then "Must-Dos" as big gold cards and "Side Trips" as a
              separate list, each with its own heading and blurb. Must-dos still
              come first and say so; arriving is always the first item, even
              for a spot with no Mission documents yet. */}
          {activeTab === "BucketList" && (
              <>
                <View style={styles.checkHead}>
                  <Text style={[styles.sectionHeading, styles.checkHeading, { color: colors.textPrimary }]} accessibilityRole="header">
                    Things to do here
                  </Text>
                  {/* Counted once the missions are in; before that it would
                      count the arrival alone. */}
                  {missionsLoaded && (
                    <Text style={[styles.checkCount, { color: completedCount === totalCount ? colors.success : colors.brand }]}>
                      {completedCount} of {totalCount} done
                    </Text>
                  )}
                </View>
                {missionsLoaded && (
                  <View
                    style={[styles.progressTrack, { backgroundColor: colors.brandLight }]}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: totalCount, now: completedCount }}
                  >
                    <View style={[styles.progressFill, { width: `${progressRatio * 100}%`, backgroundColor: completedCount === totalCount ? colors.success : colors.brand }]} />
                  </View>
                )}

                <View style={[styles.checkList, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  {checklist.map((item, i) => (
                    <React.Fragment key={item.key}>
                      {i > 0 && <View style={[styles.checkDivider, { backgroundColor: colors.cardBorder }]} />}
                      <ChecklistRow item={item} colors={colors} />
                    </React.Fragment>
                  ))}
                </View>

                {/* What the list is for: the spot's badge, for finishing all of it. */}
                {missionsLoaded && !!spot.Badge && (
                  <TouchableOpacity
                    // Earned: in iron, a spot badge's tier.
                    style={[styles.badgeTeaser, { backgroundColor: allDone ? colors.ironSoft : colors.card, borderColor: allDone ? colors.iron : colors.cardBorder }]}
                    onPress={() => navigation.navigate("Badges")}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={allDone
                      ? `${spot.name} badge earned. Opens your achievements`
                      : `Finish all ${totalCount} to unlock the ${spot.name} badge. ${completedCount} done. Opens your achievements`}
                  >
                    <View style={styles.badgeTeaserImg}>
                      <Image
                        source={{ uri: badgeImage(spot.Badge, 56, { locked: !allDone }) }}
                        style={[styles.badgeTeaserImg, !allDone && styles.badgeTeaserLocked]}
                        resizeMode="contain"
                      />
                      {allDone && <BadgeShine size={52} every={3800} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.badgeTeaserTitle, { color: allDone ? colors.ironInk : colors.textPrimary }]}>
                        {allDone ? "Badge earned · Iron" : `Finish all ${totalCount} to unlock the badge`}
                      </Text>
                      <Text style={[styles.badgeTeaserSub, { color: colors.textMuted }]} numberOfLines={1}>
                        {allDone ? `${spot.name} · in your achievements` : `${spot.name} · ${totalCount - completedCount} to go`}
                      </Text>
                    </View>
                    <Icon name={allDone ? "award" : "lock"} size={18} color={allDone ? colors.ironInk : colors.textMuted} />
                  </TouchableOpacity>
                )}

                {/* The arrival is always there; the spot's own missions come
                    from the server. */}
                {!missionsLoaded && (missionsFailed ? (
                  <ErrorState text="Couldn't load this spot's other missions. Check your connection." onRetry={retryMissions} />
                ) : (
                  <View style={styles.missionsLoading} accessible accessibilityLabel="Loading missions">
                    <ActivityIndicator color={colors.brand} />
                    <Text style={[styles.missionsLoadingText, { color: colors.textMuted }]}>Loading missions…</Text>
                  </View>
                ))}
              </>
          )}

          <View style={{ height: insets.bottom + 28 }} />
        </View>
      </ScrollView>

      <PhotoViewer viewer={viewer} onClose={() => setViewer(null)} />
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  missingWrap:     { paddingHorizontal: H_PAD, paddingTop: 24 },
  missingBtn:      { alignSelf: "stretch", marginTop: 8 },

  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: H_PAD, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle:     { flex: 1, textAlign: "center", fontSize: 16.5, fontFamily: fonts.sansSemi, letterSpacing: -0.2, marginHorizontal: 8 },
  headerRight:     { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 40, justifyContent: "flex-end" },
  circleBtn:       { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", borderWidth: 1 },

  scrollView:      { flex: 1 },

  // One gutter for the whole screen — hero, tabs and body used to sit at 16,
  // 16 and 22, so their edges didn't line up.
  heroWrap:        { paddingHorizontal: H_PAD, paddingTop: 14, paddingBottom: 4 },
  heroCard:        { borderRadius: radius.xl, overflow: "hidden", height: 288 },
  heroImage:       { width: "100%", height: "100%" },
  // The 3D Model tab's words under the buttons; the model is in the hero.
  modelHintRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  modelHint:       { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: fonts.sansMedium },
  heroRating:     { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(11,30,32,0.62)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroRatingText:  { color: "#fff", fontSize: 12.5, fontFamily: fonts.sansBold },
  heroRatingCount: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontFamily: fonts.sansSemi },
  heroCaption:     { position: "absolute", left: 14, right: 14, bottom: 12, flexDirection: "row", alignItems: "center", gap: 5 },
  heroCaptionText: { color: "#fff", fontSize: 12.5, fontFamily: fonts.sansBold, flex: 1, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 6 },

  segmentWrap:     { paddingHorizontal: H_PAD, paddingTop: 10, paddingBottom: 10 },

  bodyPad:         { paddingHorizontal: H_PAD, paddingTop: 10 },
  // The place name is the screen's display moment — it gets the serif, like
  // the Profile name and the badge names.
  title:           { ...typography.display, marginBottom: 14 },
  actionRow:       { flexDirection: "row", gap: 10, marginBottom: 22 },
  actionBtn:       { flex: 1, minHeight: 48, paddingHorizontal: 12 },

  sectionHeading:  { ...typography.h3, fontSize: 17, lineHeight: 22, marginBottom: 10, marginTop: 6 },
  descriptionText: { ...typography.body, marginBottom: 18 },

  infoCard:        { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 6 },
  infoRow:         { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12 },
  infoIcon:        { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  infoLabel:       { fontSize: 12.5, fontFamily: fonts.sansSemi, width: 100 },
  infoValue:       { fontSize: 13.5, fontFamily: fonts.sansSemi, flex: 1, textAlign: "right" },
  infoRowLong:     { alignItems: "flex-start" },
  infoStack:       { flex: 1, gap: 3, paddingTop: 1 },
  infoLabelStacked: { width: undefined },
  infoValueStacked: { flex: 0, textAlign: "left", lineHeight: 19 },
  infoDivider:     { height: 1 },

  // ── Bakit List tab: one checklist ──
  checkHead:       { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 4 },
  checkHeading:    { marginBottom: 8, marginTop: 0 },
  checkCount:      { fontSize: 13.5, fontFamily: fonts.sansBold },
  progressTrack:   { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 14 },
  progressFill:    { height: "100%", borderRadius: 3 },
  checkList:       { borderRadius: radius.card, borderWidth: 1, overflow: "hidden" },
  checkRow:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 12, minHeight: 72 },
  checkDivider:    { height: 1, marginLeft: 72 },
  checkIcon:       { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  checkBody:       { flex: 1, gap: 3 },
  // No strikethrough on a done item: crossed-out text reads as cancelled. The
  // green tick and "Done" say it.
  checkTitle:      { fontSize: 14.5, fontFamily: fonts.sansBold, lineHeight: 19 },
  checkLine:       { fontSize: 12, fontFamily: fonts.sansMedium },
  checkPts:        { fontSize: 13, fontFamily: fonts.sansBold },
  checkRowSoon:    { opacity: 0.7 },
  badgeTeaser:     { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, padding: 12, borderRadius: radius.card, borderWidth: 1 },
  badgeTeaserImg:  { width: 52, height: 52, borderRadius: 26 },
  badgeTeaserLocked: { opacity: 0.55 },
  badgeTeaserTitle: { fontSize: 14, fontFamily: fonts.sansBold },
  badgeTeaserSub:  { fontSize: 12, fontFamily: fonts.sansMedium, marginTop: 2 },
  missionsLoading: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14 },
  missionsLoadingText: { ...typography.caption },

  // ── Ratings & Reviews (after the reference review UI) ──
  rrHeading:       { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 28, marginBottom: 10 },
  reviewsSkeleton: { marginBottom: 12 },
  rrHeadingText:   { marginTop: 0, marginBottom: 0 },
  // Average on the left, the 5→1 bars on the right.
  ratingSummary:   { flexDirection: "row", alignItems: "center", gap: 16, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 18, borderWidth: 1 },
  ratingLeft:      { alignItems: "center", minWidth: 92 },
  ratingBig:       { ...typography.display, fontSize: 44, lineHeight: 50 },
  reviewCountText: { fontSize: 12.5, fontFamily: fonts.sansMedium, marginTop: 2, marginBottom: 6 },
  starsRow:        { flexDirection: "row", gap: 2 },
  ratingBars:      { flex: 1, gap: 1 },
  barRow:          { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm, minHeight: 24 },
  barStars:        { width: 10, fontSize: 12, fontFamily: fonts.sansSemi, textAlign: "right" },
  barTrack:        { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  barFill:         { height: 6, borderRadius: 3 },
  barPct:          { width: 34, fontSize: 11.5, fontFamily: fonts.sansMedium, textAlign: "right" },
  chevronUp:       { transform: [{ rotate: "180deg" }] },

  // Visitor photos: a strip that runs to the screen edges, under the summary.
  photoStripLabel:   { fontSize: 13, fontFamily: fonts.sansSemi, marginBottom: 8 },
  photoStrip:        { marginHorizontal: -H_PAD, marginBottom: 18 },
  photoStripContent: { paddingHorizontal: H_PAD, gap: 8 },
  stripPhoto:        { width: 112, height: 112, borderRadius: radius.md },

  // Search, sort and the "with photos" chip.
  reviewSearch:    { marginBottom: 10 },
  reviewToolbar:   { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  toolChip:        { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 40 },
  toolChipText:    { fontSize: 13, fontFamily: fonts.sansSemi },
  sortMenu:        { borderWidth: 1, borderRadius: radius.md, paddingVertical: 4, marginTop: -4, marginBottom: 12 },
  sortOption:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, minHeight: TAP },
  sortOptionText:  { fontSize: 14 },
  filterNote:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  filterNoteText:  { fontSize: 12.5, fontFamily: fonts.sansMedium, flex: 1 },
  filterClear:     { fontSize: 13, fontFamily: fonts.sansBold },

  // One review: flat card, name row with ⋮, stars, text, time · verified,
  // photos, then Helpful / Unhelpful and Report.
  // No reviews yet: one quiet card that leads to the review box.
  firstReview:     { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: radius.card, borderWidth: 1, padding: 16, marginBottom: 6 },
  firstReviewIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  firstReviewText: { flex: 1 },
  firstReviewTitle:{ fontSize: 15, fontFamily: fonts.sansBold },
  firstReviewSub:  { fontSize: 13, lineHeight: 18, fontFamily: fonts.sans, marginTop: 2 },
  seeMore:         { alignSelf: "flex-start", marginTop: -4 },
  seeMoreText:     { fontSize: 13.5, fontFamily: fonts.sansBold },
  reviewCard:      { borderRadius: radius.card, borderWidth: 1, padding: 16, marginBottom: 12, gap: 8 },
  reviewHead:      { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAuthor:    { flex: 1, fontSize: 14.5, fontFamily: fonts.sansBold },
  reviewMenu:      { width: 32, height: 32, alignItems: "flex-end", justifyContent: "center" },
  reviewComment:   { fontSize: 14, lineHeight: 21, fontFamily: fonts.sans },
  reviewMeta:      { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: -2 },
  reviewDate:      { fontSize: 12.5, fontFamily: fonts.sansMedium },
  metaDot:         { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 2 },
  reviewVerified:  { fontSize: 12.5, fontFamily: fonts.sansMedium },
  reviewPhotos:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  reviewPhoto:     { width: 76, height: 76, borderRadius: radius.md, borderWidth: 1 },
  reviewFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  reactionsRow:    { flexDirection: "row", alignItems: "center", gap: 16 },
  reactionBtn:     { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 32 },
  reactionLabel:   { fontSize: 13, fontFamily: fonts.sansMedium },

  // Pages under the list.
  pager:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 6 },
  pagerArrow:      { width: TAP, height: TAP, borderRadius: TAP / 2, alignItems: "center", justifyContent: "center" },
  pagerOff:        { opacity: 0.35 },
  pagerNumbers:    { flexDirection: "row", alignItems: "center", gap: 4 },
  pagerNum:        { minWidth: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  pagerNumText:    { fontSize: 14, fontFamily: fonts.sansSemi },
  pagerGap:        { fontSize: 14, fontFamily: fonts.sansSemi, paddingHorizontal: 4 },

  // The Facebook-style review box at the end of the reviews.
  fbComposer:      { borderTopWidth: 1, marginTop: 14, paddingTop: 14, gap: 10 },
  fbRateRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 46 },
  fbRateLabel:     { fontSize: 13, fontFamily: fonts.sansSemi },
  fbStars:         { flexDirection: "row", gap: 8 },
  fbPhotos:        { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingLeft: 46, paddingTop: 6 },
  fbThumbWrap:     { width: 58, height: 58 },
  fbThumb:         { width: 58, height: 58, borderRadius: radius.md },
  fbThumbRemove:   { position: "absolute", top: -7, right: -7, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  fbRow:           { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  fbAvatar:        { marginBottom: 2 },
  // The rounded grey box Facebook uses: no outline until it has focus.
  fbPill:          { flex: 1, flexDirection: "row", alignItems: "flex-end", borderRadius: 20, borderWidth: 1, paddingLeft: 14, paddingRight: 4, minHeight: 40 },
  fbInput:         { flex: 1, fontSize: 14.5, fontFamily: fonts.sans, lineHeight: 20, paddingTop: 10, paddingBottom: 10, maxHeight: 120 },
  fbIconBtn:       { width: 36, height: 38, alignItems: "center", justifyContent: "center" },
  fbIconOff:       { opacity: 0.4 },
  fbCount:         { fontSize: 11.5, fontFamily: fonts.sansMedium, textAlign: "right" },
  fbNote:          { fontSize: 12, fontFamily: fonts.sansMedium, paddingLeft: 46 },
  // In its place once you've reviewed the spot.
  fbDone:          { flexDirection: "row", alignItems: "center", gap: 10 },
  visitIcon:       { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  visitLink:       { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 8, alignSelf: "flex-start" },
  visitLinkText:   { fontSize: 13.5, fontFamily: fonts.sansBold },
  fbDoneText:      { flex: 1 },
  fbDoneTitle:     { fontSize: 14, fontFamily: fonts.sansSemi },
  fbDoneSub:       { fontSize: 12.5, lineHeight: 18, fontFamily: fonts.sans, marginTop: 2 },

  // Full-screen photo viewer (black in both themes).
  viewer:          { flex: 1, backgroundColor: "#000000" },
  viewerTop:       { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.45)" },
  viewerInfo:      { flex: 1 },
  viewerCount:     { color: "#FFFFFF", fontFamily: fonts.sansBold, fontSize: 15 },
  viewerCaption:   { color: "rgba(255,255,255,0.85)", fontFamily: fonts.sans, fontSize: 13, marginTop: 2 },
  viewerClose:     { width: TAP, height: TAP, alignItems: "center", justifyContent: "center" },
});
