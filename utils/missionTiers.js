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

export const MAJOR_TYPES = new Set(["ar"]);

// What users see. Travel-guide words rather than "major/minor":
//   Must-Dos   — what you came for (major).
//   Side Trips — small detours while you're nearby, like the eatery (minor).
export const TIER_LABELS = {
  major: { title: "Must-Dos",   sub: "What you came here for. Worth the most points." },
  minor: { title: "Side Trips", sub: "Little extras while you're nearby." },
};

// Mirrors POINTS_PER_VISIT in LibotBackend/controllers/userController.js —
// the server awards it; this copy is only for display.
export const ARRIVAL_POINTS = 10;

export const isMajor = (mission) => MAJOR_TYPES.has(mission?.type);

// Each kind of Bakit List item's icon and short name, for the spot page and the
// Bakit List quick action. Every spot has an AI scan, a nearby eatery and an AR
// mission (2026-10); the rest are older kinds kept for any mission still using them.
export const MISSION_KINDS = {
  checkin:  { icon: "map-pin",     label: "Check In" },
  photo:    { icon: "camera",      label: "Photo"    },
  ar:       { icon: "aperture",    label: "AR"       },
  quiz:     { icon: "help-circle", label: "Quiz"     },
  // Camera capture verified by an on-spot AI classifier (which model runs
  // depends on the spot's category).
  ai:       { icon: "cpu",         label: "AI Scan"  },
  // A geofenced food recommendation the traveler must physically visit (see
  // Screens/LocationMission.js). Not the map pin: that is arriving at the spot.
  location: { icon: "utensils",    label: "Nearby Eats" },
};

export const ARRIVAL_KIND = { icon: "map-pin", label: "Arrive" };

export const missionKind = (mission) => MISSION_KINDS[mission?.type] || MISSION_KINDS.checkin;

/**
 * A spot's Bakit List as named steps, in the order the spot page lists them:
 * arriving, the must-dos, then the side trips. [{ key, icon, label, done }]
 * Arriving counts as the first item (it isn't a Mission document). The Bakit
 * List quick action (Screens/MissionsSpotSelect.js) shows these.
 */
export function spotSteps(missions = [], completedMissionIds = [], arrived = false) {
  const completed = new Set((completedMissionIds || []).map(String));
  const { major, minor } = splitByTier(missions);
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
