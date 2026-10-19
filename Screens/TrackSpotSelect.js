import React, { useCallback } from "react";
import SpotPicker from "../components/SpotPicker";
import { usePoints } from "../context/PointsContext";

// Navigate's spot list: the Badges screen's grid (components/SpotPicker.js),
// visited spots first, like claimed badges. "Visited" is a logged arrival, the
// same one that ticks "Arrive" on the Bakit List.
export default function TrackSpotSelect() {
  const { hasVisited } = usePoints();
  const isDone = useCallback((spot) => !!hasVisited(spot._id), [hasVisited]);

  return (
    <SpotPicker
      title="Navigate"
      onPick={(spot, navigation) => navigation.navigate("Track", { spot })}
      isDone={isDone}
      labels={{ todo: "Not visited", done: "Visited" }}
      footer={(spot) => (isDone(spot) ? { text: "Visited" } : { text: "Directions", icon: "navigation" })}
      a11y={(spot) => [spot.name, spot.city, isDone(spot) ? "visited" : "not visited yet"].filter(Boolean).join(", ")}
      a11yHint="Shows directions to this spot"
    />
  );
}
