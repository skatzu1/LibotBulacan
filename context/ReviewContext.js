import React, { createContext, useState, useContext, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";

const ReviewContext = createContext();

export const useReviews = () => useContext(ReviewContext);

export const ReviewProvider = ({ children }) => {
  const { getToken } = useAuth();
  const [reviewsBySpot, setReviewsBySpot] = useState({});

  const fetchReviews = useCallback(async (locationId) => {
    if (!locationId) return; // ✅ Guard against undefined locationId
    try {
      const res = await fetch(`https://libotbackend.onrender.com/api/reviews/${locationId}`);
      const data = await res.json();
      setReviewsBySpot(prev => ({ ...prev, [locationId]: data.reviews || [] }));
    } catch (err) {
      console.error("❌ Error fetching reviews:", err);
    }
  }, []);

  const addReview = useCallback(async (locationId, rating, comment) => {
    try {
      const token = await getToken();
      await fetch("https://libotbackend.onrender.com/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locationId, rating, comment })
      });

      // Refresh reviews after posting
      fetchReviews(locationId);
    } catch (err) {
      console.error("❌ Error adding review:", err);
    }
  }, [getToken]);

  // ✅ Removed broken useEffect that called fetchReviews() without a locationId

  const getReviewsForSpot = useCallback((locationId) => reviewsBySpot[locationId] || [], [reviewsBySpot]);

  const getAverageRating = useCallback((locationId) => {
    const reviews = reviewsBySpot[locationId] || [];
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviewsBySpot]);

  const getReviewCount = useCallback((locationId) => (reviewsBySpot[locationId] || []).length, [reviewsBySpot]);

  return (
    <ReviewContext.Provider value={{
      reviewsBySpot,
      fetchReviews,
      addReview,
      getReviewsForSpot,
      getAverageRating,
      getReviewCount
    }}>
      {children}
    </ReviewContext.Provider>
  );
};