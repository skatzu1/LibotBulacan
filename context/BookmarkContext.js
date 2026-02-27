import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';

const BookmarkContext = createContext();
export const useBookmark = () => useContext(BookmarkContext);

export const BookmarkProvider = ({ children }) => {
  const { getToken } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);

  const fetchBookmarks = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch("https://libotbackend.onrender.com/api/bookmarks", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log("📌 Bookmarks fetched:", data);
      setBookmarks(data.bookmarks || []);
    } catch (err) {
      console.error("❌ Error fetching bookmarks:", err);
    }
  }, [getToken]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const addBookmark = useCallback(async (locationId) => {
    try {
      const token = await getToken();
      await fetch("https://libotbackend.onrender.com/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locationId })
      });
      fetchBookmarks();
    } catch (err) {
      console.error("❌ Error adding bookmark:", err);
    }
  }, [getToken, fetchBookmarks]);

  const removeBookmark = useCallback(async (locationId) => {
    try {
      const token = await getToken();
      await fetch(`https://libotbackend.onrender.com/api/bookmarks/${locationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBookmarks();
    } catch (err) {
      console.error("❌ Error removing bookmark:", err);
    }
  }, [getToken, fetchBookmarks]);

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