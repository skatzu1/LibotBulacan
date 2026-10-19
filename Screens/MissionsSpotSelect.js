import React, { useCallback, useMemo } from "react";
import SpotPicker from "../components/SpotPicker";
import { SpotStatusCard } from "../components/SpotProgress";
import { useArrival } from "../context/ArrivalContext";
import { useMissions } from "../context/MissionContext";
import { usePoints } from "../context/PointsContext";
import { spotSteps } from "../utils/missionTiers";

// The Bakit List quick action: where the traveler stands on every spot's list
// (QA 2026-10-16: "a way to see Bakit List progress from the quick action").
// It used to be a "2/5 done" chip on each photo, which didn't say what the 5
// were (user, 2026-10-20: "the ui is so confusing", then "make it simple").
// Now the spots are divided into In progress / Not started / Finished, and
// each says "2 of 4 done" next to one small icon per item, ticked when done:
// the same items, in the same order, as its spot page (spotSteps). AR View and
// Navigate have the same layout (components/SpotProgress.js).
const SECTIONS = [
  { key: "started",  title: "In progress" },
  { key: "todo",     title: "Not started" },
  { key: "finished", title: "Finished" },
];

const stateOf = ({ done, total }) => (done === 0 ? "todo" : done === total ? "finished" : "started");

export default function MissionsSpotSelect() {
  const { allSpots } = useArrival();
  const { getMissionsForSpot, completedMissions } = useMissions();
  const { hasVisited } = usePoints();

  // Per spot: its steps, and how many are done.
  const progress = useMemo(() => {
    const out = new Map();
    for (const spot of allSpots) {
      const steps = spotSteps(getMissionsForSpot(spot._id), completedMissions, hasVisited(spot._id));
      out.set(String(spot._id), { steps, done: steps.filter((st) => st.done).length, total: steps.length });
    }
    return out;
  }, [allSpots, getMissionsForSpot, completedMissions, hasVisited]);
  const progressOf = useCallback((spot) => progress.get(String(spot._id)) || { steps: [], done: 0, total: 0 }, [progress]);

  // In progress first, furthest along on top; the rest keep the list's order.
  const sections = useCallback((spots) => SECTIONS.map((sec) => {
    const data = spots.filter((s) => stateOf(progressOf(s)) === sec.key);
    if (sec.key === "started") {
      data.sort((a, b) => {
        const pa = progressOf(a), pb = progressOf(b);
        return pb.done / pb.total - pa.done / pa.total;
      });
    }
    return { ...sec, data };
  }), [progressOf]);

  const renderCard = (spot, onPress) => {
    const { steps, done, total } = progressOf(spot);
    const state = stateOf({ done, total });
    return (
      <SpotStatusCard
        spot={spot}
        onPress={onPress}
        steps={steps}
        status={{
          text: state === "finished" ? "All done" : `${done} of ${total} done`,
          tone: state === "finished" ? "done" : state === "started" ? "progress" : "todo",
        }}
        accessibilityLabel={[
          spot.name, spot.city,
          state === "finished" ? "Bakit List finished" : `${done} of ${total} done`,
          ...steps.map((st) => `${st.label} ${st.done ? "done" : "not done"}`),
        ].filter(Boolean).join(", ")}
        accessibilityHint="Opens this spot's Bakit List"
      />
    );
  };

  return (
    <SpotPicker
      title="Bakit List"
      subtitle="Things to do at each spot. Tap one to see its list."
      sections={sections}
      renderCard={renderCard}
      // The Mission screen needs both a spot AND a chosen activity, so route
      // through the spot's detail page, opening straight on its Bakit List tab.
      onPick={(spot, navigation) =>
        navigation.navigate("InformationScreen", { spot, tab: "BucketList" })
      }
    />
  );
}
