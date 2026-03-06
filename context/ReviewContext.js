import React, { createContext, useState, useContext, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";

const ReviewContext = createContext();

export const useReviews = () => useContext(ReviewContext);

export const ReviewProvider = ({ children }) => {
  const { getToken } = useAuth();
  const [reviewsBySpot, setReviewsBySpot] = useState({});

  // ✅ Fetch all spots then prefetch reviews for each on app start
  useEffect(() => {
    const prefetchAllReviews = async () => {
      try {
        const res = await fetch("https://libotbackend.onrender.com/api/spots");
        const data = await res.json();
        if (data.success && data.spots) {
          data.spots.forEach((spot) => {
            if (spot._id) fetchReviews(spot._id);
          });
        }
      } catch (err) {
        console.error("❌ Error prefetching reviews:", err);
      }
    };
    prefetchAllReviews();
  }, []);

  const fetchReviews = useCallback(async (locationId) => {
    if (!locationId) return;
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
      fetchReviews(locationId);
    } catch (err) {
      console.error("❌ Error adding review:", err);
    }
  }, [getToken]);

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