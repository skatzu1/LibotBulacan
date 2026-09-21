import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAlert } from "../components/AppAlert";
import { useUser } from "@clerk/clerk-expo";
import { useIsFocused } from "@react-navigation/native";
import { useBookmark } from "../context/BookmarkContext";
import { useReviews } from "../context/ReviewContext";
import { useMissions } from "../context/MissionContext";
import { useProfileImage } from "../context/ProfileImageContext";
import { useTheme, radius, shadow, fonts } from "../context/ThemeContext";
import ModelViewer from "../utils/ModelViewer";
import { ensureAtSpotForAR } from "../utils/arLocationGate";
import InformationSkeleton from "../components/InformationSkeleton";
import { PhotoScrim } from "../components/ui";
import { spotImage, avatarImage } from "../utils/image";
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

export default function InformationScreen({ route, navigation }) {
  const spot = route?.params?.spot;
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Callers can deep-link to a specific tab (e.g. the Missions flow lands here
  // on the missions list rather than Overview).
  const initialTab = ["Overview", "BucketList", "Reviews"].includes(route?.params?.tab)
    ? route.params.tab
    : "Overview";
  const [activeTab,        setActiveTab]        = useState(initialTab);
  const [show3D,           setShow3D]           = useState(false);
  const [newRating,        setNewRating]        = useState(0);
  const [newReview,        setNewReview]        = useState("");
  const [showStarPicker,   setShowStarPicker]   = useState(false);
  const [refreshKey,       setRefreshKey]       = useState(0);
  const [screenReady,      setScreenReady]      = useState(false);
  const [reportTarget,     setReportTarget]     = useState(null);
  const [showReportModal,  setShowReportModal]  = useState(false);
  const [reportReason,     setReportReason]     = useState("");
  const [reportDetails,    setReportDetails]    = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  const inputRef = useRef(null);
  const { user: clerkUser } = useUser();
  const { isBookmarked, toggleBookmark }                                                           = useBookmark();
  const { getReviewsForSpot, addReview, reportReview, reactToReview, getAverageRating, getReviewCount, fetchReviews } = useReviews();
  const { fetchMissions, getMissionsForSpot, completedMissions }                                   = useMissions();
  const { profileImage } = useProfileImage();
  const isFocused = useIsFocused();

  useEffect(() => { if (!isFocused) setShow3D(false); }, [isFocused]);
  useEffect(() => {
    if (spot?._id) {
      setScreenReady(false);
      Promise.all([fetchReviews(spot._id), fetchMissions(spot._id)]).finally(() => setScreenReady(true));
    }
  }, [spot?._id]);

  if (!spot) return (
    <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.stateBadge, { backgroundColor: colors.brandSoft }]}>
        <Icon name="compass" size={26} color={colors.brand} />
      </View>
      <Text style={[styles.errorText, { color: colors.textSecondary }]}>No spot data found.</Text>
      <TouchableOpacity
        accessibilityRole="button" onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.accent }, shadow.sm]}>
        <Text style={[styles.backButtonText, { color: colors.onAccent }]}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  // The skeleton used to replace the ENTIRE screen, back button included — so on
  // a cold backend (Render spins down, 30s+ to wake) the user was stranded with
  // no way out. The header now renders immediately and only the body is a
  // skeleton, which is also why the title no longer pops in afterwards.
  if (!screenReady) return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 6, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={[styles.circleBtn, { backgroundColor: colors.card }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={19} color={colors.brandDark} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.brandDark }]} numberOfLines={1}>{spot.name}</Text>
        <View style={styles.headerRight} />
      </View>
      <InformationSkeleton />
    </View>
  );

  const spotIsBookmarked = isBookmarked(spot._id || spot.id);
  const reviews          = getReviewsForSpot(spot._id);
  const averageRating    = getAverageRating(spot._id) || "0.0";
  const reviewCount      = getReviewCount(spot._id);
  const missions         = getMissionsForSpot(spot._id);
  const isReviewsTab     = activeTab === "Reviews";
  const completedCount   = missions.filter((m) => completedMissions?.includes(m._id)).length;
  const totalCount       = missions.length;
  const progressRatio    = totalCount > 0 ? completedCount / totalCount : 0;
  const arMission        = missions.find((m) => m.type === "ar");

  const cityText = spot.city || spot.address || "Bulacan, Philippines";

  const tabs = [
    { key:"Overview",   label:"Overview", icon:"book-open" },
    { key:"BucketList", label:"Bakit List", icon:"flag"    },
    { key:"Reviews",    label:"Reviews",  icon:"star"      },
  ];

  const StarRating = ({ rating, size = 14 }) => (
    <View style={styles.starsRow}>
      {/* Earned stars are filled, the rest are outlines. Feather couldn't do
          this (outline-only) — which is exactly why MaterialIcons used to be
          pulled in here just for a filled star. */}
      {[1,2,3,4,5].map((s) => (
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

  const handleSubmit = async () => {
    if (newRating === 0) { setShowStarPicker(true); return; }
    if (newReview.trim() === "") return;
    if (submittingReview) return;

    setSubmittingReview(true);
    try {
      const result = await addReview(spot._id, newRating, newReview.trim());
      if (isSuspendedResult(result)) {
        showSuspendedAlert(result);
        return;
      }
      if (isMutedResult(result)) {
        showMutedAlert(result);
        return;
      }
      if (result && result.success === false) {
        showAlert("Error", result.message || "Failed to post your review. Please try again.");
        return;
      }
      setNewRating(0); setNewReview(""); setShowStarPicker(false); inputRef.current?.blur();
    } catch (err) {
      if (isSuspendedResult(err)) {
        showSuspendedAlert(err);
      } else if (isMutedResult(err)) {
        showMutedAlert(err);
      } else {
        showAlert("Error", "Failed to post your review. Please try again.");
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleBookmarkToggle = async () => { await toggleBookmark(spot); setRefreshKey(prev => prev + 1); };
  const handleLaunchAR = async () => {
    // AR models are anchored to real places at the spot — warn if the user
    // isn't physically there before launching.
    if (await ensureAtSpotForAR(spot)) {
      navigation.navigate("ar", { spot, arMissionId: arMission?._id ?? null });
    }
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
      if (result) showAlert("Report submitted", "Thank you. Our moderators will review this report.");
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

  const ReviewCard = ({ review }) => {
    const isMe = clerkUser?.id === review.clerkUserId;
    const avatarUri = isMe ? (profileImage || review.userImage || clerkUser?.imageUrl) : (review.userImage || "https://i.pravatar.cc/150?img=10");
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
        const result = await reactToReview(review._id, spot._id, type);
        if (isMutedResult(result)) {
          showMutedAlert(result);
        }
      } catch (err) {
        if (isMutedResult(err)) {
          showMutedAlert(err);
        }
      } finally {
        setReacting(false);
      }
    };

    return (
      <View style={styles.reviewCard}>
        <Image source={{ uri: avatarImage(avatarUri, 34) }} style={[styles.avatar, { borderColor: colors.cardBorder }]} />
        <View style={[styles.reviewBubble, { backgroundColor: colors.card }]}>
          <View style={styles.reviewBubbleHeader}>
            <Text style={[styles.reviewAuthor, { color: colors.brandDark }]}>{review.userName || "Anonymous"}</Text>
            <View style={styles.reviewBubbleHeaderRight}>
              <StarRating rating={review.rating} size={11} />
              <TouchableOpacity
                onPress={() => openReportModal(review)}
                activeOpacity={0.7}
                hitSlop={{ top:16, bottom:16, left:16, right:16 }}
                style={styles.reportButton}
                accessibilityRole="button"
                accessibilityLabel={`Report the review by ${review.userName || "this user"}`}
              >
                <Icon name="flag" size={13} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.reviewComment, { color: colors.textPrimary }]}>{review.comment}</Text>
          <View style={styles.reviewFooterRow}>
            <Text style={[styles.reviewDate, { color: colors.textMuted }]}>{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Just now"}</Text>
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
                  hitSlop={{ top:14, bottom:14, left:12, right:12 }}
                  style={styles.reactionBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: userReaction === "like" }}
                  accessibilityLabel={`Like this review, ${review.likes || 0} likes`}
                >
                  <Icon name="thumbs-up" size={13} color={userReaction === "like" ? colors.brand : colors.textMuted} />
                  <Text style={[styles.reactionCount, { color: userReaction === "like" ? colors.brand : colors.textMuted }]}>
                    {review.likes || 0}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleReact("dislike")}
                  disabled={reacting}
                  hitSlop={{ top:14, bottom:14, left:12, right:12 }}
                  style={styles.reactionBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: userReaction === "dislike" }}
                  accessibilityLabel={`Dislike this review, ${review.dislikes || 0} dislikes`}
                >
                  <Icon name="thumbs-down" size={13} color={userReaction === "dislike" ? colors.danger : colors.textMuted} />
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
  };

  const MissionRow = ({ mission }) => {
    const config = MISSION_CONFIG[mission.type] || MISSION_CONFIG.checkin;
    const isDone = completedMissions?.includes(mission._id);
    return (
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.missionRow}
        onPress={() => {
          if (mission.type === "ar") handleLaunchAR();
          else if (mission.type === "location") navigation.navigate("LocationMission", { spot, mission });
          else navigation.navigate("Mission", { spot, mission });
        }}
        activeOpacity={0.82}
      >
        <View style={styles.missionThumbWrap}>
          <View style={[styles.missionThumb, { backgroundColor: isDone ? colors.successBg : colors.brandSoft }]}>
            <Icon name={config.icon} size={19} color={isDone ? colors.success : colors.brand} />
          </View>
          {isDone && (
            <View style={[styles.checkBadge, { backgroundColor: colors.success, borderColor: colors.background }]}>
              <Icon name="check" size={10} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.missionRowBody}>
          <Text style={[styles.missionRowTitle, { color: colors.brandDark }, isDone && styles.missionRowTitleDone]} numberOfLines={2}>{mission.title}</Text>
          <Text style={[styles.missionRowSub, { color: colors.textMuted }]} numberOfLines={1}>{config.label} · {cityText}</Text>
        </View>
        {mission.type === "ar" && !isDone ? (
          <View style={[styles.arLaunchBadge, { backgroundColor: colors.accentSoft }]}>
            <Icon name="aperture" size={11} color={colors.accentDark} style={{ marginRight:4 }}/>
            <Text style={[styles.arLaunchBadgeText, { color: colors.accentDark }]}>Open AR</Text>
          </View>
        ) : (
          <Icon name="chevron-right" size={18} color={colors.textMuted} style={{ marginLeft:4 }} />
        )}
      </TouchableOpacity>
    );
  };

  const CircleBtn = ({ icon, onPress, active, iconNode, ...rest }) => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.circleBtn, { backgroundColor: active ? colors.accent : colors.card }]}
      hitSlop={6}
      {...rest}
    >
      {iconNode ?? <Icon name={icon} size={19} color={active ? colors.onAccent : colors.brandDark} />}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView key={refreshKey} style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 6, borderBottomColor: colors.divider }]}>
        <CircleBtn icon="chevron-left" onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={[styles.headerTitle, { color: colors.brandDark }]} numberOfLines={1}>{spot.name}</Text>
        <View style={styles.headerRight}>
          {spot.modelUrl && (
            <CircleBtn
              onPress={() => setShow3D(!show3D)}
              iconNode={<Icon name={show3D ? "image-outline" : "cube-scan"} size={20} color={colors.brandDark} />}
            />
          )}
          <CircleBtn
            onPress={handleBookmarkToggle}
            active={spotIsBookmarked}
            iconNode={<Icon name="bookmark" size={16} weight={spotIsBookmarked ? "fill" : "regular"} color={spotIsBookmarked ? colors.onAccent : colors.brandDark} />}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
      >
        {/* [0] Hero */}
        <View style={styles.heroWrap}>
          <View style={[styles.heroCard, { backgroundColor: colors.card }, shadow.md]}>
            {show3D && spot.modelUrl && isFocused ? (
              <ModelViewer url={spot.modelUrl} style={styles.heroImage} />
            ) : (
              <Image source={{ uri: spotImage(spot.image, 400, 260) }} style={styles.heroImage} resizeMode="cover" />
            )}
            <PhotoScrim from={0.5} />
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

        {/* [1] Sticky segmented tabs */}
        <View style={[styles.segmentWrap, { backgroundColor: colors.background }]}>
          <View style={[styles.segment, { backgroundColor: colors.card }]}>
            {tabs.map((tab) => {
              const on = activeTab === tab.key;
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={tab.key}
                  style={[styles.segmentItem, on && [styles.segmentItemActive, { backgroundColor: colors.background }, shadow.sm]]}
                  onPress={() => { setActiveTab(tab.key); setShowStarPicker(false); }}
                  activeOpacity={0.85}
                >
                  <Icon name={tab.icon} size={13} color={on ? colors.brand : colors.textMuted} />
                  <Text style={[styles.segmentText, { color: on ? colors.brand : colors.textMuted }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* [2] Body */}
        <View style={styles.bodyPad}>
          <Text style={[styles.title, { color: colors.brandDark }]}>{spot.name}</Text>

          {activeTab === "Overview" && (
            <>
              <Text style={[styles.sectionHeading, { color: colors.brandDark }]}>About</Text>
              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{spot.description || "Description coming soon..."}</Text>

              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {[
                  { icon:"clock",   label:"Visiting Hours", value: spot.visitingHours || "6:00 AM – 10:00 PM" },
                  { icon:"tag",     label:"Entrance Fee",   value: spot.entranceFee   || "Free" },
                  { icon:"map-pin", label:"Location",       value: cityText },
                  { icon:"phone",   label:"Contact",        value: spot.contact       || "N/A" },
                ].map((row, i, arr) => (
                  <React.Fragment key={row.label}>
                    <View style={styles.infoRow}>
                      <View style={[styles.infoIcon, { backgroundColor: colors.brandSoft }]}>
                        <Icon name={row.icon} size={14} color={colors.brand} />
                      </View>
                      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{row.label}</Text>
                      <Text style={[styles.infoValue, { color: colors.brandDark }]} numberOfLines={2}>{row.value}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={[styles.infoDivider, { backgroundColor: colors.cardBorder }]} />}
                  </React.Fragment>
                ))}
              </View>
            </>
          )}

          {activeTab === "BucketList" && (
            <>
              {missions.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={[styles.stateBadge, { backgroundColor: colors.brandSoft }]}>
                    <Icon name="flag" size={24} color={colors.brand} />
                  </View>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No missions for this spot yet.</Text>
                </View>
              ) : (
                <>
                  <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={styles.progressTop}>
                      <Text style={[styles.progressLabel, { color: colors.brandDark }]}>Your progress</Text>
                      <Text style={[styles.progressPct, { color: colors.brand }]}>{Math.round(progressRatio * 100)}%</Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: colors.brandSoft }]}>
                      <View style={[styles.progressFill, { width:`${progressRatio*100}%`, backgroundColor: colors.brand }]} />
                    </View>
                    <Text style={[styles.progressSub, { color: colors.textMuted }]}>{completedCount} of {totalCount} missions complete</Text>
                  </View>

                  <Text style={[styles.bucketSectionTitle, { color: colors.brandDark }]}>Bakit List for this spot</Text>
                  <View style={[styles.missionList, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    {missions.map((mission, i) => (
                      <React.Fragment key={mission._id}>
                        <MissionRow mission={mission} index={i} />
                        {i < missions.length - 1 && <View style={[styles.missionDivider, { backgroundColor: colors.cardBorder }]} />}
                      </React.Fragment>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {activeTab === "Reviews" && (
            <>
              <View style={[styles.ratingSummary, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.ratingBig, { color: colors.brandDark }]}>{averageRating}</Text>
                <StarRating rating={Math.round(parseFloat(averageRating))} size={18} />
                <Text style={[styles.reviewCountText, { color: colors.textMuted }]}>{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</Text>
              </View>
              <Text style={[styles.sectionHeading, { color: colors.brandDark }]}>All reviews ({reviewCount})</Text>
              {reviews.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={[styles.stateBadge, { backgroundColor: colors.brandSoft }]}>
                    <Icon name="message-square" size={24} color={colors.brand} />
                  </View>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No reviews yet — be the first!</Text>
                </View>
              ) : reviews.map((review) => <ReviewCard key={review._id} review={review} />)}
            </>
          )}

          <View style={{ height: isReviewsTab ? 96 : 108 }} />
        </View>
      </ScrollView>

      {/* Comment bar */}
      {isReviewsTab && (
        <View style={[styles.commentBarWrapper, { backgroundColor: colors.background, borderTopColor: colors.divider, paddingBottom: Math.max(insets.bottom, 12) }]}>
          {showStarPicker && (
            <View style={styles.starPickerRow}>
              <Text style={[styles.starPickerLabel, { color: colors.textMuted }]}>Your rating</Text>
              {[1,2,3,4,5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setNewRating(s)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${s} out of 5 stars`}
                  accessibilityState={{ selected: s <= newRating }}
                >
                  <Icon
                    name="star"
                    size={26}
                    weight={s <= newRating ? "fill" : "regular"}
                    color={s <= newRating ? colors.star : colors.starEmpty}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.commentBar}>
            <View style={[styles.commentAvatar, { backgroundColor: colors.card }]}>
              {(profileImage || clerkUser?.imageUrl) ? (
                <Image source={{ uri: avatarImage(profileImage || clerkUser?.imageUrl, 34) }} style={styles.commentAvatarImg} />
              ) : (
                <Icon name="user" size={16} color={colors.textMuted} />
              )}
            </View>
            <TouchableOpacity
              accessibilityRole="button" style={[styles.commentInputWrap, { backgroundColor: colors.card }]} activeOpacity={1} onPress={() => { setShowStarPicker(true); inputRef.current?.focus(); }}>
              <TextInput ref={inputRef} style={[styles.commentInput, { color: colors.brandDark }]} placeholder="Write a review..." placeholderTextColor={colors.textMuted} value={newReview} onChangeText={setNewReview} onFocus={() => setShowStarPicker(true)} multiline maxLength={500} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button" style={[styles.sendBtn, { backgroundColor: colors.accent }, (!newReview.trim() || newRating === 0 || submittingReview) && styles.sendBtnDisabled]} onPress={handleSubmit} disabled={!newReview.trim() || newRating === 0 || submittingReview}>
              {submittingReview ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Icon name="send" size={17} color={colors.onAccent} />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating action card — Navigate + AR */}
      {!isReviewsTab && (
        <View style={[styles.actionCard, { backgroundColor: colors.background, bottom: Math.max(insets.bottom, 14) + 10 }, shadow.lg]}>
          <TouchableOpacity
            accessibilityRole="button" style={styles.actionItem} onPress={() => navigation.navigate("Track", { spot })} activeOpacity={0.75}>
            <Icon name="navigation" size={17} color={colors.brand} />
            <Text style={[styles.actionText, { color: colors.brandDark }]}>Navigate</Text>
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.divider }]} />
          <TouchableOpacity
            accessibilityRole="button" style={styles.actionItem} onPress={handleLaunchAR} activeOpacity={0.75}>
            <Icon name="aperture" size={17} color={colors.brand} />
            <Text style={[styles.actionText, { color: colors.brandDark }]}>AR View</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Report modal */}
      <Modal visible={showReportModal} animationType="slide" transparent onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={[styles.modalGrabber, { backgroundColor: colors.divider }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.brandDark }]}>Report review</Text>
              <TouchableOpacity
                accessibilityRole="button" onPress={() => setShowReportModal(false)} hitSlop={8}><Icon name="x" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>
            {reportTarget && <Text style={[styles.reportSubtitle, { color: colors.textMuted }]}>Reporting comment by <Text style={{ fontFamily: fonts.sansBold, color: colors.brandDark }}>{reportTarget.userName}</Text></Text>}
            <Text style={[styles.modalLabel, { color: colors.brandDark }]}>Reason</Text>
            <View style={styles.reasonList}>
              {REPORT_REASONS.map((r) => (
                <TouchableOpacity
                  accessibilityRole="button" key={r.key} style={[styles.reasonOption, { backgroundColor: colors.card, borderColor: colors.cardBorder }, reportReason === r.key && { borderColor: colors.brand, backgroundColor: colors.brandLight }]} onPress={() => setReportReason(r.key)} activeOpacity={0.8}>
                  <View style={[styles.reasonRadio, { borderColor: colors.textMuted }, reportReason === r.key && { borderColor: colors.brand, backgroundColor: colors.brand }]} />
                  <Text style={[styles.reasonLabel, { color: colors.textMuted }, reportReason === r.key && { color: colors.brandDark, fontFamily: fonts.sansSemi }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.modalLabel, { color: colors.brandDark }]}>Additional details (optional)</Text>
            <TextInput style={[styles.reportDetailsInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.brandDark }]} multiline placeholder="Add any extra context..." placeholderTextColor={colors.textMuted} value={reportDetails} onChangeText={setReportDetails} textAlignVertical="top" />
            <TouchableOpacity
              accessibilityRole="button" style={[styles.submitButton, { backgroundColor: colors.accent }, submittingReport && { opacity:0.6 }]} onPress={handleSubmitReport} disabled={submittingReport} activeOpacity={0.85}>
              <Text style={[styles.submitButtonText, { color: colors.onAccent }]}>{submittingReport ? "Submitting..." : "Submit report"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex:1 },
  errorContainer:  { flex:1, justifyContent:"center", alignItems:"center", gap:14, paddingHorizontal:32 },
  errorText:       { fontSize:15, fontFamily: fonts.sansMedium },
  backButton:      { paddingHorizontal:28, paddingVertical:12, borderRadius:999 },
  backButtonText:  { fontFamily: fonts.sansBold, fontSize:13.5 },

  header:          { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:14, paddingBottom:10, borderBottomWidth:1 },
  headerTitle:     { flex:1, textAlign:"center", fontSize:16.5, fontFamily: fonts.sansBold, letterSpacing:-0.2, marginHorizontal:8 },
  headerRight:     { flexDirection:"row", alignItems:"center", gap:8 },
  circleBtn:       { width:38, height:38, borderRadius:19, justifyContent:"center", alignItems:"center" },

  scrollView:      { flex:1 },
  scrollContent:   { paddingBottom:0 },

  heroWrap:        { paddingHorizontal:16, paddingTop:14, paddingBottom:4 },
  heroCard:        { borderRadius:radius.xl, overflow:"hidden", height:288 },
  heroImage:       { width:"100%", height:"100%" },
  heroRating:      { position:"absolute", top:12, left:12, flexDirection:"row", alignItems:"center", gap:3, backgroundColor:"rgba(11,30,32,0.62)", paddingHorizontal:10, paddingVertical:5, borderRadius:999 },
  heroRatingText:  { color:"#fff", fontSize:12.5, fontFamily: fonts.sansBold },
  heroRatingCount: { color:"rgba(255,255,255,0.75)", fontSize:11, fontFamily: fonts.sansSemi },
  heroCaption:     { position:"absolute", left:14, right:14, bottom:12, flexDirection:"row", alignItems:"center", gap:5 },
  heroCaptionText: { color:"#fff", fontSize:12.5, fontFamily: fonts.sansBold, flex:1, textShadowColor:"rgba(0,0,0,0.5)", textShadowRadius:6 },

  segmentWrap:     { paddingHorizontal:16, paddingTop:8, paddingBottom:10 },
  segment:         { flexDirection:"row", borderRadius:999, padding:4, gap:4 },
  segmentItem:     { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, paddingVertical:9, borderRadius:999 },
  segmentItemActive:{ },
  segmentText:     { fontSize:13, fontFamily: fonts.sansBold, letterSpacing:-0.1 },

  bodyPad:         { paddingHorizontal:22, paddingTop:10 },
  title:           { fontSize:24, fontFamily: fonts.sansBold, letterSpacing:-0.5, marginBottom:14 },

  sectionHeading:  { fontSize:16, fontFamily: fonts.sansBold, letterSpacing:-0.2, marginBottom:10, marginTop:6 },
  descriptionText: { fontSize:13.5, lineHeight:21, marginBottom:18 },

  infoCard:        { borderRadius:radius.card, borderWidth:1, paddingHorizontal:16, paddingVertical:6 },
  infoRow:         { flexDirection:"row", alignItems:"center", gap:11, paddingVertical:12 },
  infoIcon:        { width:30, height:30, borderRadius:15, justifyContent:"center", alignItems:"center" },
  infoLabel:       { fontSize:12.5, fontFamily: fonts.sansSemi, width:96 },
  infoValue:       { fontSize:13, fontFamily: fonts.sansBold, flex:1, textAlign:"right" },
  infoDivider:     { height:1 },

  progressCard:    { borderRadius:radius.card, borderWidth:1, padding:16, marginBottom:20, marginTop:2 },
  progressTop:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  progressLabel:   { fontSize:14, fontFamily: fonts.sansBold, letterSpacing:-0.2 },
  progressPct:     { fontSize:15, fontFamily: fonts.sansBold },
  progressTrack:   { height:8, borderRadius:4, overflow:"hidden" },
  progressFill:    { height:"100%", borderRadius:4 },
  progressSub:     { fontSize:12, fontFamily: fonts.sansSemi, marginTop:8 },

  bucketSectionTitle: { fontSize:17, fontFamily: fonts.sansBold, letterSpacing:-0.3, marginBottom:12 },
  missionList:     { borderRadius:radius.card, borderWidth:1, overflow:"hidden" },
  missionRow:      { flexDirection:"row", alignItems:"center", paddingHorizontal:14, paddingVertical:13, gap:12 },
  missionDivider:  { height:1, marginLeft:70 },
  missionThumbWrap:{ position:"relative" },
  missionThumb:    { width:46, height:46, borderRadius:14, justifyContent:"center", alignItems:"center" },
  checkBadge:      { position:"absolute", bottom:-3, right:-3, width:18, height:18, borderRadius:9, justifyContent:"center", alignItems:"center", borderWidth:2 },
  missionRowBody:  { flex:1, gap:3 },
  missionRowTitle: { fontSize:14, fontFamily: fonts.sansBold, lineHeight:19 },
  // No strikethrough. The green tick on the thumbnail already says "done", and
  // a line through the title says something different — crossed-out text reads
  // as cancelled or no longer available, which is the opposite of an
  // achievement the user just earned. The tick is the only completion marker.
  missionRowTitleDone: { opacity:0.72 },
  missionRowSub:   { fontSize:11.5, fontFamily: fonts.sansMedium },
  arLaunchBadge:   { flexDirection:"row", alignItems:"center", borderRadius:999, paddingHorizontal:10, paddingVertical:5, marginLeft:4 },
  arLaunchBadgeText: { fontSize:11, fontFamily: fonts.sansBold },

  emptyState:      { alignItems:"center", paddingVertical:36, gap:12 },
  emptyText:       { fontSize:13, fontFamily: fonts.sansMedium, textAlign:"center" },

  ratingSummary:   { borderRadius:radius.card, padding:22, marginBottom:16, alignItems:"center", borderWidth:1 },
  ratingBig:       { fontSize:48, fontFamily: fonts.sansBold, letterSpacing:-1, marginBottom:6 },
  starsRow:        { flexDirection:"row", gap:3, marginBottom:4 },
  reviewCountText: { fontSize:12.5, fontFamily: fonts.sansSemi, marginTop:4 },

  reviewCard:      { flexDirection:"row", alignItems:"flex-start", gap:10, marginBottom:12 },
  avatar:          { width:36, height:36, borderRadius:18, marginTop:2, borderWidth:1.5 },
  reviewBubble:    { flex:1, borderRadius:radius.lg, paddingHorizontal:15, paddingVertical:12 },
  reviewBubbleHeader:      { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:4 },
  reviewBubbleHeaderRight: { flexDirection:"row", alignItems:"center", gap:8 },
  reviewAuthor:    { fontSize:13, fontFamily: fonts.sansBold },
  reviewComment:   { fontSize:13, lineHeight:19 },
  reviewFooterRow: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginTop:6 },
  reviewDate:      { fontSize:11, fontFamily: fonts.sansMedium },
  reactionsRow:    { flexDirection:"row", alignItems:"center", gap:14 },
  reactionBtn:     { flexDirection:"row", alignItems:"center", gap:4 },
  reactionBtnDisabled: { opacity:0.35 },
  reactionCount:   { fontSize:12, fontFamily: fonts.sansBold },
  reportButton:    { padding:2 },

  commentBarWrapper: { borderTopWidth:1, paddingTop:10, paddingHorizontal:14 },
  starPickerRow:   { flexDirection:"row", alignItems:"center", gap:8, paddingHorizontal:4, paddingBottom:10 },
  starPickerLabel: { fontSize:12.5, fontFamily: fonts.sansBold, marginRight:4 },
  commentBar:      { flexDirection:"row", alignItems:"flex-end", gap:8 },
  commentAvatar:   { width:36, height:36, borderRadius:18, justifyContent:"center", alignItems:"center", marginBottom:2, overflow:"hidden" },
  commentAvatarImg:{ width:36, height:36, borderRadius:18 },
  commentInputWrap:{ flex:1, borderRadius:999, paddingHorizontal:16, paddingVertical:10, minHeight:42, maxHeight:100, justifyContent:"center" },
  commentInput:    { fontSize:14, padding:0 },
  sendBtn:         { width:40, height:40, borderRadius:20, justifyContent:"center", alignItems:"center", marginBottom:1 },
  sendBtnDisabled: { opacity:0.5 },

  actionCard:      { position:"absolute", alignSelf:"center", flexDirection:"row", alignItems:"center", borderRadius:999, paddingHorizontal:6, paddingVertical:5 },
  actionItem:      { flexDirection:"row", alignItems:"center", gap:8, paddingVertical:11, paddingHorizontal:22 },
  actionText:      { fontFamily: fonts.sansBold, fontSize:13.5, letterSpacing:-0.2 },
  actionDivider:   { width:1, alignSelf:"stretch", marginVertical:8 },

  modalOverlay:    { flex:1, backgroundColor:"rgba(11,30,32,0.55)", justifyContent:"flex-end" },
  modalContent:    { borderTopLeftRadius:radius.xl, borderTopRightRadius:radius.xl, paddingHorizontal:24, paddingTop:10, maxHeight:"88%" },
  modalGrabber:    { alignSelf:"center", width:40, height:4, borderRadius:2, marginBottom:14 },
  modalHeader:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:12 },
  modalTitle:      { fontSize:20, fontFamily: fonts.sansBold, letterSpacing:-0.3 },
  modalLabel:      { fontSize:14, fontFamily: fonts.sansBold, marginBottom:10, marginTop:14 },
  reportSubtitle:  { fontSize:13.5, marginBottom:4 },
  reasonList:      { gap:8, marginBottom:4 },
  reasonOption:    { flexDirection:"row", alignItems:"center", borderRadius:radius.md, paddingVertical:13, paddingHorizontal:14, borderWidth:1.5, gap:12 },
  reasonRadio:     { width:18, height:18, borderRadius:9, borderWidth:2 },
  reasonLabel:     { fontSize:14 },
  reportDetailsInput: { borderRadius:radius.md, padding:14, fontSize:14, minHeight:88, marginBottom:18, borderWidth:1.5, textAlignVertical:"top" },
  submitButton:    { paddingVertical:15, borderRadius:radius.button, alignItems:"center" },
  submitButtonText:{ fontSize:15, fontFamily: fonts.sansBold },

  stateBadge:      { width:56, height:56, borderRadius:28, justifyContent:"center", alignItems:"center" },
});
