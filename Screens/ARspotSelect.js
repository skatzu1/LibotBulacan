import React from "react";
import SpotPicker from "../components/SpotPicker";
import { ensureAtSpotForAR } from "../utils/arLocationGate";

export default function ARSpotSelect() {
  const handlePick = async (spot, navigation) => {
    // AR models are anchored to real places at the spot — warn the user if
    // they're not physically there before launching.
    if (await ensureAtSpotForAR(spot)) {
      navigation.navigate("ar", { spot });
    }
  };

  return (
    <SpotPicker
      title="AR Experience"
      subtitle="Choose a landmark to view in augmented reality"
      onPick={handlePick}
    />
  );
}
