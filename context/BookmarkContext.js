import React, { createContext, useState, useContext, useCallback } from 'react';

const BookmarkContext = createContext();

export const useBookmark = () => {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error('useBookmark must be used within a BookmarkProvider');
  }
  return context;
};

export const BookmarkProvider = ({ children }) => {
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [bookmarkedSpots, setBookmarkedSpots] = useState([]);
  const [updateTrigger, setUpdateTrigger] = useState(0); // Force re-render trigger

  // Helper function to get the spot's unique ID (handles both _id and id)
  const getSpotId = useCallback((spot) => {
    return String(spot._id || spot.id);
  }, []);

  const isBookmarked = useCallback((spotId) => {
    const id = String(spotId);
    return bookmarkedIds.has(id);
  }, [bookmarkedIds]); // Depend on bookmarkedIds

  const toggleBookmark = useCallback((spot) => {
    const spotId = getSpotId(spot);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 TOGGLE BOOKMARK CALLED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Spot:', spot.name, 'ID:', spotId);
    
    setBookmarkedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(spotId)) {
        newSet.delete(spotId);
        console.log(`✖️ REMOVED bookmark for: ${spot.name}`);
      } else {
        newSet.add(spotId);
        console.log(`✔️ ADDED bookmark for: ${spot.name}`);
      }
      return newSet;
    });

    setBookmarkedSpots(prev => {
      const exists = prev.find(s => getSpotId(s) === spotId);
      if (exists) {
        return prev.filter(s => getSpotId(s) !== spotId);
      } else {
        return [...prev, spot];
      }
    });

    // Force UI update
    setUpdateTrigger(prev => prev + 1);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }, [getSpotId]);

  const removeBookmark = useCallback((spotId) => {
    const id = String(spotId);
    setBookmarkedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });

    setBookmarkedSpots(prev => prev.filter(s => getSpotId(s) !== id));
    setUpdateTrigger(prev => prev + 1);
  }, [getSpotId]);

  const getBookmarkedSpots = useCallback(() => {
    return bookmarkedSpots;
  }, [bookmarkedSpots]);

  return (
    <BookmarkContext.Provider
      value={{
        bookmarks: bookmarkedSpots,
        isBookmarked,
        toggleBookmark,
        removeBookmark,
        getBookmarkedSpots,
        updateTrigger, // Expose this so components can depend on it
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
};