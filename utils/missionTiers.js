// Mission hierarchy (2026-10-01).
//
//   MAJOR — arriving at the spot, and the AR mission. They're the reason to go
//           there: you have to physically be at the landmark.
//   MINOR — the AI photo scan and the food recommendation ("location"). Worth
//           doing while you're there, but extras.
//
// "Arrive at the spot" is not a Mission document. It's the GPS arrival the
// arrival engine already detects (ArrivalContext), which logs the visit and
// awards POINTS_PER_VISIT on the backend. The Bakit List shows it as the first
// major mission and ticks it from the user's visit logs (PointsContext).
//
// What users see: one checklist per spot, major items first, each marked
// "Must-do" (2026-10-20, simplified from separate "Must-Dos" and "Side Trips"
// sections).

export const MAJOR_TYPES = new Set(["ar"]);

// Mirrors POINTS_PER_VISIT in LibotBackend/controllers/userController.js —
// the server awards it; this copy is only for display.
export const ARRIVAL_POINTS = 10;

export const isMajor = (mission) => MAJOR_TYPES.has(mission?.type);

// Each kind of Bakit List item's icon and short name, for the spot page and the
// Bakit List quick action. Every spot has an AI scan, a nearby eatery and an AR
// mission (2026-10); the rest are older kinds kept for any mission still using them.
// `how` is the one line the spot page's checklist shows under an item not yet done.
export const MISSION_KINDS = {
  checkin:  { icon: "map-pin",     label: "Check In",    how: "Check in at the spot" },
  photo:    { icon: "camera",      label: "Photo",       how: "Take a photo there" },
  ar:       { icon: "aperture",    label: "AR",          how: "Opens when you're at the spot" },
  quiz:     { icon: "help-circle", label: "Quiz",        how: "Answer the question" },
  // Camera capture verified by an on-spot AI classifier (which model runs
  // depends on the spot's category).
  ai:       { icon: "cpu",         label: "AI Scan",     how: "Take a photo of it there" },
  // A geofenced food recommendation the traveler must physically visit (see
  // Screens/LocationMission.js). Not the map pin: that is arriving at the spot.
  location: { icon: "utensils",    label: "Nearby Eats", how: "Visit the recommended eatery" },
};

export const ARRIVAL_KIND = { icon: "map-pin", label: "Arrive", how: "Go there in person" };

export const missionKind = (mission) => MISSION_KINDS[mission?.type] || MISSION_KINDS.checkin;

/**
 * Whether a traveler can do this mission today. Only those count toward the
 * spot's badge, which takes every one of them (the thesis panel, 2026-10-21) —
 * the same rule as the server's (LibotBackend utils/achievements.js isDoable).
 * A food mission no moderator has pinned yet (`locationConfigured: false`), a
 * photo scan for a category with no model (`aiTarget: null`), or AR at a spot
 * without a model or positions would otherwise make the badge impossible.
 */
export function isDoable(mission, spot) {
  switch (mission?.type) {
    case "ai":       return mission.aiTarget !== null;
    case "location": return mission.locationConfigured ?? (mission.coordinates?.lat != null && mission.coordinates?.lng != null);
    case "ar":       return !spot || (!!spot.AR3DModelURL && (spot.modelsCoordinates || []).length > 0);
    default:         return false;
  }
}

/**
 * A spot's Bakit List as named steps, in the order the spot page lists them:
 * arriving, the must-dos, then the side trips. [{ key, icon, label, done }]
 * Arriving counts as the first item (it isn't a Mission document). Missions
 * that can't be done yet (isDoable) are left out: they don't count. The Bakit
 * List quick action (Screens/MissionsSpotSelect.js) shows these.
 */
export function spotSteps(missions = [], completedMissionIds = [], arrived = false, spot = null) {
  const completed = new Set((completedMissionIds || []).map(String));
  const { major, minor } = splitByTier(missions.filter((m) => isDoable(m, spot)));
  return [
    { key: "arrive", ...ARRIVAL_KIND, done: !!arrived },
    ...[...major, ...minor].map((m) => ({ key: String(m._id), ...missionKind(m), done: completed.has(String(m._id)) })),
  ];
}

/** Splits a spot's missions into { major, minor }, each in `order` order. */
export function splitByTier(missions = []) {
  const sorted = [...missions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return {
    major: sorted.filter(isMajor),
    minor: sorted.filter((m) => !isMajor(m)),
  };
}
