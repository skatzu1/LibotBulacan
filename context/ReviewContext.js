import React, { createContext, useState, useContext, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";

const ReviewContext = createContext();

export const useReviews = () => useContext(ReviewContext);

export const ReviewProvider = ({ children }) => {
  const { getToken } = useAuth();
  const [reviewsBySpot, setReviewsBySpot] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Fetch all spots then prefetch reviews for each on app start
  useEffect(() => {
    const prefetchAllReviews = async () => {
      try {
        setLoading(true);
        const res = await fetch("https://libotbackend.onrender.com/api/spots");
        const data = await res.json();
        if (data.success && data.spots) {
          // Prefetch reviews for all spots
          await Promise.all(
            data.spots.map((spot) => {
              if (spot._id) return fetchReviews(spot._id);
            })
          );
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

  // ✅ Fetch reviews for a specific spot
  const fetchReviews = useCallback(async (spotId) => {
    if (!spotId) return;
    try {
      const res = await fetch(
        `https://libotbackend.onrender.com/api/reviews/${spotId}`
      );
      const data = await res.json();
      
      if (data.success) {
        setReviewsBySpot((prev) => ({
          ...prev,
          [spotId]: data.reviews || [],
        }));
        setError(null);
      } else {
        throw new Error(data.message || "Failed to fetch reviews");
      }
    } catch (err) {
      console.error("❌ Error fetching reviews:", err);
      setError(err.message);
      setReviewsBySpot((prev) => ({
        ...prev,
        [spotId]: [],
      }));
    }
  }, []);

  // ✅ Add a new review (creates new, doesn't replace)
  const addReview = useCallback(
    async (spotId, rating, comment) => {
      if (!spotId || !rating || !comment) {
        setError("All fields are required");
        return false;
      }

      try {
        const token = await getToken();
        if (!token) {
          setError("Authentication required");
          return false;
        }

        const res = await fetch(
          "https://libotbackend.onrender.com/api/reviews",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              spotId,
              rating,
              comment,
            }),
          }
        );

        const data = await res.json();

        if (data.success) {
          // ✅ Refetch to get all reviews including the new one
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
    },
    [getToken, fetchReviews]
  );

  // ✅ Get all reviews for a spot
  const getReviewsForSpot = useCallback(
    (spotId) => reviewsBySpot[spotId] || [],
    [reviewsBySpot]
  );

  // ✅ Calculate average rating for a spot
  const getAverageRating = useCallback((spotId) => {
    const reviews = reviewsBySpot[spotId] || [];
    if (!reviews.length) return "0.0";
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviewsBySpot]);

  // ✅ Get review count for a spot
  const getReviewCount = useCallback(
    (spotId) => (reviewsBySpot[spotId] || []).length,
    [reviewsBySpot]
  );

  // ✅ Delete a review (only your own)
  const deleteReview = useCallback(
    async (reviewId, spotId) => {
      try {
        const token = await getToken();
        if (!token) {
          setError("Authentication required");
          return false;
        }

        const res = await fetch(
          `https://libotbackend.onrender.com/api/reviews/${reviewId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();

        if (data.success) {
          // Refetch to update the list
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
    },
    [getToken, fetchReviews]
  );

  return (
    <ReviewContext.Provider
      value={{
        reviewsBySpot,
        loading,
        error,
        fetchReviews,
        addReview,
        getReviewsForSpot,
        getAverageRating,
        getReviewCount,
        deleteReview,
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
};