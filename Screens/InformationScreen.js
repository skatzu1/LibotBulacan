import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
  Modal, StatusBar, FlatList, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ImageCropPicker from "react-native-image-crop-picker";
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
  PhotoScrim, Segmented, EmptyState, PrimaryButton, Avatar, H_PAD, TAP,
} from "../components/ui";
import { spotImage, cdn } from "../utils/image";
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
const TABS = [
  { key: "Overview",   label: "Overview",   icon: "book-open" },
  { key: "BucketList", label: "Bakit List", icon: "flag"      },
];

// Overview shows this many reviews before "Show all".
const REVIEWS_PREVIEW = 3;

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

function ReviewCard({ review, spotId, clerkUser, profileImage, reactToReview, onReport, onOpenPhoto, colors }) {
  const isMe = clerkUser?.id === review.clerkUserId;
  // No more pravatar.cc fallback — a reviewer without a photo gets their
  // initials, not a random stranger's face.
  const avatarUri = isMe ? (profileImage || review.userImage || clerkUser?.imageUrl) : review.userImage;
  const [reacting, setReacting] = useState(false);

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
      const result = await reactToReview(review._id, spotId, type);
      if (isMutedResult(result)) showMutedAlert(result);
    } catch (err) {
      if (isMutedResult(err)) showMutedAlert(err);
    } finally {
      setReacting(false);
    }
  };

  const author = review.userName || "Anonymous";

  return (
    <View style={styles.reviewCard}>
      <Avatar uri={avatarUri} name={author} size={36} style={[styles.avatar, { borderColor: colors.cardBorder }]} />
      <View style={[styles.reviewBubble, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.reviewBubbleHeader}>
          <Text style={[styles.reviewAuthor, { color: colors.textPrimary }]} numberOfLines={1}>{author}</Text>
          <View style={styles.reviewBubbleHeaderRight}>
            <StarRating rating={review.rating} size={11} colors={colors} />
            <TouchableOpacity
              onPress={() => onReport(review)}
              activeOpacity={0.7}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              style={styles.reportButton}
              accessibilityRole="button"
              accessibilityLabel={`Report the review by ${review.userName || "this user"}`}
            >
              <Icon name="flag" size={13} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.reviewComment, { color: colors.textPrimary }]}>{review.comment}</Text>
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
                  source={{ uri: cdn(p.url, { width: 72, height: 72, crop: "fill" }) }}
                  style={[styles.reviewPhoto, { backgroundColor: colors.backgroundSoft }]}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={styles.reviewFooterRow}>
          <Text style={[styles.reviewDate, { color: colors.textMuted }]}>
            {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Just now"}
          </Text>
          {/* Your own review can't be reacted to. Rather than rendering two
              greyed-out buttons with no explanation, show the tallies as plain
              text — nothing looks broken and nothing invites a dead tap. */}
          {isMe ? (
            <View
              style={styles.reactionsRow}
              accessibilityLabel={`${review.likes || 0} likes, ${review.dislikes || 0} dislikes on your review`}
            >
              <View style={styles.reactionBtn}>
                <Icon name="thumbs-up" size={13} color={colors.textMuted} />
                <Text style={[styles.reactionCount, { color: colors.textMuted }]}>{review.likes || 0}</Text>
              </View>
              <View style={styles.reactionBtn}>
                <Icon name="thumbs-down" size={13} color={colors.textMuted} />
                <Text style={[styles.reactionCount, { color: colors.textMuted }]}>{review.dislikes || 0}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.reactionsRow}>
              <TouchableOpacity
                onPress={() => handleReact("like")}
                disabled={reacting}
                hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
                style={styles.reactionBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: userReaction === "like" }}
                accessibilityLabel={`Like this review, ${review.likes || 0} likes`}
              >
                <Icon name="thumbs-up" size={13} weight={userReaction === "like" ? "fill" : "regular"} color={userReaction === "like" ? colors.brand : colors.textMuted} />
                <Text style={[styles.reactionCount, { color: userReaction === "like" ? colors.brand : colors.textMuted }]}>
                  {review.likes || 0}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleReact("dislike")}
                disabled={reacting}
                hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
                style={styles.reactionBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: userReaction === "dislike" }}
                accessibilityLabel={`Dislike this review, ${review.dislikes || 0} dislikes`}
              >
                <Icon name="thumbs-down" size={13} weight={userReaction === "dislike" ? "fill" : "regular"} color={userReaction === "dislike" ? colors.danger : colors.textMuted} />
                <Text style={[styles.reactionCount, { color: userReaction === "dislike" ? colors.danger : colors.textMuted }]}>
                  {review.dislikes || 0}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
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
  const [showComposer,     setShowComposer]     = useState(false);
  const [showAllReviews,   setShowAllReviews]   = useState(false);
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
  const { user: clerkUser } = useUser();
  const { isBookmarked, toggleBookmark } = useBookmark();
  const { getReviewsForSpot, addReview, reportReview, reactToReview, getAverageRating, getReviewCount, fetchReviews } = useReviews();
  const { fetchMissions, getMissionsForSpot, completedMissions } = useMissions();
  const { hasVisited, refresh: refreshPoints } = usePoints();
  const { profileImage } = useProfileImage();
  const isFocused = useIsFocused();

  useEffect(() => { if (!isFocused) setShow3D(false); }, [isFocused]);
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

  // A tap on a star in the summary opens the sheet with that rating chosen.
  const openComposer = (rating = newRating) => {
    setNewRating(rating);
    setShowComposer(true);
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

  const handleSubmit = async () => {
    if (newRating === 0 || newReview.trim() === "" || submittingReview) return;

    setSubmittingReview(true);
    try {
      const result = await addReview(spot._id, newRating, newReview.trim(), reviewPhotos);
      // Suspended or muted: the sheet closes (they can't post) before the alert.
      if (isSuspendedResult(result)) {
        setShowComposer(false);
        showSuspendedAlert(result);
        return;
      }
      if (isMutedResult(result)) {
        setShowComposer(false);
        showMutedAlert(result);
        return;
      }
      // Any other failure keeps the sheet open, so the text isn't lost.
      if (result && result.success === false) {
        showAlert("Error", result.message || "Failed to post your review. Please try again.");
        return;
      }
      // The compressed copies the picker made are uploaded now; free the space.
      reviewPhotos.forEach((p) => ImageCropPicker.cleanSingle(p.uri).catch(() => {}));
      setNewRating(0); setNewReview(""); setReviewPhotos([]); setShowComposer(false);
      showToast("Review posted. Thanks for sharing!", { type: "success" });
    } catch (err) {
      if (isSuspendedResult(err)) {
        setShowComposer(false);
        showSuspendedAlert(err);
      } else if (isMutedResult(err)) {
        setShowComposer(false);
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
  const canPost   = !!newReview.trim() && newRating > 0 && !submittingReview;

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
        <View style={styles.bodyPad}>
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

              {/* ── Reviews ── */}
              <Text style={[styles.sectionHeading, styles.reviewsHeading, { color: colors.textPrimary }]} accessibilityRole="header">
                Reviews{reviewCount > 0 ? ` (${reviewCount})` : ""}
              </Text>

              <View style={[styles.ratingSummary, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.ratingTop}>
                  <Text style={[styles.ratingBig, { color: colors.textPrimary }]}>{reviewCount > 0 ? averageRating : "–"}</Text>
                  <View style={styles.ratingMeta}>
                    <StarRating rating={Math.round(parseFloat(averageRating))} size={16} colors={colors} />
                    <Text style={[styles.reviewCountText, { color: colors.textMuted }]}>
                      {reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}` : "No ratings yet"}
                    </Text>
                  </View>
                </View>

                <View style={[styles.rateDivider, { backgroundColor: colors.cardBorder }]} />

                {/* Tap a star to start a review with that rating. */}
                <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>Been here? Rate it</Text>
                <View style={styles.rateRow}>
                  <View style={styles.rateStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => openComposer(s)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Rate ${s} out of 5 stars and write a review`}
                      >
                        <Icon name="star" size={26} color={colors.starEmpty} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.writeBtn, { backgroundColor: colors.brandLight }]}
                    onPress={() => openComposer()}
                    accessibilityRole="button"
                    accessibilityLabel="Write a review"
                    activeOpacity={0.8}
                  >
                    <Icon name="edit-2" size={14} color={colors.brand} />
                    <Text style={[styles.writeBtnText, { color: colors.brand }]}>Write</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {visitorPhotos.length > 0 && (
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

              {reviews.length === 0 ? (
                <EmptyState icon="message-square" text="No reviews yet. Be the first to share your experience." />
              ) : (
                <>
                  {(showAllReviews ? reviews : reviews.slice(0, REVIEWS_PREVIEW)).map((review) => (
                    <ReviewCard
                      key={review._id}
                      review={review}
                      spotId={spot._id}
                      clerkUser={clerkUser}
                      profileImage={profileImage}
                      reactToReview={reactToReview}
                      onReport={openReportModal}
                      onOpenPhoto={openPhotos}
                      colors={colors}
                    />
                  ))}
                  {reviews.length > REVIEWS_PREVIEW && (
                    <TouchableOpacity
                      style={[styles.showAllBtn, { borderColor: colors.cardBorder }]}
                      onPress={() => setShowAllReviews((v) => !v)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showAllReviews }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.showAllText, { color: colors.brand }]}>
                        {showAllReviews ? "Show fewer" : `Show all ${reviews.length} reviews`}
                      </Text>
                      <Icon
                        name="chevron-down"
                        size={16}
                        color={colors.brand}
                        style={showAllReviews ? styles.chevronUp : undefined}
                      />
                    </TouchableOpacity>
                  )}
                </>
              )}
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

      {/* Floating action card — Navigate + AR, on both tabs */}
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

      {/* Review composer. A sheet, not a bar pinned to the bottom: reviews now
          sit under Overview, where the bar would have covered the Navigate /
          AR card. Its own KeyboardAvoidingView, because a Modal is a separate
          window and the screen's one doesn't reach it. */}
      <Modal visible={showComposer} animationType="slide" transparent onRequestClose={() => setShowComposer(false)}>
        <KeyboardAvoidingView style={styles.modalKav} behavior="padding">
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 24) }]}>
              <View style={[styles.modalGrabber, { backgroundColor: colors.divider }]} />
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]} accessibilityRole="header">Write a review</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setShowComposer(false)}
                  style={styles.modalClose}
                >
                  <Icon name="x" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {/* Scrolls under the header: with the keyboard up, the stars,
                  text, photos and button are taller than what's left. */}
              <ScrollView style={styles.composerBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.composerWho}>
                  <Avatar
                    uri={profileImage || clerkUser?.imageUrl}
                    name={clerkUser?.fullName || clerkUser?.firstName}
                    size={32}
                  />
                  <Text style={[styles.composerSpot, { color: colors.textMuted }]} numberOfLines={1}>
                    Reviewing <Text style={{ fontFamily: fonts.sansBold, color: colors.textPrimary }}>{spot.name}</Text>
                  </Text>
                </View>

                <Text style={[styles.modalLabel, { color: colors.textPrimary }]}>Your rating</Text>
                <View style={styles.composerStars} accessibilityRole="radiogroup">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setNewRating(s)}
                      hitSlop={6}
                      accessibilityRole="radio"
                      accessibilityLabel={`${s} out of 5 stars`}
                      accessibilityState={{ checked: s === newRating }}
                    >
                      <Icon
                        name="star"
                        size={34}
                        weight={s <= newRating ? "fill" : "regular"}
                        color={s <= newRating ? colors.star : colors.starEmpty}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.modalLabel, { color: colors.textPrimary }]}>Your review</Text>
                <TextInput
                  ref={inputRef}
                  style={[styles.composerInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                  placeholder="What was it like? Tips for the next visitor?"
                  placeholderTextColor={colors.placeholder}
                  value={newReview}
                  onChangeText={setNewReview}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                  accessibilityLabel="Your review"
                />
                <Text style={[styles.composerCount, { color: colors.textMuted }]}>
                  {newRating === 0 ? "Tap a star to rate · " : ""}{newReview.length}/500
                </Text>

                <Text style={[styles.modalLabel, styles.photosLabel, { color: colors.textPrimary }]}>
                  Photos <Text style={[styles.photosHint, { color: colors.textMuted }]}>optional · up to {MAX_REVIEW_PHOTOS}</Text>
                </Text>
                <View style={styles.composerPhotos}>
                  {reviewPhotos.map((p, i) => (
                    <View key={p.uri} style={styles.composerThumbWrap}>
                      <Image source={{ uri: p.uri }} style={[styles.composerThumb, { backgroundColor: colors.backgroundSoft }]} />
                      <TouchableOpacity
                        onPress={() => removePhoto(i)}
                        disabled={submittingReview}
                        style={[styles.thumbRemove, { backgroundColor: colors.textPrimary, borderColor: colors.background }]}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove photo ${i + 1}`}
                      >
                        <Icon name="x" size={12} color={colors.background} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {reviewPhotos.length < MAX_REVIEW_PHOTOS && (
                    <>
                      <TouchableOpacity
                        onPress={() => addPhotos("camera")}
                        disabled={submittingReview}
                        style={[styles.addPhotoTile, { backgroundColor: colors.brandLight, borderColor: colors.cardBorder }]}
                        accessibilityRole="button"
                        accessibilityLabel="Take a photo"
                        activeOpacity={0.8}
                      >
                        <Icon name="camera" size={20} color={colors.brand} />
                        <Text style={[styles.addPhotoText, { color: colors.brand }]}>Camera</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => addPhotos("gallery")}
                        disabled={submittingReview}
                        style={[styles.addPhotoTile, { backgroundColor: colors.brandLight, borderColor: colors.cardBorder }]}
                        accessibilityRole="button"
                        accessibilityLabel="Choose photos from your gallery"
                        activeOpacity={0.8}
                      >
                        <Icon name="image" size={20} color={colors.brand} />
                        <Text style={[styles.addPhotoText, { color: colors.brand }]}>Gallery</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                <PrimaryButton
                  title={submittingReview && reviewPhotos.length ? "Uploading photos…" : "Post review"}
                  icon="send"
                  onPress={handleSubmit}
                  loading={submittingReview}
                  disabled={!canPost}
                />
                {submittingReview && reviewPhotos.length > 0 && (
                  <Text style={[styles.uploadNote, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
                    Uploading {reviewPhotos.length} {reviewPhotos.length === 1 ? "photo" : "photos"}. This can take a moment on mobile data.
                  </Text>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

  // Reviews at the foot of Overview: a summary card (average + "rate it" stars)
  // then the first few reviews.
  reviewsHeading:  { marginTop: 28 },
  ratingSummary:   { borderRadius: radius.card, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 16, borderWidth: 1 },
  ratingTop:       { flexDirection: "row", alignItems: "center", gap: 14 },
  ratingBig:       { ...typography.display, fontSize: 42, lineHeight: 48 },
  ratingMeta:      { flex: 1 },
  starsRow:        { flexDirection: "row", gap: 3, marginBottom: 4 },
  reviewCountText: { fontSize: 12.5, fontFamily: fonts.sansSemi, marginTop: 4 },
  rateDivider:     { height: 1, marginVertical: 14 },
  rateLabel:       { fontSize: 13, fontFamily: fonts.sansSemi, marginBottom: 8 },
  rateRow:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rateStars:       { flexDirection: "row", gap: 10 },
  writeBtn:        { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 36 },
  writeBtnText:    { fontFamily: fonts.sansBold, fontSize: 13 },
  showAllBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: TAP, borderRadius: radius.pill, borderWidth: 1, marginTop: 4 },
  showAllText:     { fontFamily: fonts.sansBold, fontSize: 13.5 },
  chevronUp:       { transform: [{ rotate: "180deg" }] },

  // Visitor photos: a strip that runs to the screen edges, under the summary.
  photoStripLabel:   { fontSize: 13, fontFamily: fonts.sansSemi, marginBottom: 8 },
  photoStrip:        { marginHorizontal: -H_PAD, marginBottom: 18 },
  photoStripContent: { paddingHorizontal: H_PAD, gap: 8 },
  stripPhoto:        { width: 112, height: 112, borderRadius: radius.md },
  reviewPhotos:      { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  reviewPhoto:       { width: 72, height: 72, borderRadius: radius.sm },

  // Full-screen viewer (black in both themes).
  viewer:          { flex: 1, backgroundColor: "#000000" },
  viewerTop:       { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.45)" },
  viewerInfo:      { flex: 1 },
  viewerCount:     { color: "#FFFFFF", fontFamily: fonts.sansBold, fontSize: 15 },
  viewerCaption:   { color: "rgba(255,255,255,0.85)", fontFamily: fonts.sans, fontSize: 13, marginTop: 2 },
  viewerClose:     { width: TAP, height: TAP, alignItems: "center", justifyContent: "center" },

  reviewCard:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  avatar:          { marginTop: 2, borderWidth: 1.5 },
  reviewBubble:    { flex: 1, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 12 },
  reviewBubbleHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 8 },
  reviewBubbleHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewAuthor:    { fontSize: 13, fontFamily: fonts.sansBold, flexShrink: 1 },
  reviewComment:   { fontSize: 13.5, lineHeight: 20 },
  reviewFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  reviewDate:      { fontSize: 11, fontFamily: fonts.sansMedium },
  reactionsRow:    { flexDirection: "row", alignItems: "center", gap: 14 },
  reactionBtn:     { flexDirection: "row", alignItems: "center", gap: 4 },
  reactionCount:   { fontSize: 12, fontFamily: fonts.sansBold },
  reportButton:    { padding: 2 },

  // Review composer sheet
  modalKav:        { flex: 1 },
  composerBody:    { flexGrow: 0 },
  composerWho:     { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  composerSpot:    { flex: 1, fontSize: 13.5, fontFamily: fonts.sans },
  composerStars:   { flexDirection: "row", gap: 12 },
  composerInput:   { borderRadius: radius.md, borderWidth: 1, padding: 14, fontSize: 14.5, lineHeight: 21, fontFamily: fonts.sans, minHeight: 120, maxHeight: 200 },
  composerCount:   { fontSize: 12, fontFamily: fonts.sansMedium, textAlign: "right", marginTop: 6 },
  photosLabel:     { marginTop: 4 },
  photosHint:      { fontSize: 12, fontFamily: fonts.sansMedium },
  composerPhotos:  { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  composerThumbWrap: { width: 68, height: 68 },
  composerThumb:   { width: 68, height: 68, borderRadius: radius.md },
  thumbRemove:     { position: "absolute", top: -7, right: -7, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  addPhotoTile:    { width: 68, height: 68, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  addPhotoText:    { fontSize: 11, fontFamily: fonts.sansBold },
  uploadNote:      { fontSize: 12, fontFamily: fonts.sansMedium, textAlign: "center", marginTop: 10 },

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
