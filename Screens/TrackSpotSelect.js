import React from "react";
import SpotPicker from "../components/SpotPicker";

export default function TrackSpotSelect() {
  return (
    <SpotPicker
      title="Navigate"
      subtitle="Choose where you'd like directions to"
      onPick={(spot, navigation) => navigation.navigate("Track", { spot })}
    />
  );
}
