import React, { useCallback, useMemo } from "react";
import SpotPicker from "../components/SpotPicker";
import { ProgressSummary, SpotStatusCard } from "../components/SpotProgress";
import { useArrival } from "../context/ArrivalContext";
import { usePoints } from "../context/PointsContext";

// Navigate's spot list, laid out like the Bakit List's (components/SpotProgress.js):
// how many spots the traveler has reached, the spots divided into Not visited
// yet / Visited, and each card saying which. "Visited" is a logged arrival, the
// same one that ticks "Arrive" on the Bakit List.
const SECTIONS = [
  { key: "todo", title: "Not visited yet", sub: "Places you haven't reached yet." },
  { key: "done", title: "Visited",         sub: "You've been here. Directions back any time." },
];

export default function TrackSpotSelect() {
  const { allSpots } = useArrival();
  const { hasVisited } = usePoints();
  const visited = useCallback((spot) => !!hasVisited(spot._id), [hasVisited]);

  const summary = useMemo(() => {
    const done = allSpots.filter(visited).length;
    return { total: allSpots.length, done, todo: allSpots.length - done };
  }, [allSpots, visited]);

  const sections = useCallback((spots) => SECTIONS.map((sec) => ({
    ...sec,
    data: spots.filter((s) => visited(s) === (sec.key === "done")),
  })), [visited]);

  const header = summary.total > 0 ? (
    <ProgressSummary
      kicker="PLACES YOU'VE BEEN"
      title={`${summary.done} of ${summary.total} spots visited`}
      done={summary.done}
      total={summary.total}
      counts={[
        { n: summary.todo, label: "Not visited yet", tone: "muted" },
        { n: summary.done, label: "Visited",         tone: "success" },
      ]}
    />
  ) : null;

  const renderCard = (spot, onPress) => {
    const done = visited(spot);
    return (
      <SpotStatusCard
        spot={spot}
        onPress={onPress}
        done={done}
        status={done ? { text: "Visited" } : { icon: "map-pin", text: "Not visited yet" }}
        cta="Directions"
        accessibilityLabel={[spot.name, spot.city, done ? "visited" : "not visited yet"].filter(Boolean).join(", ")}
        accessibilityHint="Shows directions to this spot"
      />
    );
  };

  return (
    <SpotPicker
      title="Navigate"
      subtitle="Choose where you'd like directions to."
      header={header}
      sections={sections}
      renderCard={renderCard}
      onPick={(spot, navigation) => navigation.navigate("Track", { spot })}
    />
  );
}
