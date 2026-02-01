import React, { createContext, useContext, useState, useEffect } from 'react';

const ReviewContext = createContext();

export const useReviews = () => {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReviews must be used within a ReviewProvider');
  }
  return context;
};

export const ReviewProvider = ({ children }) => {
  // Store reviews grouped by spot ID
  const [reviewsBySpot, setReviewsBySpot] = useState({});

  // Add a new review for a spot
  const addReview = (spotId, review) => {
    setReviewsBySpot(prev => ({
      ...prev,
      [spotId]: [...(prev[spotId] || []), review]
    }));
  };

  // Get reviews for a specific spot
  const getReviewsForSpot = (spotId) => {
    return reviewsBySpot[spotId] || [];
  };

  // Calculate average rating for a spot
  const getAverageRating = (spotId) => {
    const reviews = reviewsBySpot[spotId];
    if (!reviews || reviews.length === 0) return null;
    
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  // Get total review count for a spot
  const getReviewCount = (spotId) => {
    return reviewsBySpot[spotId]?.length || 0;
  };

  // Initialize with sample data
  useEffect(() => {
    // You can pre-populate with sample reviews if needed
    // This is just an example structure
  }, []);

  const value = {
    reviewsBySpot,
    addReview,
    getReviewsForSpot,
    getAverageRating,
    getReviewCount,
  };

  return (
    <ReviewContext.Provider value={value}>
      {children}
    </ReviewContext.Provider>
  );
};