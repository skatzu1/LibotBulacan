import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, Alert, StatusBar,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useIsFocused } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useBookmark } from "../context/BookmarkContext";
import { useReviews } from "../context/ReviewContext";
import { useMissions } from "../context/MissionContext";
import { useProfileImage } from "../context/ProfileImageContext";
import { useTheme } from "../context/ThemeContext";
import ModelViewer from "../utils/ModelViewer";
import InformationSkeleton from "../components/InformationSkeleton";

const { width } = Dimensions.get("window");

const MISSION_CONFIG = {
  checkin: { icon:"map-pin",     color:"#6b4b45", label:"Check In" },
  photo:   { icon:"camera",      color:"#4a7c59", label:"Photo"    },
  ar:      { icon:"aperture",    color:"#2e4a7c", label:"AR"       },
  quiz:    { icon:"help-circle", color:"#7c4a2e", label:"Quiz"     },
};

const REPORT_REASONS = [
  { key:"spam",               label:"Spam" },
  { key:"offensive_language", label:"Offensive language" },
  { key:"fake_review",        label:"Fake review" },
  { key:"harassment",         label:"Harassment" },
  { key:"other",              label:"Other" },
];

export default function InformationScreen({ route, navigation }) {
  const spot = route?.params?.spot;
  const { colors, isDark } = useTheme();

  const [activeTab,        setActiveTab]        = useState("Overview");
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

  const inputRef = useRef(null);
  const { user: clerkUser } = useUser();
  const { isBookmarked, toggleBookmark }                                                           = useBookmark();
  const { getReviewsForSpot, addReview, reportReview, getAverageRating, getReviewCount, fetchReviews } = useReviews();
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
      <Text style={[styles.errorText, { color: colors.textMuted }]}>No spot data found.</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.brand }]}>
        <Text style={styles.backButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  if (!screenReady) return <InformationSkeleton />;

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

  const tabs = [
    { key:"Overview",   label:"Overview",   icon:"book-open" },
    { key:"BucketList", label:"Bakit List", icon:"list"      },
    { key:"Reviews",    label:"Reviews",    icon:"star"      },
  ];

  const StarRating = ({ rating, size = 14 }) => (
    <View style={styles.starsRow}>
      {[1,2,3,4,5].map((s) => <Feather key={s} name="star" size={size} color={s <= rating ? "#f4c542" : colors.textMuted} />)}
    </View>
  );

  const handleSubmit = async () => {
    if (newRating === 0) { setShowStarPicker(true); return; }
    if (newReview.trim() === "") return;
    await addReview(spot._id, newRating, newReview.trim());
    setNewRating(0); setNewReview(""); setShowStarPicker(false); inputRef.current?.blur();
  };

  const handleBookmarkToggle = async () => { await toggleBookmark(spot); setRefreshKey(prev => prev + 1); };
  const handleLaunchAR = () => navigation.navigate("ar", { spot, arMissionId: arMission?._id ?? null });

  const openReportModal = (review) => {
    setReportTarget({ reviewId: review._id, reportedClerkUserId: review.clerkUserId || "", userName: review.userName || "this user" });
    setReportReason(""); setReportDetails(""); setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReason) { Alert.alert("Select a reason", "Please choose a reason for reporting."); return; }
    setSubmittingReport(true);
    const success = await reportReview({ reviewId: reportTarget.reviewId, reportedClerkUserId: reportTarget.reportedClerkUserId, reason: reportReason, details: reportDetails });
    setSubmittingReport(false); setShowReportModal(false);
    if (success) Alert.alert("Report submitted", "Thank you. Our moderators will review this report.");
    else Alert.alert("Error", "Failed to submit report. Please try again.");
  };

  const ReviewCard = ({ review }) => {
    const isMe = clerkUser?.id === review.clerkUserId;
    const avatarUri = isMe ? (profileImage || review.userImage || clerkUser?.imageUrl) : (review.userImage || "https://i.pravatar.cc/150?img=10");
    return (
      <View style={styles.reviewCard}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} defaultSource={{ uri: "https://i.pravatar.cc/150?img=10" }} />
        <View style={[styles.reviewBubble, { backgroundColor: colors.card }]}>
          <View style={styles.reviewBubbleHeader}>
            <Text style={[styles.reviewAuthor, { color: colors.brandDark }]}>{review.userName || "Anonymous"}</Text>
            <View style={styles.reviewBubbleHeaderRight}>
              <StarRating rating={review.rating} size={11} />
              <TouchableOpacity onPress={() => openReportModal(review)} activeOpacity={0.7} hitSlop={{ top:8,bottom:8,left:8,right:8 }} style={styles.reportButton}>
                <Feather name="flag" size={13} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.reviewComment, { color: colors.textPrimary }]}>{review.comment}</Text>
          <Text style={[styles.reviewDate, { color: colors.textMuted }]}>{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Just now"}</Text>
        </View>
      </View>
    );
  };

  const MissionRow = ({ mission }) => {
    const config = MISSION_CONFIG[mission.type] || MISSION_CONFIG.checkin;
    const isDone = completedMissions?.includes(mission._id);
    return (
      <TouchableOpacity style={[styles.missionRow, { backgroundColor: colors.card }]} onPress={() => { if (mission.type === "ar") handleLaunchAR(); else navigation.navigate("Mission", { spot, mission }); }} activeOpacity={0.82}>
        <View style={styles.missionThumbWrap}>
          <View style={[styles.missionThumb, { backgroundColor: colors.backgroundHero ?? "#e8d0ce", justifyContent:"center", alignItems:"center" }]}>
            <Feather name={config.icon} size={20} color={config.color} />
          </View>
          {isDone && <View style={styles.checkBadge}><Feather name="check" size={10} color="#fff" /></View>}
        </View>
        <View style={styles.missionRowBody}>
          <Text style={[styles.missionRowTitle, { color: colors.brandDark }, isDone && styles.missionRowTitleDone]} numberOfLines={2}>{mission.title}</Text>
          <Text style={[styles.missionRowSub, { color: colors.textMuted }]} numberOfLines={1}>{spot.location || "Philippines"}</Text>
        </View>
        {mission.type === "ar" && !isDone ? (
          <View style={styles.arLaunchBadge}><Feather name="aperture" size={11} color="#2e4a7c" style={{ marginRight:4 }}/><Text style={styles.arLaunchBadgeText}>Open AR</Text></View>
        ) : (
          <Feather name="chevron-right" size={18} color={colors.textMuted} style={{ marginLeft:4 }} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView key={refreshKey} style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Feather name="chevron-left" size={24} color={colors.brandDark} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.brandDark }]} numberOfLines={1}>{spot.name}</Text>
        <View style={styles.headerRight}>
          {spot.modelUrl && (
            <TouchableOpacity onPress={() => setShow3D(!show3D)} style={styles.iconBtn}>
              <MaterialCommunityIcons name={show3D ? "image-outline" : "cube-scan"} size={22} color={colors.brandDark} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleBookmarkToggle} style={styles.iconBtn} activeOpacity={0.7}>
            <FontAwesome5 name="bookmark" size={20} solid={spotIsBookmarked} color={spotIsBookmarked ? "#f4c542" : colors.brandDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.tab, { backgroundColor: colors.card, borderColor: colors.cardBorder ?? "#f0e0de" }, activeTab === tab.key && { backgroundColor: colors.brand, borderColor: colors.brand }]} onPress={() => { setActiveTab(tab.key); setShowStarPicker(false); }} activeOpacity={0.8}>
            <Feather name={tab.icon} size={13} color={activeTab === tab.key ? "#fff" : colors.textMuted} style={{ marginRight:5 }} />
            <Text style={[styles.tabText, { color: colors.textMuted }, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.heroContainer}>
          {show3D && spot.modelUrl && isFocused ? (
            <ModelViewer url={spot.modelUrl} style={styles.heroImage} />
          ) : (
            <Image source={{ uri: spot.image }} style={styles.heroImage} resizeMode="cover" />
          )}
        </View>

        <View style={styles.bodyPad}>
          <Text style={[styles.title, { color: colors.brandDark }]}>{spot.name}</Text>

          {activeTab === "Overview" && (
            <>
              <Text style={[styles.sectionHeading, { color: colors.brandDark }]}>About</Text>
              <Text style={[styles.descriptionText, { color: colors.textMuted }]}>{spot.description || "Description coming soon..."}</Text>
              <View style={[styles.divider, { backgroundColor: colors.cardBorder ?? "#f0e0de", marginVertical:14 }]} />
              {[
                { icon:"clock",   label:"Visiting Hours", value: spot.visitingHours || "6:00 AM – 10:00 PM" },
                { icon:"tag",     label:"Entrance Fee",   value: spot.entranceFee   || "Free" },
                { icon:"map-pin", label:"Location",       value: spot.address       || "Malolos, Bulacan, Philippines" },
                { icon:"phone",   label:"Contact",        value: spot.contact       || "N/A" },
              ].map((row, i, arr) => (
                <React.Fragment key={row.label}>
                  <View style={styles.infoRow}>
                    <Feather name={row.icon} size={14} color={colors.brand} />
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{row.label}</Text>
                    <Text style={[styles.infoValue, { color: colors.brandDark }]} numberOfLines={2}>{row.value}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={[styles.divider, { backgroundColor: colors.cardBorder ?? "#f0e0de" }]} />}
                </React.Fragment>
              ))}
            </>
          )}

          {activeTab === "BucketList" && (
            <>
              {missions.length === 0 ? (
                <View style={styles.emptyMissions}>
                  <Feather name="list" size={32} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No missions for this spot yet.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressLabel, { color: colors.textMuted }]}>{completedCount} of {totalCount} complete</Text>
                    <View style={[styles.progressTrack, { backgroundColor: colors.cardBorder ?? "#f0e0de" }]}>
                      <View style={[styles.progressFill, { width:`${progressRatio*100}%`, backgroundColor: colors.brand }]} />
                    </View>
                  </View>
                  <Text style={[styles.bucketSectionTitle, { color: colors.brandDark }]}>On this Bakit List</Text>
                  <View style={[styles.missionList, { borderColor: colors.cardBorder ?? "#f0e0de" }]}>
                    {missions.map((mission, i) => (
                      <React.Fragment key={mission._id}>
                        <MissionRow mission={mission} index={i} />
                        {i < missions.length - 1 && <View style={[styles.missionDivider, { backgroundColor: colors.cardBorder ?? "#f0e0de" }]} />}
                      </React.Fragment>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {activeTab === "Reviews" && (
            <>
              <View style={[styles.ratingSummary, { backgroundColor: colors.card, borderColor: colors.cardBorder ?? "#f0e0de" }]}>
                <Text style={[styles.ratingBig, { color: colors.brandDark }]}>{averageRating}</Text>
                <StarRating rating={Math.round(parseFloat(averageRating))} size={20} />
                <Text style={[styles.reviewCountText, { color: colors.textMuted }]}>{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</Text>
              </View>
              <Text style={[styles.sectionHeading, { color: colors.brandDark }]}>All Reviews ({reviewCount})</Text>
              {reviews.length === 0 ? (
                <View style={styles.emptyReviews}>
                  <Feather name="message-square" size={32} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>Wala pang review. Maging una!</Text>
                </View>
              ) : reviews.map((review) => <ReviewCard key={review._id} review={review} />)}
            </>
          )}

          <View style={{ height: isReviewsTab ? 90 : 100 }} />
        </View>
      </ScrollView>

      {/* Comment bar */}
      {isReviewsTab && (
        <View style={[styles.commentBarWrapper, { backgroundColor: colors.background, borderTopColor: colors.cardBorder ?? "#f0e0de" }]}>
          {showStarPicker && (
            <View style={styles.starPickerRow}>
              <Text style={[styles.starPickerLabel, { color: colors.textMuted }]}>Rate:</Text>
              {[1,2,3,4,5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setNewRating(s)}>
                  <Feather name="star" size={26} color={s <= newRating ? "#f4c542" : colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.commentBar}>
            <View style={[styles.commentAvatar, { backgroundColor: colors.card }]}>
              {(profileImage || clerkUser?.imageUrl) ? (
                <Image source={{ uri: profileImage || clerkUser?.imageUrl }} style={styles.commentAvatarImg} />
              ) : (
                <Feather name="user" size={16} color={colors.textMuted} />
              )}
            </View>
            <TouchableOpacity style={[styles.commentInputWrap, { backgroundColor: colors.card }]} activeOpacity={1} onPress={() => { setShowStarPicker(true); inputRef.current?.focus(); }}>
              <TextInput ref={inputRef} style={[styles.commentInput, { color: colors.brandDark }]} placeholder="Write a review..." placeholderTextColor={colors.textMuted} value={newReview} onChangeText={setNewReview} onFocus={() => setShowStarPicker(true)} multiline maxLength={500} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sendBtn, (!newReview.trim() || newRating === 0) && styles.sendBtnDisabled, { backgroundColor: colors.brand }]} onPress={handleSubmit} disabled={!newReview.trim() || newRating === 0}>
              <Feather name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating bar */}
      {!isReviewsTab && (
        <View style={styles.floatingBar}>
          <TouchableOpacity style={[styles.floatingBtn, { backgroundColor: colors.brandDark }]} onPress={() => navigation.navigate("Track", { spot })} activeOpacity={0.85}>
            <Feather name="map-pin" size={15} color="#fff" />
            <Text style={styles.floatingBtnText}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.floatingBtn, { backgroundColor: colors.brandDark }]} onPress={handleLaunchAR} activeOpacity={0.85}>
            <Feather name="camera" size={15} color="#fff" />
            <Text style={styles.floatingBtnText}>AR</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Report modal */}
      <Modal visible={showReportModal} animationType="slide" transparent onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.brandDark }]}>Report Review</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}><Feather name="x" size={24} color={colors.brandDark} /></TouchableOpacity>
            </View>
            {reportTarget && <Text style={[styles.reportSubtitle, { color: colors.textMuted }]}>Reporting comment by <Text style={{ fontWeight:"700" }}>{reportTarget.userName}</Text></Text>}
            <Text style={[styles.modalLabel, { color: colors.brandDark }]}>Reason</Text>
            <View style={styles.reasonList}>
              {REPORT_REASONS.map((r) => (
                <TouchableOpacity key={r.key} style={[styles.reasonOption, { backgroundColor: colors.card, borderColor: colors.cardBorder ?? "#e8d0ce" }, reportReason === r.key && { borderColor: colors.brand, backgroundColor: colors.brandLight ?? "#f0e4e2" }]} onPress={() => setReportReason(r.key)} activeOpacity={0.8}>
                  <View style={[styles.reasonRadio, { borderColor: colors.textMuted }, reportReason === r.key && { borderColor: colors.brand, backgroundColor: colors.brand }]} />
                  <Text style={[styles.reasonLabel, { color: colors.textMuted }, reportReason === r.key && { color: colors.brandDark, fontWeight:"600" }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.modalLabel, { color: colors.brandDark }]}>Additional details (optional)</Text>
            <TextInput style={[styles.reportDetailsInput, { backgroundColor: colors.card, borderColor: colors.cardBorder ?? "#e8d0ce", color: colors.brandDark }]} multiline placeholder="Add any extra context..." placeholderTextColor={colors.textMuted} value={reportDetails} onChangeText={setReportDetails} textAlignVertical="top" />
            <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.brand }, submittingReport && { opacity:0.6 }]} onPress={handleSubmitReport} disabled={submittingReport} activeOpacity={0.85}>
              <Text style={styles.submitButtonText}>{submittingReport ? "Submitting..." : "Submit Report"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex:1, paddingTop:50 },
  errorContainer:  { flex:1, justifyContent:"center", alignItems:"center", gap:16 },
  errorText:       { fontSize:16 },
  backButton:      { paddingHorizontal:24, paddingVertical:12, borderRadius:12 },
  backButtonText:  { color:"#fff", fontWeight:"700" },
  topHeader:       { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:12, paddingBottom:10 },
  headerTitle:     { flex:1, textAlign:"center", fontSize:17, fontWeight:"700", marginHorizontal:8 },
  headerRight:     { flexDirection:"row", alignItems:"center", gap:2 },
  iconBtn:         { width:38, height:38, justifyContent:"center", alignItems:"center" },
  tabsContainer:   { flexDirection:"row", paddingHorizontal:16, gap:8, marginBottom:4 },
  tab:             { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", paddingVertical:9, borderRadius:20, borderWidth:1 },
  tabText:         { fontSize:15, fontWeight:"600" },
  activeTabText:   { color:"#fff" },
  scrollView:      { flex:1 },
  scrollContent:   { paddingBottom:0 },
  heroContainer:   { width, height:350 },
  heroImage:       { width:"100%", height:"100%" },
  bodyPad:         { paddingHorizontal:20, paddingTop:18 },
  title:           { fontSize:22, fontWeight:"700", marginBottom:14 },
  infoRow:         { flexDirection:"row", alignItems:"flex-start", gap:8, paddingVertical:6 },
  infoLabel:       { fontSize:13, fontWeight:"600", width:105 },
  infoValue:       { fontSize:13, fontWeight:"600", flex:1 },
  divider:         { height:1, marginVertical:2 },
  sectionHeading:  { fontSize:14, fontWeight:"700", marginBottom:10, marginTop:8 },
  descriptionText: { fontSize:13, lineHeight:20 },
  progressHeader:  { marginBottom:14, marginTop:4 },
  progressLabel:   { fontSize:13, fontWeight:"600", marginBottom:8 },
  progressTrack:   { height:6, borderRadius:3, overflow:"hidden" },
  progressFill:    { height:"100%", borderRadius:3 },
  bucketSectionTitle: { fontSize:16, fontWeight:"700", marginBottom:12 },
  missionList:     { borderRadius:16, borderWidth:1, overflow:"hidden" },
  missionRow:      { flexDirection:"row", alignItems:"center", paddingHorizontal:14, paddingVertical:14, gap:12 },
  missionDivider:  { height:1, marginLeft:72 },
  missionThumbWrap:{ position:"relative" },
  missionThumb:    { width:48, height:48, borderRadius:10 },
  checkBadge:      { position:"absolute", bottom:-3, right:-3, width:18, height:18, borderRadius:9, backgroundColor:"#4a7c59", justifyContent:"center", alignItems:"center", borderWidth:2, borderColor:"#fff" },
  missionRowBody:  { flex:1, gap:3 },
  missionRowTitle: { fontSize:14, fontWeight:"700", lineHeight:19 },
  missionRowTitleDone: { textDecorationLine:"line-through" },
  missionRowSub:   { fontSize:12 },
  arLaunchBadge:   { flexDirection:"row", alignItems:"center", backgroundColor:"#dce8f5", borderRadius:20, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:"#2e4a7c30", marginLeft:4 },
  arLaunchBadgeText: { fontSize:11, fontWeight:"700", color:"#2e4a7c" },
  emptyMissions:   { alignItems:"center", paddingVertical:32, gap:10 },
  ratingSummary:   { borderRadius:16, padding:20, marginBottom:14, alignItems:"center", borderWidth:1 },
  ratingBig:       { fontSize:48, fontWeight:"700", marginBottom:6 },
  starsRow:        { flexDirection:"row", gap:3, marginBottom:4 },
  reviewCountText: { fontSize:13, marginTop:4 },
  reviewCard:      { flexDirection:"row", alignItems:"flex-start", gap:10, marginBottom:14 },
  avatar:          { width:38, height:38, borderRadius:19, marginTop:2 },
  reviewBubble:    { flex:1, borderRadius:18, paddingHorizontal:14, paddingVertical:10 },
  reviewBubbleHeader:      { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:4 },
  reviewBubbleHeaderRight: { flexDirection:"row", alignItems:"center", gap:8 },
  reviewAuthor:    { fontSize:13, fontWeight:"700" },
  reviewComment:   { fontSize:13, lineHeight:19 },
  reviewDate:      { fontSize:11, marginTop:5 },
  reportButton:    { padding:2 },
  emptyReviews:    { alignItems:"center", paddingVertical:24, gap:8 },
  emptyText:       { fontSize:13 },
  commentBarWrapper: { borderTopWidth:1, paddingBottom:Platform.OS==="ios"?28:12, paddingTop:8, paddingHorizontal:12 },
  starPickerRow:   { flexDirection:"row", alignItems:"center", gap:8, paddingHorizontal:4, paddingBottom:10 },
  starPickerLabel: { fontSize:13, fontWeight:"600", marginRight:4 },
  commentBar:      { flexDirection:"row", alignItems:"flex-end", gap:8 },
  commentAvatar:   { width:36, height:36, borderRadius:18, justifyContent:"center", alignItems:"center", marginBottom:2 },
  commentAvatarImg:{ width:36, height:36, borderRadius:18 },
  commentInputWrap:{ flex:1, borderRadius:22, paddingHorizontal:14, paddingVertical:10, minHeight:40, maxHeight:100, justifyContent:"center" },
  commentInput:    { fontSize:14, padding:0 },
  sendBtn:         { width:38, height:38, borderRadius:19, justifyContent:"center", alignItems:"center", marginBottom:2 },
  sendBtnDisabled: { opacity:0.5 },
  floatingBar:     { position:"absolute", bottom:36, alignSelf:"center", flexDirection:"row", gap:12 },
  floatingBtn:     { flexDirection:"row", alignItems:"center", paddingVertical:12, paddingHorizontal:28, borderRadius:30, gap:7, shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.18, shadowRadius:8, elevation:6 },
  floatingBtnText: { color:"#fff", fontWeight:"700", fontSize:14 },
  modalOverlay:    { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" },
  modalContent:    { borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, maxHeight:"85%" },
  modalHeader:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  modalTitle:      { fontSize:20, fontWeight:"700" },
  modalLabel:      { fontSize:15, fontWeight:"600", marginBottom:10, marginTop:14 },
  reportSubtitle:  { fontSize:14, marginBottom:4 },
  reasonList:      { gap:8, marginBottom:4 },
  reasonOption:    { flexDirection:"row", alignItems:"center", borderRadius:10, paddingVertical:12, paddingHorizontal:14, borderWidth:1.5, gap:12 },
  reasonRadio:     { width:18, height:18, borderRadius:9, borderWidth:2 },
  reasonLabel:     { fontSize:14 },
  reportDetailsInput: { borderRadius:12, padding:14, fontSize:14, minHeight:80, marginBottom:20, borderWidth:1.5, textAlignVertical:"top" },
  submitButton:    { paddingVertical:15, borderRadius:12, alignItems:"center" },
  submitButtonText:{ color:"#fff", fontSize:17, fontWeight:"700" },
});