import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Modal,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useReviews } from '../context/ReviewContext';

const { width } = Dimensions.get('window');

export default function Reviews({ route }) {
  const navigation = useNavigation();
  const { spot } = route.params || {};
  const { getReviewsForSpot, addReview, getAverageRating, getReviewCount, fetchReviews } = useReviews();

  const [showAddReview, setShowAddReview] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newReview, setNewReview] = useState('');

  useEffect(() => {
    if (spot && spot._id) {
      fetchReviews(spot._id);
    }
  }, [spot]);

  const reviews = spot && spot._id ? getReviewsForSpot(spot._id) : [];
  const averageRating = spot && spot._id ? getAverageRating(spot._id) || '0.0' : '0.0';
  const reviewCount = spot && spot._id ? getReviewCount(spot._id) : 0;

  const StarRating = ({ rating, size = 16, color = "#FFD700" }) => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Feather
          key={star}
          name="star"
          size={size}
          color={star <= rating ? color : "#ccc"}
        />
      ))}
    </View>
  );

  const InteractiveStarRating = ({ rating, onRatingChange, size = 24 }) => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onRatingChange(star)}>
          <Feather
            name="star"
            size={size}
            color={star <= rating ? "#FFD700" : "#ccc"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const handleSubmitReview = async () => {
    if (newRating === 0 || newReview.trim() === '') {
      alert('Please provide a rating and review');
      return;
    }
    if (!spot || !spot._id) {
      alert('Error: Spot information not available');
      return;
    }
    await addReview(spot._id, newRating, newReview);
    setNewRating(0);
    setNewReview('');
    setShowAddReview(false);
  };

  // ✅ Uses only data stored inside the review — never the current logged-in user
  const ReviewCard = ({ review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Image
          source={{
            uri: review.userImage && review.userImage !== ''
              ? review.userImage
              : "https://i.pravatar.cc/150?img=10"
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
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#4a4a4a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reviews</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* DESTINATION INFO */}
        {spot && (
          <View style={styles.destinationInfo}>
            <Image source={{ uri: spot.image }} style={styles.destinationImage} />
            <View style={styles.destinationTextContainer}>
              <Text style={styles.destinationName}>{spot.name}</Text>
              <View style={styles.locationContainer}>
                <Feather name="map-pin" size={12} color="#6a5a5a" />
                <Text style={styles.locationText}>{spot.location || "Philippines"}</Text>
              </View>
            </View>
          </View>
        )}

        {/* RATING SUMMARY */}
        <View style={styles.ratingSummary}>
          <View style={styles.ratingNumberContainer}>
            <Text style={styles.ratingNumber}>{averageRating}</Text>
            <StarRating rating={Math.round(parseFloat(averageRating))} size={20} />
            <Text style={styles.reviewCount}>
              {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
            </Text>
          </View>
        </View>

        {/* ADD REVIEW BUTTON */}
        <TouchableOpacity style={styles.addReviewButton} onPress={() => setShowAddReview(true)}>
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.addReviewButtonText}>Write a Review</Text>
        </TouchableOpacity>

        {/* REVIEWS LIST */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>All Reviews ({reviewCount})</Text>
          {reviews.length === 0 && (
            <Text style={{ color: '#6a5a5a', textAlign: 'center', marginTop: 10 }}>
              No reviews yet. Be the first!
            </Text>
          )}
          {reviews.map((review) => (
            <ReviewCard key={review._id} review={review} /> // ✅ use _id not idx
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ADD REVIEW MODAL */}
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
                <Feather name="x" size={24} color="#4a4a4a" />
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
              placeholderTextColor="#999"
              value={newReview}
              onChangeText={setNewReview}
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitReview}>
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
    backgroundColor: '#f5c4c1',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a4a4a',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  destinationInfo: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  destinationImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 12,
  },
  destinationTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  destinationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a4a4a',
    marginBottom: 5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    fontSize: 13,
    color: '#6a5a5a',
  },
  ratingSummary: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  ratingNumberContainer: {
    alignItems: 'center',
  },
  ratingNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#4a4a4a',
    marginBottom: 10,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 5,
  },
  reviewCount: {
    fontSize: 14,
    color: '#6a5a5a',
    marginTop: 5,
  },
  addReviewButton: {
    flexDirection: 'row',
    backgroundColor: '#4a3a3a',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    gap: 10,
  },
  addReviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4a4a4a',
    marginBottom: 15,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  userAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,
  },
  reviewHeaderText: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a4a4a',
    marginBottom: 4,
  },
  ratingDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
  reviewComment: {
    fontSize: 14,
    color: '#6a5a5a',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#f5c4c1',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4a4a4a',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a4a4a',
    marginBottom: 10,
    marginTop: 15,
  },
  reviewInput: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    fontSize: 14,
    color: '#4a4a4a',
    minHeight: 120,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#4a3a3a',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});