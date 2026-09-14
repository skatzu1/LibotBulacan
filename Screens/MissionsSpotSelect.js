import React from "react";
import SpotPicker from "../components/SpotPicker";

export default function MissionsSpotSelect() {
  return (
    <SpotPicker
      title="Missions"
      subtitle="Pick a spot to see its missions and start one"
      // The Mission screen needs both a spot AND a chosen mission, so route
      // through the spot's detail page, opening straight on its Missions tab.
      onPick={(spot, navigation) =>
        navigation.navigate("InformationScreen", { spot, tab: "BucketList" })
      }
    />
  );
}
