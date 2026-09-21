import React from "react";
import SpotPicker from "../components/SpotPicker";

export default function MissionsSpotSelect() {
  return (
    <SpotPicker
      title="Bakit List"
      subtitle="Pick a spot to see its Bakit List and start an activity"
      // The Mission screen needs both a spot AND a chosen activity, so route
      // through the spot's detail page, opening straight on its Bakit List tab.
      onPick={(spot, navigation) =>
        navigation.navigate("InformationScreen", { spot, tab: "BucketList" })
      }
    />
  );
}
