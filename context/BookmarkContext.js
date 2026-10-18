import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { BASE_URL } from "../api";
import { showToast } from "../components/AppAlert";

const BookmarkContext = createContext();
export const useBookmark = () => useContext(BookmarkContext);

export const BookmarkProvider = ({ children }) => {
  const { getToken, userId, isLoaded } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch bookmarks - stable function
  const fetchBookmarks = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const token = await getToken();
      
      if (!token) {
        console.warn("No auth token available");
        setLoading(false);
        return;
      }

      const res = await fetch(`${BASE_URL}/api/bookmarks`, {
        method: "GET",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) throw new Error(`Failed to fetch bookmarks: ${res.status}`);

      const data = await res.json();

      if (data.success) {
        setBookmarks(data.bookmarks || []);
      } else {
        throw new Error(data.message || "Failed to fetch bookmarks");
      }
    } catch (err) {
      // Keep what's shown. This used to empty the list, so a slow or failed
      // request — including the re-sync after every save — made every saved
      // spot disappear until the next load that worked.
      console.error("Error fetching bookmarks:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, getToken]);

  // Another account (or none): start from an empty list, then load theirs.
  // A failed fetch keeps the list, so this is what clears the last account's.
  useEffect(() => {
    setBookmarks([]);
    if (isLoaded && userId) {
      fetchBookmarks();
    }
  }, [isLoaded, userId]); // FIXED: Don't include fetchBookmarks here!

  // Check if a spot is bookmarked
  const isBookmarked = useCallback((spotId) => {
    if (!spotId) return false;
    return bookmarks.some(b => {
      const bookmarkedSpotId = String(b.spotId?._id || b.spotId);
      const spotIdStr = String(spotId);
      return bookmarkedSpotId === spotIdStr;
    });
  }, [bookmarks]);

  // Add a bookmark (with optimistic update)
  const addBookmark = useCallback(async (spot) => {
    if (!spot?._id) {
      console.error("No spot ID provided");
      return false;
    }

    try {
      const token = await getToken();
      if (!token) {
        console.error("No auth token");
        return false;
      }

      // OPTIMISTIC UPDATE - update UI immediately
      setBookmarks(prev => {
        const alreadyExists = prev.some(b => String(b.spotId?._id || b.spotId) === String(spot._id));
        if (alreadyExists) return prev;
        return [...prev, { _id: spot._id, spotId: spot._id, ...spot }];
      });

      const res = await fetch(`${BASE_URL}/api/bookmarks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ spotId: spot._id })
      });

      if (!res.ok) {
        // Rollback if fails
        setBookmarks(prev => prev.filter(b => String(b.spotId?._id || b.spotId) !== String(spot._id)));
        throw new Error(`Failed to add bookmark: ${res.status}`);
      }

      const data = await res.json();
      console.log("Bookmark added");
      
      // Refetch to sync with backend
      await fetchBookmarks();
      return true;
    } catch (err) {
      console.error("Error adding bookmark:", err);
      return false;
    }
  }, [getToken, fetchBookmarks]);

  // Remove a bookmark (with optimistic update)
  const removeBookmark = useCallback(async (spotId) => {
    if (!spotId) {
      console.error("No spot ID provided");
      return false;
    }

    try {
      const token = await getToken();
      if (!token) {
        console.error("No auth token");
        return false;
      }

      // OPTIMISTIC UPDATE - remove from UI immediately
      const removed = bookmarks.find(b => String(b.spotId?._id || b.spotId) === String(spotId));
      setBookmarks(prev => prev.filter(b => String(b.spotId?._id || b.spotId) !== String(spotId)));

      const res = await fetch(
        `${BASE_URL}/api/bookmarks/${spotId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (!res.ok) {
        // Rollback if fails
        if (removed) {
          setBookmarks(prev => [...prev, removed]);
        }
        throw new Error(`Failed to remove bookmark: ${res.status}`);
      }

      const data = await res.json();
      console.log("Bookmark removed");
      
      // Refetch to sync with backend
      await fetchBookmarks();
      return true;
    } catch (err) {
      console.error("Error removing bookmark:", err);
      return false;
    }
  }, [getToken, fetchBookmarks, bookmarks]);

  // Toggle bookmark (add or remove)
  const toggleBookmark = useCallback(async (spot) => {
    if (!spot?._id) {
      console.error("No spot ID provided");
      return false;
    }

    // Check current status using current bookmarks state
    const alreadyBookmarked = bookmarks.some(b => {
      const bookmarkedSpotId = String(b.spotId?._id || b.spotId);
      return bookmarkedSpotId === String(spot._id);
    });

    // A toast either way, from every place a bookmark is toggled (spot page,
    // Saved, category lists). The icon alone changing was easy to miss
    // (QA 2026-10-16). Shown at once, like the icon (both are optimistic);
    // a failure says so and the icon rolls back.
    if (alreadyBookmarked) {
      showToast("Removed from Saved", { type: "info" });
      const ok = await removeBookmark(spot._id);
      if (!ok) showToast("Couldn't remove the bookmark. Try again.", { type: "error" });
      return ok;
    }
    showToast("Saved. Find it in the Saved tab.", { type: "success" });
    const ok = await addBookmark(spot);
    if (!ok) showToast("Couldn't save the bookmark. Try again.", { type: "error" });
    return ok;
  }, [bookmarks, addBookmark, removeBookmark]);

  return (
    <BookmarkContext.Provider
      value={{
        bookmarks,
        loading,
        fetchBookmarks,
        addBookmark,
        removeBookmark,
        isBookmarked,
        toggleBookmark
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
};