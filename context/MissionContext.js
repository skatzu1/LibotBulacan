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

  // Every spot's missions in one request, once signed in. This used to fetch
  // the spot list and then each spot's missions one after another — 24
  // requests on every launch, the sign-in screen included. A spot fetched on
  // its own meanwhile (its page, pull to refresh) is newer, so it is kept.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    api.get("/api/missions")
      .then(({ data }) => {
        if (cancelled || !data?.success || !data.missionsBySpot) return;
        Object.keys(data.missionsBySpot).forEach((id) => fetchedSpots.current.add(id));
        setMissionsBySpot((prev) => ({ ...data.missionsBySpot, ...prev }));
      })
      .catch((err) => console.warn("Could not load missions:", err?.message));
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  const getMissionsForSpot = useCallback(
    (spotId) => missionsBySpot[spotId] || [],
    [missionsBySpot]
  );

  // Pull to refresh on the spot page. The current list stays on screen until
  // the new one arrives, and stays if the request fails; it used to be
  // cleared first, so a refresh on a bad signal emptied the missions.
  const refetchMissions = useCallback(async (spotId) => {
    if (!spotId) return;
    try {
      const res = await fetch(
        `${BASE_URL}/api/missions/${spotId}`
      );
      const data = await res.json();
      if (data.success) {
        fetchedSpots.current.add(spotId);
        setMissionsBySpot((prev) => ({ ...prev, [spotId]: data.missions }));
      }
    } catch (err) {
      console.error("Error refetching missions:", err);
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

  // `extra` is request-body data. "location" and "ar" missions need the
  // user's current { lat, lng } — the server checks it against the mission's
  // pin / the spot and refuses from too far away (`tooFar` / `noLocation`).
  // Returns the raw response so callers can branch on those. Photo ("ai")
  // missions aren't completed here at all: the server completes them when it
  // verifies the photo (see markCompleted); this only confirms one that's done.
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

  // For a mission the server has already completed and paid out — a photo
  // mission, the moment its photo is verified at the spot.
  const markCompleted = useCallback((missionId) => {
    if (!missionId) return;
    setCompletedMissions((prev) => (prev.includes(missionId) ? prev : [...prev, missionId]));
    refreshPoints();
  }, [refreshPoints]);

  return (
    <MissionContext.Provider
      value={{
        fetchMissions,
        getMissionsForSpot,
        refetchMissions,
        completedMissions,
        completeMission,
        markCompleted,
      }}
    >
      {children}
    </MissionContext.Provider>
  );
};
