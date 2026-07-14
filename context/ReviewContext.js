import React, { createContext, useState, useContext, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import api from "../api";

const ReviewContext = createContext();
export const useReviews = () => useContext(ReviewContext);

export const ReviewProvider = ({ children }) => {
  const [reviewsBySpot, setReviewsBySpot] = useState({});
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  useEffect(() => {
    const prefetchAllReviews = async () => {
      try {
        setLoading(true);
        const res = await api.get("/api/spots");
        const data = res.data;
        if (data.success && data.spots) {
          // Fetch reviews sequentially to avoid server rate limits
          for (const spot of data.spots) {
            if (spot._id) await fetchReviews(spot._id);
          }
        }
      } catch (err) {
        console.error("❌ Error prefetching reviews:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    prefetchAllReviews();
  }, []);

  const fetchReviews = useCallback(async (spotId) => {
    if (!spotId) return;
    try {
      const res = await api.get(`/api/reviews/${spotId}`);
      const data = res.data;
      if (data.success) {
        setReviewsBySpot((prev) => ({ ...prev, [spotId]: data.reviews || [] }));
        setError(null);
      } else {
        throw new Error(data.message || "Failed to fetch reviews");
      }
    } catch (err) {
      console.error("❌ Error fetching reviews:", err);
      setError(err.message);
    }
  }, []);

  const addReview = useCallback(async (spotId, rating, comment) => {
    if (!spotId || !rating || !comment) { setError("All fields are required"); return false; }
    try {
      const res = await api.post("/api/reviews", { spotId, rating, comment });
      const data = res.data;
      if (data.success) {
        await fetchReviews(spotId);
        setError(null);
        return true;
      } else {
        throw new Error(data.message || "Failed to add review");
      }
    } catch (err) {
      console.error("❌ Error adding review:", err);
      setError(err.message);
      return false;
    }
  }, [fetchReviews]);

  const reportReview = useCallback(async ({ reviewId, reportedClerkUserId, reason, details = "" }) => {
    if (!reviewId || !reportedClerkUserId || !reason) {
      setError("reviewId, reportedClerkUserId, and reason are required");
      return false;
    }
    try {
      const res = await api.post("/api/reports", { reviewId, reportedClerkUserId, reason, details });
      const data = res.data;
      if (data.success) {
        setError(null);
        return true;
      } else {
        console.error("❌ Report API error:", data);
        throw new Error(data.message || "Failed to submit report");
      }
    } catch (err) {
      console.error("❌ Error reporting review:", err);
      setError(err.message);
      return false;
    }
  }, []);

  const getReviewsForSpot = useCallback((spotId) => reviewsBySpot[spotId] || [], [reviewsBySpot]);
  const getAverageRating  = useCallback((spotId) => {
    const reviews = reviewsBySpot[spotId] || [];
    if (!reviews.length) return "0.0";
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviewsBySpot]);
  const getReviewCount    = useCallback((spotId) => (reviewsBySpot[spotId] || []).length, [reviewsBySpot]);

  const deleteReview = useCallback(async (reviewId, spotId) => {
    try {
      const res = await api.delete(`/api/reviews/${reviewId}`);
      const data = res.data;
      if (data.success) {
        await fetchReviews(spotId);
        setError(null);
        return true;
      } else {
        throw new Error(data.message || "Failed to delete review");
      }
    } catch (err) {
      console.error("❌ Error deleting review:", err);
      setError(err.message);
      return false;
    }
  }, [fetchReviews]);

  return (
    <ReviewContext.Provider value={{
      reviewsBySpot, loading, error,
      fetchReviews, addReview, reportReview,
      getReviewsForSpot, getAverageRating, getReviewCount, deleteReview,
    }}>
      {children}
    </ReviewContext.Provider>
  );
};