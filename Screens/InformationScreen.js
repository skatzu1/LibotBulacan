import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
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
import { splitByTier, ARRIVAL_POINTS, TIER_LABELS } from "../utils/missionTiers";
import { useTheme, radius, shadow, fonts, typography, MAX_FONT_SCALE } from "../context/ThemeContext";
import ModelViewer from "../utils/ModelViewer";
import { ensureAtSpotForAR } from "../utils/arLocationGate";
import InformationSkeleton from "../components/InformationSkeleton";
import {
  PhotoScrim, Segmented, EmptyState, PrimaryButton, Avatar, SearchField, H_PAD, TAP,
} from "../components/ui";
import { spotImage, cdn } from "../utils/image";
import {
  REVIEW_SORTS, ratingBreakdown, filterAndSortReviews, pageOf, pageNumbers, timeAgo,
} from "../utils/reviewList";
import Icon from "../components/Icon";

// Icon + label per mission type. Colour is theme-driven (see MissionRow).
const MISSION_CONFIG = {
  checkin: { icon: "map-pin",     label: "Check In" },
  photo:   { icon: "camera",      label: "Photo"    },
  ar:      { icon: "aperture",    label: "AR"       },
  quiz:    { icon: "help-circle", label: "Quiz"     },
  // The first mission of every spot — camera capture verified by an on-spot
  // AI classifier (which model runs depends on the spot's category).
  ai:      { icon: "cpu",         label: "AI Scan"  },
  // The second mission of every spot — a geofenced food recommendation the
  // user must physically visit (see Screens/LocationMission.js).
  location: { icon: "map-pin",    label: "Nearby Eats" },
};

const REPORT_REASONS = [
  { key:"spam",               label:"Spam" },
  { key:"offensive_language", label:"Offensive language" },
  { key:"fake_review",        label:"Fake review" },
  { key:"harassment",         label:"Harassment" },
  { key:"other",              label:"Other" },
];

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
        "You've been temporarily muted from posting or reacting due to community reports. Please try again later.",
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

const TABS = [
  { key: "Overview",   label: "Overview",   icon: "book-open" },
  { key: "BucketList", label: "Bakit List", icon: "flag"      },
];

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

