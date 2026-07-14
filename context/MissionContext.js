import React, { createContext, useState, useContext, useCallback, useRef, useEffect } from "react";

const MissionContext = createContext();
export const useMissions = () => useContext(MissionContext);

export const MissionProvider = ({ children }) => {
  const [missionsBySpot, setMissionsBySpot] = useState({});
  const [completedMissions, setCompletedMissions] = useState([]);
  const fetchedSpots = useRef(new Set());

  const fetchMissions = useCallback(async (spotId) => {
    if (!spotId) return;
    if (fetchedSpots.current.has(spotId)) return;
    fetchedSpots.current.add(spotId);

    try {
      const res = await fetch(
        `https://libotbackend.onrender.com/api/missions/${spotId}`
      );
      const data = await res.json();

      if (data.success) {
        setMissionsBySpot((prev) => ({ ...prev, [spotId]: data.missions }));
      } else {
        console.warn("⚠️ fetchMissions: server returned success=false", data.message);
        fetchedSpots.current.delete(spotId);
      }
    } catch (err) {
      console.error("❌ Error fetching missions:", err);
      fetchedSpots.current.delete(spotId);
    }
  }, []);

  useEffect(() => {
    const prefetchAllMissions = async () => {
      try {
        const res = await fetch("https://libotbackend.onrender.com/api/spots");
        const data = await res.json();
        if (data.success && data.spots) {
          for (const spot of data.spots) {
            if (spot._id) await fetchMissions(spot._id);
          }
        }
      } catch (err) {
        console.error("❌ Error prefetching missions:", err);
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
        `https://libotbackend.onrender.com/api/missions/${spotId}`
      );
      const data = await res.json();
      if (data.success) {
        setMissionsBySpot((prev) => ({ ...prev, [spotId]: data.missions }));
      } else {
        fetchedSpots.current.delete(spotId);
      }
    } catch (err) {
      console.error("❌ Error refetching missions:", err);
      fetchedSpots.current.delete(spotId);
    }
  }, []);
  const completeMission = useCallback((missionId) => {
  if (!missionId) return;

  setCompletedMissions((prev) => {
    if (prev.includes(missionId)) return prev;
    return [...prev, missionId];
  });
}, []);

  return (
    <MissionContext.Provider
  value={{
    fetchMissions,
    getMissionsForSpot,
    refetchMissions,

    // ✅ ADD THESE TWO
    completedMissions,
    completeMission,
  }}
>
      {children}
    </MissionContext.Provider>
  );
};