import React, { useCallback } from "react";
import SpotPicker from "../components/SpotPicker";
import { ensureAtSpotForAR, spotHasAR } from "../utils/arLocationGate";
import { afterAlertCloses, ensureCameraAccess } from "../utils/cameraAccess";
import { useMissions } from "../context/MissionContext";

// AR View's spot list: the Badges screen's grid (components/SpotPicker.js),
// spots whose AR activity is done first, each card saying Done or what it is
// worth. Done spots stay tappable — done is a record, not a lock.
export default function ARSpotSelect() {
  const { getMissionsForSpot, completedMissions } = useMissions();

  const arMissionFor = useCallback(
    (spot) => getMissionsForSpot(spot._id).find((m) => m.type === "ar"),
    [getMissionsForSpot],
  );
  const isDone = useCallback((spot) => {
    const mission = arMissionFor(spot);
    return !!mission && (completedMissions || []).map(String).includes(String(mission._id));
  }, [arMissionFor, completedMissions]);

  const handlePick = async (spot, navigation) => {
    // AR models are anchored to real places at the spot: away from it, AR
    // doesn't open (the alert offers directions instead). Then the camera.
    if (!(await ensureAtSpotForAR(spot, { onDirections: () => navigation.navigate("Track", { spot }) }))) return;
    await afterAlertCloses();
    if (!(await ensureCameraAccess("for AR View"))) return;
    navigation.navigate("ar", { spot, arMissionId: arMissionFor(spot)?._id ?? null });
  };

  return (
    <SpotPicker
      title="AR Experience"
      subtitle="AR opens only when you're at the spot."
      filter={spotHasAR}
      onPick={handlePick}
      isDone={isDone}
      labels={{ todo: "Not done", done: "Done" }}
      footer={(spot) => {
        if (isDone(spot)) return { text: "AR done" };
        const points = arMissionFor(spot)?.points;
        return points > 0 ? { text: `+${points}`, icon: "star" } : { text: "AR", icon: "aperture" };
      }}
      a11y={(spot) => [spot.name, spot.city, isDone(spot) ? "AR done" : "AR not done yet"].filter(Boolean).join(", ")}
      a11yHint="Starts AR View. It opens only when you're at the spot."
    />
  );
}
