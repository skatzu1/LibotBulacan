import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';

const BookmarkContext = createContext();
export const useBookmark = () => useContext(BookmarkContext);

export const BookmarkProvider = ({ children }) => {
  const { getToken, userId, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    getTokenRef.current = getToken;
  });

  const fetchBookmarks = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const res = await fetch("https://libotbackend.onrender.com/api/bookmarks", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log("📌 Bookmarks fetched:", data);
      setBookmarks(data.bookmarks || []);
    } catch (err) {
      console.error("❌ Error fetching bookmarks:", err);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && userId) {
      fetchBookmarks();
    }
  }, [isLoaded, userId]);

  const addBookmark = useCallback(async (locationId) => {
    try {
      const token = await getTokenRef.current();
      await fetch("https://libotbackend.onrender.com/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locationId })
      });
      fetchBookmarks();
    } catch (err) {
      console.error("❌ Error adding bookmark:", err);
    }
  }, [fetchBookmarks]);

  const removeBookmark = useCallback(async (locationId) => {
    try {
      const token = await getTokenRef.current();
      await fetch(`https://libotbackend.onrender.com/api/bookmarks/${locationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBookmarks();
    } catch (err) {
      console.error("❌ Error removing bookmark:", err);
    }
  }, [fetchBookmarks]);

  const isBookmarked = useCallback((locationId) => {
    return bookmarks.some(b => String(b._id || b) === String(locationId));
  }, [bookmarks]);

  const toggleBookmark = useCallback((spot) => {
    if (isBookmarked(spot._id)) {
      removeBookmark(spot._id);
    } else {
      addBookmark(spot._id);
    }
  }, [isBookmarked, addBookmark, removeBookmark]);

  return (
    <BookmarkContext.Provider
      value={{
        bookmarks,
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