import React, { useCallback, useMemo } from "react";
import SpotPicker from "../components/SpotPicker";
import { useArrival } from "../context/ArrivalContext";
import { useMissions } from "../context/MissionContext";
import { usePoints } from "../context/PointsContext";
import { spotSteps } from "../utils/missionTiers";

// The Bakit List quick action: where the traveler stands on every spot's list
// (QA 2026-10-16: "a way to see Bakit List progress from the quick action").
// It used to be a "2/5 done" chip on each big photo, which didn't say much
// (user, 2026-10-20: "the ui is so confusing" … "make it like the badge
// screen"). Now it is the Badges screen's grid (components/SpotPicker.js):
// finished spots first, like claimed badges, then the ones in progress
// (furthest along first), then the rest; each card says "2 of 4". The count is
// arriving plus each activity, as on the spot page (spotSteps). AR View and
// Navigate are laid out the same way.
export default function MissionsSpotSelect() {
  const { allSpots } = useArrival();
  const { getMissionsForSpot, completedMissions } = useMissions();
  const { hasVisited } = usePoints();

  const progress = useMemo(() => {
    const out = new Map();
    for (const spot of allSpots) {
      const steps = spotSteps(getMissionsForSpot(spot._id), completedMissions, hasVisited(spot._id), spot);
      out.set(String(spot._id), { steps, done: steps.filter((st) => st.done).length, total: steps.length });
    }
    return out;
  }, [allSpots, getMissionsForSpot, completedMissions, hasVisited]);
  const progressOf = useCallback((spot) => progress.get(String(spot._id)) || { steps: [], done: 0, total: 1 }, [progress]);

  const isDone = useCallback((spot) => {
    const p = progressOf(spot);
    return p.done === p.total;
  }, [progressOf]);
  // Furthest along first; not started last.
  const rank = useCallback((spot) => {
    const p = progressOf(spot);
    return -p.done / p.total;
  }, [progressOf]);
  // To do = spots already started; untouched ones show only under All
  // (user, 2026-10-25: "to do in bakit list should only contain spots with progress").
  const started = useCallback((spot) => progressOf(spot).done > 0, [progressOf]);

  return (
    <SpotPicker
      title="Bakit List"
      onPick={(spot, navigation) =>
        // The Mission screen needs both a spot AND a chosen activity, so route
        // through the spot's detail page, opening straight on its Bakit List tab.
        navigation.navigate("InformationScreen", { spot, tab: "BucketList" })
      }
      isDone={isDone}
      rank={rank}
      started={started}
      labels={{ todo: "To do", done: "Finished", todoEmpty: "No spots started yet" }}
      footer={(spot) => {
        const { done, total } = progressOf(spot);
        return done === total ? { text: "All done" } : { text: `${done} of ${total}` };
      }}
      a11y={(spot) => {
        const { steps, done, total } = progressOf(spot);
        return [
          spot.name, spot.city,
          done === total ? "Bakit List finished" : `${done} of ${total} done`,
          ...steps.map((st) => `${st.label} ${st.done ? "done" : "not done"}`),
        ].filter(Boolean).join(", ");
      }}
      a11yHint="Opens this spot's Bakit List"
    />
  );
}
