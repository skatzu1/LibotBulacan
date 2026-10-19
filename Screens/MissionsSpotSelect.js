import React, { useCallback, useMemo } from "react";
import SpotPicker from "../components/SpotPicker";
import { ProgressSummary, SpotStatusCard } from "../components/SpotProgress";
import { useArrival } from "../context/ArrivalContext";
import { useMissions } from "../context/MissionContext";
import { usePoints } from "../context/PointsContext";
import { spotSteps } from "../utils/missionTiers";

// The Bakit List quick action: where the traveler stands on every spot's list
// (QA 2026-10-16: "a way to see Bakit List progress from the quick action").
// It used to be a "2/5 done" chip on each photo, which didn't say what the 5
// were (user, 2026-10-20: "the ui is so confusing"). Now: a summary, the spots
// divided into In progress / Not started / Finished, and each spot's items by
// name, ticked off — the same items, in the same order, as its spot page
// (utils/missionTiers.js spotSteps). AR View and Navigate have the same layout
// (components/SpotProgress.js).
const SECTIONS = [
  { key: "started",  title: "In progress", sub: "Pick up where you left off." },
  { key: "todo",     title: "Not started", sub: "Arriving at the spot ticks the first item." },
  { key: "finished", title: "Finished",    sub: "Every item done." },
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

  const summary = useMemo(() => {
    const all = [...progress.values()];
    const count = (state) => all.filter((p) => stateOf(p) === state).length;
    return {
      spots:    all.length,
      done:     all.reduce((n, p) => n + p.done, 0),
      total:    all.reduce((n, p) => n + p.total, 0),
      started:  count("started"),
      todo:     count("todo"),
      finished: count("finished"),
    };
  }, [progress]);

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

  const header = summary.spots > 0 ? (
    <ProgressSummary
      kicker="YOUR BAKIT LIST"
      title={`${summary.done} of ${summary.total} things done`}
      done={summary.done}
      total={summary.total}
      counts={[
        { n: summary.started,  label: "In progress", tone: "brand" },
        { n: summary.todo,     label: "Not started", tone: "muted" },
        { n: summary.finished, label: "Finished",    tone: "success" },
      ]}
    />
  ) : null;

  const renderCard = (spot, onPress) => {
    const { steps, done, total } = progressOf(spot);
    const finished = total > 0 && done === total;
    return (
      <SpotStatusCard
        spot={spot}
        onPress={onPress}
        done={finished}
        bar={{ done, total }}
        steps={steps}
        accessibilityLabel={[
          spot.name, spot.city,
          finished ? "Bakit List finished" : `${done} of ${total} done`,
          ...steps.map((st) => `${st.label} ${st.done ? "done" : "not done"}`),
        ].filter(Boolean).join(", ")}
        accessibilityHint="Opens this spot's Bakit List"
      />
    );
  };

  return (
    <SpotPicker
      title="Bakit List"
      subtitle="Every spot's list of things to do there. Tap a spot to see its list and start one."
      header={header}
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
