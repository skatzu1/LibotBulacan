import React, { createContext, useContext, useState, useCallback } from 'react';

const PointsContext = createContext(null);

export function PointsProvider({ children }) {
  const [userPoints, setUserPoints] = useState(180);
  const [userVisits, setUserVisits] = useState(18);
  const [checkedInSpots, setCheckedInSpots] = useState(new Set());

  const awardPoints = useCallback((spot) => {
    const pts = spot.points ?? 10;
    setUserPoints((p) => p + pts);
    setUserVisits((v) => v + 1);
    setCheckedInSpots((prev) => new Set([...prev, spot._id ?? spot.id]));
    return pts;
  }, []);

  const hasVisited = useCallback(
    (spotId) => checkedInSpots.has(spotId),
    [checkedInSpots]
  );

  return (
    <PointsContext.Provider value={{ userPoints, userVisits, awardPoints, hasVisited }}>
      {children}
    </PointsContext.Provider>
  );
}

export function usePoints() {
  const ctx = useContext(PointsContext);
  if (!ctx) throw new Error('usePoints must be inside <PointsProvider>');
  return ctx;
}