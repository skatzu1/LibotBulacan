import React, { useCallback } from "react";
import SpotPicker from "../components/SpotPicker";
import { SpotStatusCard } from "../components/SpotProgress";
import { ensureAtSpotForAR, spotHasAR } from "../utils/arLocationGate";
import { afterAlertCloses, ensureCameraAccess } from "../utils/cameraAccess";
import { useMissions } from "../context/MissionContext";

// AR View's spot list, laid out like the Bakit List's (components/SpotProgress.js):
// the spots divided into Not done yet / Done, each saying which. Finished spots
// stay tappable — done is a record, not a lock.
const SECTIONS = [
  { key: "todo", title: "Not done yet" },
  { key: "done", title: "Done" },
];

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

  const sections = useCallback((spots) => SECTIONS.map((sec) => ({
    ...sec,
    data: spots.filter((s) => isDone(s) === (sec.key === "done")),
  })), [isDone]);

  const renderCard = (spot, onPress) => {
    const done = isDone(spot);
    return (
      <SpotStatusCard
        spot={spot}
        onPress={onPress}
        status={done ? { text: "AR done", tone: "done" } : { text: "Not done yet", tone: "todo", icon: "aperture" }}
        accessibilityLabel={[spot.name, spot.city, done ? "AR done" : "AR not done yet"].filter(Boolean).join(", ")}
        accessibilityHint="Starts AR View. It opens only when you're at the spot."
      />
    );
  };

  return (
    <SpotPicker
      title="AR Experience"
      subtitle="AR opens only when you're at the spot."
      sections={sections}
      renderCard={renderCard}
      onPick={handlePick}
      filter={spotHasAR}
    />
  );
}
