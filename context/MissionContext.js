import React, { createContext, useState, useContext, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import api, { BASE_URL } from "../api";
import { usePoints } from "./PointsContext";

const MissionContext = createContext();
export const useMissions = () => useContext(MissionContext);

export const MissionProvider = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const { refresh: refreshPoints } = usePoints();

  const [missionsBySpot, setMissionsBySpot] = useState({});
  const [completedMissions, setCompletedMissions] = useState([]);
  const fetchedSpots = useRef(new Set());

  const fetchMissions = useCallback(async (spotId) => {
    if (!spotId) return;
    if (fetchedSpots.current.has(spotId)) return;
    fetchedSpots.current.add(spotId);

    try {
      const res = await fetch(
        `${BASE_URL}/api/missions/${spotId}`
      );
      const data = await res.json();

      if (data.success) {
        setMissionsBySpot((prev) => ({ ...prev, [spotId]: data.missions }));
      } else {
        console.warn("fetchMissions: server returned success=false", data.message);
        fetchedSpots.current.delete(spotId);
      }
    } catch (err) {
      console.error("Error fetching missions:", err);
      fetchedSpots.current.delete(spotId);
    }
  }, []);

  useEffect(() => {
    const prefetchAllMissions = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/spots`);
        const data = await res.json();
        if (data.success && data.spots) {
          for (const spot of data.spots) {
            if (spot._id) await fetchMissions(spot._id);
          }
        }
      } catch (err) {
        console.error("Error prefetching missions:", err);
      }
    };
    prefetchAllMissions();
  }, [fetchMissions]);

  const getMissionsForSpot = useCallback(
    (spotId) => missionsBySpot[spotId] || [],
    [missionsBySpot]
  );

  const refetchMissions = useCallback(async (spotId) => {
    if (!spotId) return;
    fetchedSpots.current.delete(spotId);
    setMissionsBySpot((prev) => {
      const next = { ...prev };
      delete next[spotId];
      return next;
    });
    fetchedSpots.current.add(spotId);

    try {
      const res = await fetch(
        `${BASE_URL}/api/missions/${spotId}`
      );
      const data = await res.json();
      if (data.success) {
        setMissionsBySpot((prev) => ({ ...prev, [spotId]: data.missions }));
      } else {
        fetchedSpots.current.delete(spotId);
      }
    } catch (err) {
      console.error("Error refetching missions:", err);
      fetchedSpots.current.delete(spotId);
    }
  }, []);

  // ── Completed missions — persisted server-side (User.completedMissions) so
  // progress survives app restarts instead of living only in this state. ──

  // Hydrate on sign-in; reset on sign-out.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setCompletedMissions([]); return; }

    let cancelled = false;
    api.get("/api/missions/completed")
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success && Array.isArray(res.data.missionIds)) {
          setCompletedMissions(res.data.missionIds);
        }
      })
      .catch((err) => console.warn("Could not load completed missions:", err?.message));

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  // `extra` is optional request-body data — "location" missions need the
  // user's current { lat, lng } so the backend can verify they're actually
  // within range before accepting the completion (that can genuinely fail —
  // unlike an AI/AR mission, which only calls this after already passing its
  // own check, a location mission's server-side distance check is the *only*
  // gate). Returns the raw response so a caller like LocationMission.js can
  // branch on `tooFar` / `noLocation`; other callers (Mission.js, ARScreen)
  // already ignore the return value and keep working unchanged.
  const completeMission = useCallback(async (missionId, extra) => {
    if (!missionId) return null;

    try {
      const res = await api.patch(`/api/missions/${missionId}/complete`, extra || {});
      const data = res.data;

      // Only reflect "done" once the server actually agrees — a location
      // mission can be rejected (tooFar / noLocation), so no optimistic
      // update here the way a plain fire-and-forget completion might do.
      if (data?.success && (data.alreadyCompleted || (!data.tooFar && !data.noLocation))) {
        setCompletedMissions((prev) => (prev.includes(missionId) ? prev : [...prev, missionId]));
        if (!data.alreadyCompleted) refreshPoints();
      }
      return data;
    } catch (err) {
      console.warn("Could not persist mission completion:", err?.message);
      return null;
    }
  }, [refreshPoints]);

  return (
    <MissionContext.Provider
      value={{
        fetchMissions,
        getMissionsForSpot,
        refetchMissions,
        completedMissions,
        completeMission,
      }}
    >
      {children}
    </MissionContext.Provider>
  );
};
