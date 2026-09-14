import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import api from '../api';

const PointsContext = createContext(null);

export function PointsProvider({ children }) {
  const { isLoaded, isSignedIn } = useAuth();

  const [userPoints, setUserPoints] = useState(0);
  const [userVisits, setUserVisits] = useState(0);
  const [checkedInSpots, setCheckedInSpots] = useState(new Set());

  // Pull the authoritative points/visits from the backend (same source the
  // Profile screen reads). Runs on sign-in and can be re-run via refresh().
  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const res = await api.get('/api/users/me');
      const user = res.data?.user;
      if (typeof user?.points === 'number') setUserPoints(user.points);
      if (Array.isArray(user?.visitedSpots)) setUserVisits(user.visitedSpots.length);
    } catch (err) {
      console.warn('PointsContext refresh failed:', err?.message);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (isLoaded && isSignedIn) refresh();
    else if (isLoaded && !isSignedIn) {
      setUserPoints(0);
      setUserVisits(0);
      setCheckedInSpots(new Set());
    }
  }, [isLoaded, isSignedIn, refresh]);

  // Optimistic local bump when a visit is logged; the backend is the source of
  // truth, so refresh() reconciles on the next screen focus.
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
    <PointsContext.Provider value={{ userPoints, userVisits, awardPoints, hasVisited, refresh }}>
      {children}
    </PointsContext.Provider>
  );
}

export function usePoints() {
  const ctx = useContext(PointsContext);
  if (!ctx) throw new Error('usePoints must be inside <PointsProvider>');
  return ctx;
}
