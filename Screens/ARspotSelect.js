import React, { useCallback, useMemo } from "react";
import SpotPicker from "../components/SpotPicker";
import { ProgressSummary, SpotStatusCard } from "../components/SpotProgress";
import { ensureAtSpotForAR, spotHasAR } from "../utils/arLocationGate";
import { afterAlertCloses, ensureCameraAccess } from "../utils/cameraAccess";
import { useArrival } from "../context/ArrivalContext";
import { useMissions } from "../context/MissionContext";

// AR View's spot list, laid out like the Bakit List's (components/SpotProgress.js):
// how many AR experiences are done, the spots divided into Not done yet / Done,
// and each card saying which in words (it used to be a "Done" chip on the photo
// of finished ones only). Finished spots stay tappable — done is a record, not
// a lock.
const SECTIONS = [
  { key: "todo", title: "Not done yet", sub: "Go to the spot, then start AR there." },
  { key: "done", title: "Done",         sub: "Open it again any time you're there." },
];

export default function ARSpotSelect() {
  const { allSpots } = useArrival();
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

  const summary = useMemo(() => {
    const listed = allSpots.filter(spotHasAR);
    const done = listed.filter(isDone).length;
    return { total: listed.length, done, todo: listed.length - done };
  }, [allSpots, isDone]);

  const sections = useCallback((spots) => SECTIONS.map((sec) => ({
    ...sec,
    data: spots.filter((s) => isDone(s) === (sec.key === "done")),
  })), [isDone]);

  const header = summary.total > 0 ? (
    <ProgressSummary
      kicker="YOUR AR VIEW"
      title={`${summary.done} of ${summary.total} AR experiences done`}
      done={summary.done}
      total={summary.total}
      counts={[
        { n: summary.todo, label: "Not done yet", tone: "muted" },
        { n: summary.done, label: "Done",         tone: "success" },
      ]}
    />
  ) : null;

  const renderCard = (spot, onPress) => {
    const done = isDone(spot);
    return (
      <SpotStatusCard
        spot={spot}
        onPress={onPress}
        done={done}
        status={done ? { text: "AR done" } : { icon: "aperture", text: "Not done yet" }}
        cta="Start AR"
        accessibilityLabel={[spot.name, spot.city, done ? "AR done" : "AR not done yet"].filter(Boolean).join(", ")}
        accessibilityHint="Starts AR View. It opens only when you're at the spot."
      />
    );
  };

  return (
    <SpotPicker
      title="AR Experience"
      subtitle="See each landmark's 3D model around you. AR opens only when you're at the spot."
      header={header}
      sections={sections}
      renderCard={renderCard}
      onPick={handlePick}
      filter={spotHasAR}
    />
  );
}
