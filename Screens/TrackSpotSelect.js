import React, { useCallback } from "react";
import SpotPicker from "../components/SpotPicker";
import { SpotStatusCard } from "../components/SpotProgress";
import { usePoints } from "../context/PointsContext";

// Navigate's spot list, laid out like the Bakit List's (components/SpotProgress.js):
// the spots divided into Not visited yet / Visited, each saying which.
// "Visited" is a logged arrival, the same one that ticks "Arrive" on the Bakit
// List.
const SECTIONS = [
  { key: "todo", title: "Not visited yet" },
  { key: "done", title: "Visited" },
];

export default function TrackSpotSelect() {
  const { hasVisited } = usePoints();
  const visited = useCallback((spot) => !!hasVisited(spot._id), [hasVisited]);

  const sections = useCallback((spots) => SECTIONS.map((sec) => ({
    ...sec,
    data: spots.filter((s) => visited(s) === (sec.key === "done")),
  })), [visited]);

  const renderCard = (spot, onPress) => {
    const done = visited(spot);
    return (
      <SpotStatusCard
        spot={spot}
        onPress={onPress}
        status={done ? { text: "Visited", tone: "done" } : { text: "Not visited yet", tone: "todo", icon: "map-pin" }}
        accessibilityLabel={[spot.name, spot.city, done ? "visited" : "not visited yet"].filter(Boolean).join(", ")}
        accessibilityHint="Shows directions to this spot"
      />
    );
  };

  return (
    <SpotPicker
      title="Navigate"
      subtitle="Choose where you'd like directions to."
      sections={sections}
      renderCard={renderCard}
      onPick={(spot, navigation) => navigation.navigate("Track", { spot })}
    />
  );
}
