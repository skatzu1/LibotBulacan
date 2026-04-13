import React, { createContext, useState, useContext, useCallback, useRef } from "react";

const MissionContext = createContext();
export const useMissions = () => useContext(MissionContext);

export const MissionProvider = ({ children }) => {
  const [missionsBySpot, setMissionsBySpot] = useState({});
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

  return (
    <MissionContext.Provider value={{ fetchMissions, getMissionsForSpot, refetchMissions }}>
      {children}
    </MissionContext.Provider>
  );
};