function ReviewCard({ review, spotId, clerkUser, profileImage, reactToReview, onReport, onDelete, onOpenPhoto, colors }) {
  const isMe = clerkUser?.id === review.clerkUserId;
  // No more pravatar.cc fallback — a reviewer without a photo gets their
  // initials, not a random stranger's face.
  const avatarUri = isMe ? (profileImage || review.userImage || clerkUser?.imageUrl) : review.userImage;
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

  // ⋮ — your own review can be deleted (onDelete asks to confirm); anyone
  // else's reported.
  const openMenu = () => {
    if (isMe) {
      onDelete(review);
    } else {
      showAlert(`Review by ${author}`, undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Report review", style: "destructive", onPress: () => onReport(review) },
      ]);
    }
  };

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
        <TouchableOpacity
          onPress={openMenu}
          hitSlop={10}
          style={styles.reviewMenu}
          accessibilityRole="button"
          accessibilityLabel={isMe ? "Options for your review" : `Options for the review by ${author}`}
        >
          <Icon name="more-vertical" size={18} color={colors.textMuted} />
        </TouchableOpacity>
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
        {!isMe && (
          <TouchableOpacity
            onPress={() => onReport(review)}
            hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Report the review by ${author}`}
          >
            <Text style={[styles.reportLink, { color: colors.brand }]}>Report</Text>
          </TouchableOpacity>
        )}
      </View>
      )}
    </View>
  );
}

// Major missions ("Must-Dos": arriving, AR) — full-width gold cards with a
// clear next step. Minor ones ("Side Trips") use the compact MissionRow list
// below, in teal. Labels live in utils/missionTiers.js.
function MajorMissionCard({ icon, title, description, points, isDone, actionLabel, onPress, colors }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${TIER_LABELS.major.title}: ${title}, ${points} points${isDone ? ", completed" : `. ${actionLabel}`}`}
      style={[styles.majorCard, { backgroundColor: colors.card, borderColor: isDone ? colors.success : colors.cardBorder }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.majorTop}>
        <View style={[styles.majorIcon, { backgroundColor: isDone ? colors.successBg : colors.accentSoft }]}>
          <Icon name={isDone ? "check" : icon} size={22} color={isDone ? colors.success : colors.accentDark} />
        </View>
        <View style={styles.majorBody}>
          <Text style={[styles.majorTitle, { color: colors.textPrimary }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.majorDesc, { color: colors.textSecondary }]} numberOfLines={3}>{description}</Text>
        </View>
      </View>
      <View style={styles.majorFooter}>
        <View style={[styles.ptsPill, { backgroundColor: colors.accentSoft }]}>
          <Icon name="star" size={11} color={colors.accentDark} weight="fill" />
          <Text style={[styles.ptsText, { color: colors.accentDark }]}>{points} pts</Text>
        </View>
        {isDone ? (
          <View style={styles.majorDone}>
            <Icon name="check-circle" size={15} color={colors.success} weight="fill" />
            <Text style={[styles.majorDoneText, { color: colors.success }]}>Done</Text>
          </View>
        ) : (
          <View style={[styles.majorCta, { backgroundColor: colors.accent }]}>
            <Text style={[styles.majorCtaText, { color: colors.onAccent }]}>{actionLabel}</Text>
            <Icon name="chevron-right" size={15} color={colors.onAccent} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function MissionRow({ mission, isDone, cityText, onPress, colors }) {
  const config = MISSION_CONFIG[mission.type] || MISSION_CONFIG.checkin;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${mission.title}, ${config.label}, ${mission.points ?? 0} points${isDone ? ", completed" : ""}`}
      style={styles.missionRow}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={styles.missionThumbWrap}>
        <View style={[styles.missionThumb, { backgroundColor: isDone ? colors.successBg : colors.brandLight }]}>
          <Icon name={config.icon} size={19} color={isDone ? colors.success : colors.brand} />
        </View>
        {isDone && (
          <View style={[styles.checkBadge, { backgroundColor: colors.success, borderColor: colors.card }]}>
            <Icon name="check" size={10} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.missionRowBody}>
        <Text style={[styles.missionRowTitle, { color: colors.textPrimary }, isDone && styles.missionRowTitleDone]} numberOfLines={2}>
          {mission.title}
        </Text>
        <Text style={[styles.missionRowSub, { color: colors.textMuted }]} numberOfLines={1}>{config.label} · {cityText}</Text>
      </View>
      <View style={[styles.ptsPill, { backgroundColor: colors.brandLight }]}>
        <Text style={[styles.ptsText, { color: colors.brand }]}>+{mission.points ?? 0}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function InformationScreen({ route, navigation }) {
  const spot = route?.params?.spot;
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Callers can deep-link to a specific tab (e.g. the Missions flow lands here
  // on the missions list rather than Overview).
  const initialTab = TABS.some((t) => t.key === route?.params?.tab) ? route.params.tab : "Overview";
  const [activeTab,        setActiveTab]        = useState(initialTab);
  const [show3D,           setShow3D]           = useState(false);
  const [newRating,        setNewRating]        = useState(0);
  const [newReview,        setNewReview]        = useState("");
  // The Facebook-style review box at the end of the reviews: focused while
  // the user is typing (it opens up, and the floating Navigate / AR card
  // steps aside so it doesn't cover the box).
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
  const [screenReady,      setScreenReady]      = useState(false);
  const [reportTarget,     setReportTarget]     = useState(null);
  const [showReportModal,  setShowReportModal]  = useState(false);
  const [reportReason,     setReportReason]     = useState("");
  const [reportDetails,    setReportDetails]    = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  // Where the review list starts (inside the body) and where the body starts
  // (inside the scroll view), for paging back to the top of the list.
  const reviewsTopY = useRef(0);
  const bodyY = useRef(0);
  const { user: clerkUser } = useUser();
  const { isBookmarked, toggleBookmark } = useBookmark();
  const { getReviewsForSpot, addReview, reportReview, reactToReview, getAverageRating, getReviewCount, fetchReviews, deleteReview } = useReviews();
  const { fetchMissions, getMissionsForSpot, completedMissions } = useMissions();
  const { hasVisited, refresh: refreshPoints } = usePoints();
  const { profileImage } = useProfileImage();
  const isFocused = useIsFocused();

  useEffect(() => { if (!isFocused) setShow3D(false); }, [isFocused]);

  // The review box is the last thing on the page. When the keyboard opens
  // for it, scroll to the end so the box sits just above the keyboard
  // instead of under it.
  useEffect(() => {
    if (!composerFocused) return undefined;
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, [composerFocused]);
  // "Arrive at the spot" is ticked from the visit logs, so re-read them when
  // the user comes back here — e.g. from navigating to the spot.
  useEffect(() => { if (isFocused) refreshPoints(); }, [isFocused, refreshPoints]);
  useEffect(() => {
    if (spot?._id) {
      setScreenReady(false);
      Promise.all([fetchReviews(spot._id), fetchMissions(spot._id)]).finally(() => setScreenReady(true));
    }
  }, [spot?._id]);

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

  // The skeleton used to replace the ENTIRE screen, back button included — so on
  // a cold backend (Render spins down, 30s+ to wake) the user was stranded with
  // no way out. The header now renders immediately and only the body is a
  // skeleton, which is also why the title no longer pops in afterwards.
  if (!screenReady) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      {header(null)}
      <InformationSkeleton />
    </View>
  );

  const spotIsBookmarked = isBookmarked(spot._id || spot.id);
  const reviews          = getReviewsForSpot(spot._id);
  const averageRating    = getAverageRating(spot._id) || "0.0";
  const reviewCount      = getReviewCount(spot._id);
  // Every photo travelers attached to their reviews, newest review first,
  // each labelled with who took it.
  const visitorPhotos    = reviews.flatMap((r) => (r.photos || []).map((p) => ({ ...p, caption: r.userName || "Anonymous" })));
  const breakdown        = ratingBreakdown(reviews);
  const shownReviews     = filterAndSortReviews(reviews, { query: reviewQuery, sort: reviewSort, stars: starFilter, withPhotos: onlyWithPhotos });
  const reviewPage       = pageOf(shownReviews, reviewPageIndex);
  const sortLabel        = (REVIEW_SORTS.find((o) => o.key === reviewSort) || REVIEW_SORTS[0]).label;
  // The review box opens up while in use or holding a draft.
  const composerOpen     = composerFocused || !!newReview || newRating > 0 || reviewPhotos.length > 0;
  const missions         = getMissionsForSpot(spot._id);
  // Hierarchy: arriving + AR are major, AI + food are minor (utils/missionTiers).
  // Arriving isn't a Mission document, so it's counted in by hand.
  const isDoneMission    = (m) => !!completedMissions?.includes(m._id);
  const arrived          = hasVisited(spot._id);
  const tiers            = splitByTier(missions);
  const majorDone        = (arrived ? 1 : 0) + tiers.major.filter(isDoneMission).length;
  const majorTotal       = 1 + tiers.major.length;
  const minorDone        = tiers.minor.filter(isDoneMission).length;
  const minorTotal       = tiers.minor.length;
  const completedCount   = majorDone + minorDone;
  const totalCount       = majorTotal + minorTotal;
  const progressRatio    = totalCount > 0 ? completedCount / totalCount : 0;
  const arMission        = missions.find((m) => m.type === "ar");

  const cityText = spot.city || spot.address || "Bulacan, Philippines";

  // Only facts the spot actually has. Missing hours used to read
  // "6:00 AM – 10:00 PM", a missing fee "Free" and missing contact "N/A" —
  // invented details a visitor could plan a trip around.
  const facts = [
    { icon: "clock",   label: "Visiting hours", value: spot.visitingHours },
    { icon: "tag",     label: "Entrance fee",   value: spot.entranceFee },
    { icon: "map-pin", label: "Location",       value: cityText },
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

  const addPhotos = async (source) => {
    const room = MAX_REVIEW_PHOTOS - reviewPhotos.length;
    if (room <= 0) return;
    try {
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
      if (err?.code !== "E_PICKER_CANCELLED") {
        console.error("[Review] photo pick error:", err);
        showAlert("Couldn't add the photo", "Please try again.");
      }
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

  // BookmarkContext re-renders this screen on its own. This used to bump a
  // `key` on the whole screen to force a refresh, which remounted everything
  // and threw the user back to the top of a long review list.
  const handleBookmarkToggle = () => toggleBookmark(spot);

  const handleLaunchAR = async () => {
    // AR models are anchored to real places at the spot — warn if the user
    // isn't physically there before launching.
    if (await ensureAtSpotForAR(spot)) {
      navigation.navigate("ar", { spot, arMissionId: arMission?._id ?? null });
    }
  };

  const openMission = (mission) => {
    if (mission.type === "ar") handleLaunchAR();
    else if (mission.type === "location") navigation.navigate("LocationMission", { spot, mission });
    else navigation.navigate("Mission", { spot, mission });
  };

  const openReportModal = (review) => {
    setReportTarget({ reviewId: review._id, reportedClerkUserId: review.clerkUserId || "", userName: review.userName || "this user" });
    setReportReason(""); setReportDetails(""); setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReason) { showAlert("Select a reason", "Please choose a reason for reporting."); return; }
    setSubmittingReport(true);
    try {
      const result = await reportReview({ reviewId: reportTarget.reviewId, reportedClerkUserId: reportTarget.reportedClerkUserId, reason: reportReason, details: reportDetails });
      setSubmittingReport(false);
      if (isMutedResult(result)) {
        setShowReportModal(false);
        showMutedAlert(result);
        return;
      }
      setShowReportModal(false);
      if (result) showToast("Report sent. Our moderators will review it.", { type: "success" });
      else showAlert("Error", "Failed to submit report. Please try again.");
    } catch (err) {
      setSubmittingReport(false);
      setShowReportModal(false);
      if (isMutedResult(err)) {
        showMutedAlert(err);
      } else {
        showAlert("Error", "Failed to submit report. Please try again.");
      }
    }
  };

  const showing3D = show3D && !!spot.modelUrl && isFocused;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {header(
        <>
          {spot.modelUrl && (
            <CircleBtn
              colors={colors}
              accessibilityLabel={show3D ? "Show photo" : "Show 3D model"}
              onPress={() => setShow3D(!show3D)}
              iconNode={<Icon name={show3D ? "image-outline" : "cube-scan"} size={20} color={colors.textPrimary} />}
            />
          )}
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
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
      >
        {/* [0] Hero */}
        <View style={styles.heroWrap}>
          <View style={[styles.heroCard, { backgroundColor: colors.card }, shadow.md]}>
            {showing3D ? (
              <ModelViewer url={spot.modelUrl} style={styles.heroImage} />
            ) : (
              <Image source={{ uri: spotImage(spot.image, 400, 260) }} style={styles.heroImage} resizeMode="cover" />
            )}
            {/* Over the 3D view the scrim only needs to back the caption; from
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
            options={TABS}
            value={activeTab}
            onChange={setActiveTab}
          />
        </View>

        {/* [2] Body */}
        <View style={styles.bodyPad} onLayout={(e) => { bodyY.current = e.nativeEvent.layout.y; }}>
          <Text style={[styles.title, { color: colors.textPrimary }]} accessibilityRole="header">{spot.name}</Text>

          {activeTab === "Overview" && (
            <>
              <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>About</Text>
              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                {spot.description || "No description for this place yet."}
              </Text>

              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {facts.map((row, i) => (
                  <React.Fragment key={row.label}>
                    <View style={styles.infoRow} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
                      <View style={[styles.infoIcon, { backgroundColor: colors.brandLight }]}>
                        <Icon name={row.icon} size={14} color={colors.brand} />
                      </View>
                      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{row.label}</Text>
                      <Text style={[styles.infoValue, { color: colors.textPrimary }]} numberOfLines={2}>{row.value}</Text>
                    </View>
                    {i < facts.length - 1 && <View style={[styles.infoDivider, { backgroundColor: colors.cardBorder }]} />}
                  </React.Fragment>
                ))}
              </View>

              {/* ── Ratings & Reviews ── */}
              <View style={styles.rrHeading}>
                <Icon name="star" size={18} color={colors.textPrimary} />
                <Text style={[styles.sectionHeading, styles.rrHeadingText, { color: colors.textPrimary }]} accessibilityRole="header">
                  Ratings &amp; Reviews
                </Text>
              </View>

              {/* No reviews: an invitation instead of "–" and five empty bars;
                  tapping it jumps to the review box below. Otherwise the
                  average on the left and the 5→1 breakdown on the right — a
                  bar is also a filter: tap it to see only that rating. */}
              {reviewCount === 0 ? (
                <TouchableOpacity
                  onPress={startReview}
                  activeOpacity={0.85}
                  style={[styles.firstReview, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  accessibilityRole="button"
                  accessibilityLabel="No reviews yet. Write the first review."
                >
                  <View style={[styles.firstReviewIcon, { backgroundColor: colors.brandLight }]}>
                    <Icon name="star" size={22} color={colors.brand} />
                  </View>
                  <View style={styles.firstReviewText}>
                    <Text style={[styles.firstReviewTitle, { color: colors.textPrimary }]}>No reviews yet</Text>
                    <Text style={[styles.firstReviewSub, { color: colors.textSecondary }]}>
                      Been here? Be the first to tell the next visitor what it was like.
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
                          onReport={openReportModal}
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

              {/* Write a review, Facebook-comment style: your avatar and a
                  rounded box with a camera icon. It opens up (stars, photo
                  thumbnails, send) once you tap in or start. */}
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
                    uri={profileImage || clerkUser?.imageUrl}
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
                      maxLength={500}
                      accessibilityLabel="Write a review"
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

                {composerOpen && newReview.length > 400 && (
                  <Text style={[styles.fbCount, { color: colors.textMuted }]}>{newReview.length}/500</Text>
                )}
                {submittingReview && reviewPhotos.length > 0 && (
                  <Text style={[styles.fbNote, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
                    Uploading {reviewPhotos.length} {reviewPhotos.length === 1 ? "photo" : "photos"}. This can take a moment on mobile data.
                  </Text>
                )}
              </View>
            </>
          )}

          {/* Never empty any more: arriving at the spot is a major mission
              every spot has, even one with no Mission documents yet. */}
          {activeTab === "BucketList" && (
              <>
                <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.progressTop}>
                    <Text style={[styles.progressLabel, { color: colors.textPrimary }]}>Your progress</Text>
                    <Text style={[styles.progressPct, { color: colors.brand }]}>{Math.round(progressRatio * 100)}%</Text>
                  </View>
                  <View
                    style={[styles.progressTrack, { backgroundColor: colors.brandLight }]}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: totalCount, now: completedCount }}
                  >
                    <View style={[styles.progressFill, { width: `${progressRatio * 100}%`, backgroundColor: colors.brand }]} />
                  </View>
                  <Text style={[styles.progressSub, { color: colors.textMuted }]}>
                    {majorDone} of {majorTotal} {TIER_LABELS.major.title.toLowerCase()}
                    {minorTotal > 0 ? ` · ${minorDone} of ${minorTotal} ${TIER_LABELS.minor.title.toLowerCase()}` : ""}
                  </Text>
                </View>

                <Text style={[styles.sectionHeading, styles.tierHeading, { color: colors.textPrimary }]} accessibilityRole="header">
                  {TIER_LABELS.major.title}
                </Text>
                <Text style={[styles.tierSub, { color: colors.textMuted }]}>{TIER_LABELS.major.sub}</Text>
                <View style={styles.majorList}>
                  <MajorMissionCard
                    icon="map-pin"
                    title={`Arrive at ${spot.name}`}
                    description={arrived
                      ? "You've been here. Your visit is logged."
                      : "Go there in person. Your phone's location confirms you arrived."}
                    points={ARRIVAL_POINTS}
                    isDone={arrived}
                    actionLabel="Navigate"
                    onPress={() => navigation.navigate("Track", { spot })}
                    colors={colors}
                  />
                  {tiers.major.map((mission) => (
                    <MajorMissionCard
                      key={mission._id}
                      icon={(MISSION_CONFIG[mission.type] || MISSION_CONFIG.checkin).icon}
                      title={mission.title}
                      description={mission.description}
                      points={mission.points ?? 0}
                      isDone={isDoneMission(mission)}
                      actionLabel="Open AR"
                      onPress={() => openMission(mission)}
                      colors={colors}
                    />
                  ))}
                </View>

                {tiers.minor.length > 0 && (
                  <>
                    <Text style={[styles.sectionHeading, styles.tierHeading, { color: colors.textPrimary }]} accessibilityRole="header">
                      {TIER_LABELS.minor.title}
                    </Text>
                    <Text style={[styles.tierSub, { color: colors.textMuted }]}>{TIER_LABELS.minor.sub}</Text>
                    <View style={[styles.missionList, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                      {tiers.minor.map((mission, i) => (
                        <React.Fragment key={mission._id}>
                          <MissionRow
                            mission={mission}
                            isDone={isDoneMission(mission)}
                            cityText={cityText}
                            onPress={() => openMission(mission)}
                            colors={colors}
                          />
                          {i < tiers.minor.length - 1 && <View style={[styles.missionDivider, { backgroundColor: colors.cardBorder }]} />}
                        </React.Fragment>
                      ))}
                    </View>
                  </>
                )}
              </>
          )}

          {/* Clears the floating Navigate / AR card. */}
          <View style={{ height: 108 }} />
        </View>
      </ScrollView>

      {/* Floating action card — Navigate + AR, on both tabs. Steps aside while
          the review box has the keyboard, or it would sit right on top of it. */}
      {!composerFocused && (
        <View style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, bottom: Math.max(insets.bottom, 14) + 10 }, shadow.lg]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Navigate to ${spot.name}`}
            style={styles.actionItem}
            onPress={() => navigation.navigate("Track", { spot })}
            activeOpacity={0.75}
          >
            <Icon name="navigation" size={17} color={colors.brand} />
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>Navigate</Text>
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.divider }]} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Open ${spot.name} in AR`}
            style={styles.actionItem}
            onPress={handleLaunchAR}
            activeOpacity={0.75}
          >
            <Icon name="aperture" size={17} color={colors.brand} />
            <Text style={[styles.actionText, { color: colors.textPrimary }]}>AR View</Text>
          </TouchableOpacity>
        </View>
      )}

      <PhotoViewer viewer={viewer} onClose={() => setViewer(null)} />

      {/* Report modal */}
      <Modal visible={showReportModal} animationType="slide" transparent onRequestClose={() => setShowReportModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={[styles.modalGrabber, { backgroundColor: colors.divider }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]} accessibilityRole="header">Report review</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close report"
                onPress={() => setShowReportModal(false)}
                style={styles.modalClose}
              >
                <Icon name="x" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {reportTarget && (
              <Text style={[styles.reportSubtitle, { color: colors.textMuted }]}>
                Reporting comment by <Text style={{ fontFamily: fonts.sansBold, color: colors.textPrimary }}>{reportTarget.userName}</Text>
              </Text>
            )}
            <Text style={[styles.modalLabel, { color: colors.textPrimary }]}>Reason</Text>
            <View style={styles.reasonList} accessibilityRole="radiogroup">
              {REPORT_REASONS.map((r) => {
                const on = reportReason === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={r.label}
                    style={[styles.reasonOption, { backgroundColor: colors.card, borderColor: colors.cardBorder }, on && { borderColor: colors.brand, backgroundColor: colors.brandLight }]}
                    onPress={() => setReportReason(r.key)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.reasonRadio, { borderColor: on ? colors.brand : colors.textMuted }]}>
                      {on && <View style={[styles.reasonRadioDot, { backgroundColor: colors.brand }]} />}
                    </View>
                    <Text style={[styles.reasonLabel, { color: on ? colors.textPrimary : colors.textSecondary }, on && { fontFamily: fonts.sansSemi }]}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.modalLabel, { color: colors.textPrimary }]}>Additional details (optional)</Text>
            <TextInput
              style={[styles.reportDetailsInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              multiline
              placeholder="Add any extra context..."
              placeholderTextColor={colors.placeholder}
              value={reportDetails}
              onChangeText={setReportDetails}
              maxLength={500}
              textAlignVertical="top"
              accessibilityLabel="Additional details"
            />
            <PrimaryButton title="Submit report" onPress={handleSubmitReport} loading={submittingReport} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  heroRating:      { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(11,30,32,0.62)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  heroRatingText:  { color: "#fff", fontSize: 12.5, fontFamily: fonts.sansBold },
  heroRatingCount: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontFamily: fonts.sansSemi },
  heroCaption:     { position: "absolute", left: 14, right: 14, bottom: 12, flexDirection: "row", alignItems: "center", gap: 5 },
  heroCaptionText: { color: "#fff", fontSize: 12.5, fontFamily: fonts.sansBold, flex: 1, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 6 },

  segmentWrap:     { paddingHorizontal: H_PAD, paddingTop: 10, paddingBottom: 10 },

  bodyPad:         { paddingHorizontal: H_PAD, paddingTop: 10 },
  // The place name is the screen's display moment — it gets the serif, like
  // the Profile name and the badge names.
  title:           { ...typography.display, marginBottom: 14 },

  sectionHeading:  { ...typography.h3, fontSize: 17, lineHeight: 22, marginBottom: 10, marginTop: 6 },
  descriptionText: { ...typography.body, marginBottom: 18 },

  infoCard:        { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 6 },
  infoRow:         { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12 },
  infoIcon:        { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  infoLabel:       { fontSize: 12.5, fontFamily: fonts.sansSemi, width: 100 },
  infoValue:       { fontSize: 13.5, fontFamily: fonts.sansSemi, flex: 1, textAlign: "right" },
  infoDivider:     { height: 1 },

  progressCard:    { borderRadius: radius.card, borderWidth: 1, padding: 16, marginBottom: 20, marginTop: 2 },
  progressTop:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  progressLabel:   { fontSize: 14, fontFamily: fonts.sansBold, letterSpacing: -0.2 },
  progressPct:     { fontSize: 15, fontFamily: fonts.sansBold },
  progressTrack:   { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill:    { height: "100%", borderRadius: 4 },
  progressSub:     { fontSize: 12, fontFamily: fonts.sansSemi, marginTop: 8 },

  missionList:     { borderRadius: radius.card, borderWidth: 1, overflow: "hidden" },
  missionRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 12, minHeight: 72 },
  missionDivider:  { height: 1, marginLeft: 72 },
  missionThumbWrap:{ position: "relative" },
  missionThumb:    { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  checkBadge:      { position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center", borderWidth: 2 },
  missionRowBody:  { flex: 1, gap: 3 },
  missionRowTitle: { fontSize: 14, fontFamily: fonts.sansBold, lineHeight: 19 },
  // No strikethrough. The green tick on the thumbnail already says "done", and
  // a line through the title says something different — crossed-out text reads
  // as cancelled or no longer available, which is the opposite of an
  // achievement the user just earned. The tick is the only completion marker.
  missionRowTitleDone: { opacity: 0.72 },
  missionRowSub:   { fontSize: 11.5, fontFamily: fonts.sansMedium },

  // ── Mission hierarchy ──
  tierHeading:     { marginBottom: 2, marginTop: 4 },
  tierSub:         { ...typography.caption, marginBottom: 12 },
  majorList:       { gap: 12, marginBottom: 24 },
  majorCard:       { borderRadius: radius.card, borderWidth: 1.5, padding: 16, gap: 14 },
  majorTop:        { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  majorIcon:       { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  majorBody:       { flex: 1, gap: 4 },
  majorTitle:      { ...typography.h3, fontSize: 17, lineHeight: 22 },
  majorDesc:       { ...typography.body, fontSize: 13.5, lineHeight: 19 },
  majorFooter:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  majorCta:        { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, paddingLeft: 16, paddingRight: 12, borderRadius: radius.pill },
  majorCtaText:    { fontFamily: fonts.sansBold, fontSize: 13.5 },
  majorDone:       { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 40 },
  majorDoneText:   { fontFamily: fonts.sansBold, fontSize: 13.5 },
  ptsPill:         { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  ptsText:         { fontFamily: fonts.sansBold, fontSize: 12 },

  // ── Ratings & Reviews (after the reference review UI) ──
  rrHeading:       { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 28, marginBottom: 10 },
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
  reportLink:      { fontSize: 13, fontFamily: fonts.sansBold },

  // Pages under the list.
  pager:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 6 },
  pagerArrow:      { width: TAP, height: TAP, borderRadius: TAP / 2, alignItems: "center", justifyContent: "center" },
  pagerOff:        { opacity: 0.35 },
  pagerNumbers:    { flexDirection: "row", alignItems: "center", gap: 4 },
  pagerNum:        { minWidth: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  pagerNumText:    { fontSize: 14, fontFamily: fonts.sansSemi },
  pagerGap:        { fontSize: 14, paddingHorizontal: 4 },

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

  // Full-screen photo viewer (black in both themes).
  viewer:          { flex: 1, backgroundColor: "#000000" },
  viewerTop:       { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.45)" },
  viewerInfo:      { flex: 1 },
  viewerCount:     { color: "#FFFFFF", fontFamily: fonts.sansBold, fontSize: 15 },
  viewerCaption:   { color: "rgba(255,255,255,0.85)", fontFamily: fonts.sans, fontSize: 13, marginTop: 2 },
  viewerClose:     { width: TAP, height: TAP, alignItems: "center", justifyContent: "center" },


  actionCard:      { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4 },
  actionItem:      { flexDirection: "row", alignItems: "center", gap: 8, minHeight: TAP, paddingHorizontal: 22 },
  actionText:      { fontFamily: fonts.sansBold, fontSize: 13.5, letterSpacing: -0.2 },
  actionDivider:   { width: 1, alignSelf: "stretch", marginVertical: 8 },

  modalOverlay:    { flex: 1, justifyContent: "flex-end" },
  modalContent:    { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: H_PAD, paddingTop: 10, maxHeight: "88%" },
  modalGrabber:    { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  modalHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle:      { ...typography.h2, fontSize: 22, lineHeight: 28 },
  modalClose:      { width: TAP, height: TAP, alignItems: "flex-end", justifyContent: "center" },
  modalLabel:      { fontSize: 14, fontFamily: fonts.sansBold, marginBottom: 10, marginTop: 14 },
  reportSubtitle:  { fontSize: 13.5, marginBottom: 4 },
  reasonList:      { gap: 8, marginBottom: 4 },
  reasonOption:    { flexDirection: "row", alignItems: "center", borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1.5, gap: 12 },
  reasonRadio:     { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  reasonRadioDot:  { width: 10, height: 10, borderRadius: 5 },
  reasonLabel:     { fontSize: 14, fontFamily: fonts.sans },
  reportDetailsInput: { borderRadius: radius.md, padding: 14, fontSize: 14, fontFamily: fonts.sans, minHeight: 88, marginBottom: 18, borderWidth: 1, textAlignVertical: "top" },
});
