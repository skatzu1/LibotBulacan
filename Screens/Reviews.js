import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Modal,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useReviews } from "../context/ReviewContext";

const { width } = Dimensions.get("window");

export default function Reviews({ route }) {
  const navigation = useNavigation();
  const { spot }   = route.params || {};
  const { getReviewsForSpot, addReview, getAverageRating, getReviewCount, fetchReviews } = useReviews();

  const [showAddReview, setShowAddReview] = useState(false);
  const [newRating, setNewRating]         = useState(0);
  const [newReview, setNewReview]         = useState("");

  useEffect(() => {
    if (spot?._id) fetchReviews(spot._id);
  }, [spot]);

  const reviews       = spot?._id ? getReviewsForSpot(spot._id) : [];
  const averageRating = spot?._id ? getAverageRating(spot._id) || "0.0" : "0.0";
  const reviewCount   = spot?._id ? getReviewCount(spot._id) : 0;

  const StarRating = ({ rating, size = 16, color = "#f4c542" }) => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Feather key={star} name="star" size={size} color={star <= rating ? color : "#d9b8b5"} />
      ))}
    </View>
  );

  const InteractiveStarRating = ({ rating, onRatingChange, size = 26 }) => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onRatingChange(star)}>
          <Feather name="star" size={size} color={star <= rating ? "#f4c542" : "#d9b8b5"} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const handleSubmitReview = async () => {
    if (newRating === 0 || newReview.trim() === "") {
      alert("Please provide a rating and review");
      return;
    }
    if (!spot?._id) {
      alert("Error: Spot information not available");
      return;
    }
    await addReview(spot._id, newRating, newReview);
    setNewRating(0);
    setNewReview("");
    setShowAddReview(false);
  };

  const ReviewCard = ({ review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Image
          source={{
            uri: review.userImage && review.userImage !== ""
              ? review.userImage
              : "https://i.pravatar.cc/150?img=10",
          }}
          style={styles.userAvatar}
        />
        <View style={styles.reviewHeaderText}>
          <Text style={styles.userName}>{review.userName || "Anonymous"}</Text>
          <View style={styles.ratingDateContainer}>
            <StarRating rating={review.rating} size={12} />
            <Text style={styles.reviewDate}>
              {review.createdAt
                ? new Date(review.createdAt).toLocaleDateString()
                : "Just now"}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
    </View>
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#4a2e2c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reviews</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* Destination info */}
        {spot && (
          <View style={styles.destinationInfo}>
            <Image source={{ uri: spot.image }} style={styles.destinationImage} />
            <View style={styles.destinationTextContainer}>
              <Text style={styles.destinationName}>{spot.name}</Text>
              <View style={styles.locationContainer}>
                <Feather name="map-pin" size={12} color="#7a5a58" />
                <Text style={styles.locationText}>{spot.location || "Philippines"}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Rating summary */}
        <View style={styles.ratingSummary}>
          <Text style={styles.ratingNumber}>{averageRating}</Text>
          <StarRating rating={Math.round(parseFloat(averageRating))} size={22} />
          <Text style={styles.reviewCount}>
            {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          </Text>
        </View>

        {/* Write a review button */}
        <TouchableOpacity
          style={styles.addReviewButton}
          onPress={() => setShowAddReview(true)}
          activeOpacity={0.85}
        >
          <Feather name="edit-2" size={18} color="#fff" />
          <Text style={styles.addReviewButtonText}>Write a Review</Text>
        </TouchableOpacity>

        {/* Reviews list */}
        <Text style={styles.sectionTitle}>All Reviews ({reviewCount})</Text>

        {reviews.length === 0 && (
          <Text style={styles.emptyText}>No reviews yet. Be the first!</Text>
        )}

        {reviews.map((review) => (
          <ReviewCard key={review._id} review={review} />
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add review modal */}
      <Modal
        visible={showAddReview}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddReview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Write a Review</Text>
              <TouchableOpacity onPress={() => setShowAddReview(false)}>
                <Feather name="x" size={24} color="#4a2e2c" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Your Rating</Text>
            <InteractiveStarRating rating={newRating} onRatingChange={setNewRating} />

            <Text style={styles.modalLabel}>Your Review</Text>
            <TextInput
              style={styles.reviewInput}
              multiline
              numberOfLines={5}
              placeholder="Share your experience..."
              placeholderTextColor="#b0908c"
              value={newReview}
              onChangeText={setNewReview}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmitReview}
              activeOpacity={0.85}
            >
              <Text style={styles.submitButtonText}>Submit Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7cfc9",
    paddingTop: 50,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4a2e2c",
  },

  scrollContent: { paddingHorizontal: 20 },

  // ── Destination info ──
  destinationInfo: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: "#4a2e2c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  destinationImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 12,
  },
  destinationTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  destinationName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#4a2e2c",
    marginBottom: 6,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  locationText: {
    fontSize: 13,
    color: "#7a5a58",
  },

  // ── Rating summary ──
  ratingSummary: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#4a2e2c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  ratingNumber: {
    fontSize: 52,
    fontWeight: "700",
    color: "#4a2e2c",
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 6,
  },
  reviewCount: {
    fontSize: 14,
    color: "#7a5a58",
    marginTop: 4,
  },

  // ── Add review button ──
  addReviewButton: {
    flexDirection: "row",
    backgroundColor: "#6b4b45",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    gap: 10,
  },
  addReviewButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Reviews list ──
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4a2e2c",
    marginBottom: 14,
  },
  emptyText: {
    color: "#7a5a58",
    textAlign: "center",
    marginTop: 10,
    fontSize: 14,
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#4a2e2c",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: "row",
    marginBottom: 10,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  reviewHeaderText: {
    flex: 1,
    justifyContent: "center",
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4a2e2c",
    marginBottom: 4,
  },
  ratingDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reviewDate: {
    fontSize: 12,
    color: "#b0908c",
  },
  reviewComment: {
    fontSize: 14,
    color: "#7a5a58",
    lineHeight: 20,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#f7cfc9",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4a2e2c",
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4a2e2c",
    marginBottom: 10,
    marginTop: 14,
  },
  reviewInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: "#4a2e2c",
    minHeight: 120,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#e8d0ce",
  },
  submitButton: {
    backgroundColor: "#6b4b45",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});