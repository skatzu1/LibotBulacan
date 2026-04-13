import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useBookmark } from "../context/BookmarkContext";
import { useReviews } from "../context/ReviewContext";
import { useMissions } from "../context/MissionContext";
import ModelViewer from "../utils/ModelViewer";

const { width } = Dimensions.get("window");

const MISSION_CONFIG = {
  checkin: { icon: "map-pin",    color: "#6b4b45", label: "Check In" },
  photo:   { icon: "camera",     color: "#4a7c59", label: "Photo"    },
  ar:      { icon: "aperture",   color: "#2e4a7c", label: "AR"       },
  quiz:    { icon: "help-circle",color: "#7c4a2e", label: "Quiz"     },
};

export default function InformationScreen({ route, navigation }) {
  const spot = route?.params?.spot;

  const [activeTab, setActiveTab]           = useState("Overview");
  const [show3D, setShow3D]                 = useState(false);
  const [newRating, setNewRating]           = useState(0);
  const [newReview, setNewReview]           = useState("");
  const [showStarPicker, setShowStarPicker] = useState(false);
  const [refreshKey, setRefreshKey]         = useState(0);

  const inputRef = useRef(null);

  const { isBookmarked, toggleBookmark }                                                   = useBookmark();
  const { getReviewsForSpot, addReview, getAverageRating, getReviewCount, fetchReviews }   = useReviews();
  const { fetchMissions, getMissionsForSpot, completedMissions }                           = useMissions();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) setShow3D(false);
  }, [isFocused]);

  useEffect(() => {
    if (spot?._id) {
      fetchReviews(spot._id);
      fetchMissions(spot._id);
    }
  }, [spot?._id]);

  if (!spot) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No spot data found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const spotIsBookmarked = isBookmarked(spot._id || spot.id);
  const reviews          = getReviewsForSpot(spot._id);
  const averageRating    = getAverageRating(spot._id) || "0.0";
  const reviewCount      = getReviewCount(spot._id);
  const missions         = getMissionsForSpot(spot._id);
  const isReviewsTab     = activeTab === "Reviews";

  // Progress helpers
  const completedCount = missions.filter(
    (m) => completedMissions?.includes(m._id)
  ).length;
  const totalCount     = missions.length;
  const progressRatio  = totalCount > 0 ? completedCount / totalCount : 0;

  const tabs = [
    { key: "Overview",   label: "Overview",    icon: "book-open" },
    { key: "BucketList", label: "Bakit List",  icon: "list"      },
    { key: "Reviews",    label: "Reviews",      icon: "star"      },
  ];

  const StarRating = ({ rating, size = 14 }) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Feather key={s} name="star" size={size} color={s <= rating ? "#f4c542" : "#d9b8b5"} />
      ))}
    </View>
  );

  const handleSubmit = async () => {
    if (newRating === 0) { setShowStarPicker(true); return; }
    if (newReview.trim() === "") return;
    await addReview(spot._id, newRating, newReview.trim());
    setNewRating(0);
    setNewReview("");
    setShowStarPicker(false);
    inputRef.current?.blur();
  };

  const handleBookmarkToggle = async () => {
    await toggleBookmark(spot);
    setRefreshKey(prev => prev + 1);
  };

  const ReviewCard = ({ review }) => (
    <View style={styles.reviewCard}>
      <Image
        source={{
          uri: review.userImage && review.userImage !== ""
            ? review.userImage
            : "https://i.pravatar.cc/150?img=10",
        }}
        style={styles.avatar}
      />
      <View style={styles.reviewBubble}>
        <View style={styles.reviewBubbleHeader}>
          <Text style={styles.reviewAuthor}>{review.userName || "Anonymous"}</Text>
          <StarRating rating={review.rating} size={11} />
        </View>
        <Text style={styles.reviewComment}>{review.comment}</Text>
        <Text style={styles.reviewDate}>
          {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Just now"}
        </Text>
      </View>
    </View>
  );

  /* ── Bucket List mission row (reference style) ── */
  const MissionRow = ({ mission, index }) => {
    const config      = MISSION_CONFIG[mission.type] || MISSION_CONFIG.checkin;
    const isDone      = completedMissions?.includes(mission._id);

    return (
      <TouchableOpacity
        style={styles.missionRow}
        onPress={() => navigation.navigate("Mission", { spot, mission })}
        activeOpacity={0.82}
      >
        {/* Thumbnail */}
        <View style={styles.missionThumbWrap}>
          {null ? (
  <Image source={{ uri: spot.image }} style={styles.missionThumb} resizeMode="cover" />
) : (
            <View style={[styles.missionThumb, { backgroundColor: "#e8d0ce", justifyContent: "center", alignItems: "center" }]}>
              <Feather name={config.icon} size={20} color={config.color} />
            </View>
          )}
          {/* Completed checkmark badge */}
          {isDone && (
            <View style={styles.checkBadge}>
              <Feather name="check" size={10} color="#fff" />
            </View>
          )}
        </View>

        {/* Text */}
        <View style={styles.missionRowBody}>
          <Text style={[styles.missionRowTitle, isDone && styles.missionRowTitleDone]} numberOfLines={2}>
            {mission.title}
          </Text>
          <Text style={styles.missionRowSub} numberOfLines={1}>
            {spot.location || "Philippines"}
          </Text>
        </View>

        {/* Right arrow */}
        <Feather name="chevron-right" size={18} color="#c4a09d" style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      key={refreshKey}
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* ── Top Header ── */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={24} color="#4a2e2c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{spot.name}</Text>
        <View style={styles.headerRight}>
          {spot.modelUrl && (
            <TouchableOpacity onPress={() => setShow3D(!show3D)} style={styles.iconBtn}>
              <MaterialCommunityIcons
                name={show3D ? "image-outline" : "cube-scan"}
                size={22}
                color="#4a2e2c"
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleBookmarkToggle} style={styles.iconBtn} activeOpacity={0.7}>
            <FontAwesome5
              name="bookmark"
              size={20}
              solid={spotIsBookmarked}
              color={spotIsBookmarked ? "#f4c542" : "#4a2e2c"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => { setActiveTab(tab.key); setShowStarPicker(false); }}
            activeOpacity={0.8}
          >
            <Feather
              name={tab.icon}
              size={13}
              color={activeTab === tab.key ? "#fff" : "#7a5a58"}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Scrollable body ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroContainer}>
          {show3D && spot.modelUrl && isFocused ? (
            <ModelViewer url={spot.modelUrl} style={styles.heroImage} />
          ) : (
            <Image source={{ uri: spot.image }} style={styles.heroImage} resizeMode="cover" />
          )}
        </View>

        <View style={styles.bodyPad}>
          <Text style={styles.title}>{spot.name}</Text>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === "Overview" && (
            <>
              <Text style={styles.sectionHeading}>About</Text>
              <Text style={styles.descriptionText}>
                {spot.description || "Description coming soon..."}
              </Text>
              <View style={[styles.divider, { marginVertical: 14 }]} />
              <View style={styles.infoRow}>
                <Feather name="clock" size={14} color="#6b4b45" />
                <Text style={styles.infoLabel}>Visiting Hours</Text>
                <Text style={styles.infoValue}>{spot.visitingHours || "6:00 AM – 10:00 PM"}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Feather name="tag" size={14} color="#6b4b45" />
                <Text style={styles.infoLabel}>Entrance Fee</Text>
                <Text style={styles.infoValue}>{spot.entranceFee || "Free"}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Feather name="map-pin" size={14} color="#6b4b45" />
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {spot.address || "Malolos, Bulacan, Philippines"}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Feather name="phone" size={14} color="#6b4b45" />
                <Text style={styles.infoLabel}>Contact</Text>
                <Text style={styles.infoValue}>{spot.contact || "N/A"}</Text>
              </View>
            </>
          )}

          {/* ── BUCKET LIST TAB ── */}
          {activeTab === "BucketList" && (
            <>
              {missions.length === 0 ? (
                <View style={styles.emptyMissions}>
                  <ActivityIndicator color="#6b4b45" />
                  <Text style={styles.emptyText}>Loading missions...</Text>
                </View>
              ) : (
                <>
                  {/* Progress header */}
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>
                      {completedCount} of {totalCount} complete
                    </Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
                    </View>
                  </View>

                  {/* Section title */}
                  <Text style={styles.bucketSectionTitle}>On this Bakit List</Text>

                  {/* Mission rows */}
                  <View style={styles.missionList}>
                    {missions.map((mission, i) => (
                      <React.Fragment key={mission._id}>
                        <MissionRow mission={mission} index={i} />
                        {i < missions.length - 1 && <View style={styles.missionDivider} />}
                      </React.Fragment>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {/* ── REVIEWS TAB ── */}
          {activeTab === "Reviews" && (
            <>
              <View style={styles.ratingSummary}>
                <Text style={styles.ratingBig}>{averageRating}</Text>
                <StarRating rating={Math.round(parseFloat(averageRating))} size={20} />
                <Text style={styles.reviewCountText}>
                  {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                </Text>
              </View>
              <Text style={styles.sectionHeading}>All Reviews ({reviewCount})</Text>
              {reviews.length === 0 ? (
                <View style={styles.emptyReviews}>
                  <Feather name="message-square" size={32} color="#d9b8b5" />
                  <Text style={styles.emptyText}>Wala pang review. Maging una!</Text>
                </View>
              ) : (
                reviews.map((review) => (
                  <ReviewCard key={review._id} review={review} />
                ))
              )}
            </>
          )}

          <View style={{ height: isReviewsTab ? 90 : 100 }} />
        </View>
      </ScrollView>

      {/* ── Comment bar (Reviews only) ── */}
      {isReviewsTab && (
        <View style={styles.commentBarWrapper}>
          {showStarPicker && (
            <View style={styles.starPickerRow}>
              <Text style={styles.starPickerLabel}>Rate:</Text>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setNewRating(s)}>
                  <Feather name="star" size={26} color={s <= newRating ? "#f4c542" : "#d9b8b5"} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.commentBar}>
            <View style={styles.commentAvatar}>
              <Feather name="user" size={16} color="#7a5a58" />
            </View>
            <TouchableOpacity
              style={styles.commentInputWrap}
              activeOpacity={1}
              onPress={() => { setShowStarPicker(true); inputRef.current?.focus(); }}
            >
              <TextInput
                ref={inputRef}
                style={styles.commentInput}
                placeholder="Write a review..."
                placeholderTextColor="#b0908c"
                value={newReview}
                onChangeText={setNewReview}
                onFocus={() => setShowStarPicker(true)}
                multiline
                maxLength={500}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, (!newReview.trim() || newRating === 0) && styles.sendBtnDisabled]}
              onPress={handleSubmit}
              disabled={!newReview.trim() || newRating === 0}
            >
              <Feather name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Floating Map + AR ── */}
      {!isReviewsTab && (
        <View style={styles.floatingBar}>
          <TouchableOpacity
            style={styles.floatingBtn}
            onPress={() => navigation.navigate("Track", { spot })}
            activeOpacity={0.85}
          >
            <Feather name="map-pin" size={15} color="#fff" />
            <Text style={styles.floatingBtnText}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.floatingBtn}
            onPress={() => navigation.navigate("ar", { spot })}
            activeOpacity={0.85}
          >
            <Feather name="camera" size={15} color="#fff" />
            <Text style={styles.floatingBtnText}>AR</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#fff", paddingTop: 50 },
  errorContainer:  { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, backgroundColor: "#fff" },
  errorText:       { fontSize: 16, color: "#7a5a58" },
  backButton:      { backgroundColor: "#6b4b45", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backButtonText:  { color: "#fff", fontWeight: "700" },

  topHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 10 },
  headerTitle:  { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#4a2e2c", marginHorizontal: 8 },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 2 },
  iconBtn:      { width: 38, height: 38, justifyContent: "center", alignItems: "center" },

  tabsContainer: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  tab:           { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 20, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#f0e0de" },
  activeTab:     { backgroundColor: "#6b4b45", borderColor: "#6b4b45" },
  tabText:       { fontSize: 15, fontWeight: "600", color: "#7a5a58" },
  activeTabText: { color: "#fff" },

  scrollView:    { flex: 1 },
  scrollContent: { paddingBottom: 0 },
  heroContainer: { width: width, height: 350 },
  heroImage:     { width: "100%", height: "100%" },
  bodyPad:       { paddingHorizontal: 20, paddingTop: 18 },
  title:         { fontSize: 22, fontWeight: "700", color: "#4a2e2c", marginBottom: 14 },

  infoRow:   { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 6 },
  infoLabel: { fontSize: 13, fontWeight: "600", color: "#7a5a58", width: 105 },
  infoValue: { fontSize: 13, fontWeight: "600", color: "#4a2e2c", flex: 1 },
  divider:   { height: 1, backgroundColor: "#f0e0de", marginVertical: 2 },

  sectionHeading:  { fontSize: 14, fontWeight: "700", color: "#4a2e2c", marginBottom: 10, marginTop: 8 },
  descriptionText: { fontSize: 13, color: "#7a5a58", lineHeight: 20 },

  // ── Bucket List ──
  progressHeader: {
    marginBottom: 14,
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7a5a58",
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#f0e0de",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6b4b45",
    borderRadius: 3,
  },
  bucketSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2e1c1a",
    marginBottom: 12,
  },
  missionList: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0e0de",
    overflow: "hidden",
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: "#fff",
  },
  missionDivider: {
    height: 1,
    backgroundColor: "#f0e0de",
    marginLeft: 72,
  },
  missionThumbWrap: {
    position: "relative",
  },
  missionThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#e8d0ce",
  },
  checkBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#4a7c59",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  missionRowBody: {
    flex: 1,
    gap: 3,
  },
  missionRowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2e1c1a",
    lineHeight: 19,
  },
  missionRowTitleDone: {
    color: "#a08888",
    textDecorationLine: "line-through",
  },
  missionRowSub: {
    fontSize: 12,
    color: "#9a7a78",
  },

  emptyMissions: { alignItems: "center", paddingVertical: 32, gap: 10 },

  // ── Reviews ──
  ratingSummary:   { backgroundColor: "#faf5f4", borderRadius: 16, padding: 20, marginBottom: 14, alignItems: "center", borderWidth: 1, borderColor: "#f0e0de" },
  ratingBig:       { fontSize: 48, fontWeight: "700", color: "#4a2e2c", marginBottom: 6 },
  starsRow:        { flexDirection: "row", gap: 3, marginBottom: 4 },
  reviewCountText: { fontSize: 13, color: "#7a5a58", marginTop: 4 },
  reviewCard:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  avatar:          { width: 38, height: 38, borderRadius: 19, marginTop: 2 },
  reviewBubble:         { flex: 1, backgroundColor: "#f4eeee", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  reviewBubbleHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  reviewAuthor:         { fontSize: 13, fontWeight: "700", color: "#4a2e2c" },
  reviewComment:        { fontSize: 13, color: "#4a2e2c", lineHeight: 19 },
  reviewDate:           { fontSize: 11, color: "#b0908c", marginTop: 5 },
  emptyReviews:         { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText:            { fontSize: 13, color: "#b89898" },

  // ── Comment bar ──
  commentBarWrapper: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f0e0de", paddingBottom: Platform.OS === "ios" ? 28 : 12, paddingTop: 8, paddingHorizontal: 12 },
  starPickerRow:     { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingBottom: 10 },
  starPickerLabel:   { fontSize: 13, fontWeight: "600", color: "#7a5a58", marginRight: 4 },
  commentBar:        { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  commentAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f0e0de", justifyContent: "center", alignItems: "center", marginBottom: 2 },
  commentInputWrap:  { flex: 1, backgroundColor: "#f4eeee", borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, maxHeight: 100, justifyContent: "center" },
  commentInput:      { fontSize: 14, color: "#4a2e2c", padding: 0 },
  sendBtn:           { width: 38, height: 38, borderRadius: 19, backgroundColor: "#6b4b45", justifyContent: "center", alignItems: "center", marginBottom: 2 },
  sendBtnDisabled:   { backgroundColor: "#d9b8b5" },

  // ── Floating bar ──
  floatingBar:    { position: "absolute", bottom: 36, alignSelf: "center", flexDirection: "row", gap: 12 },
  floatingBtn:    { flexDirection: "row", alignItems: "center", backgroundColor: "#4a2e2c", paddingVertical: 12, paddingHorizontal: 28, borderRadius: 30, gap: 7, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 6 },
  floatingBtnText:{ color: "#fff", fontWeight: "700", fontSize: 14 },
});