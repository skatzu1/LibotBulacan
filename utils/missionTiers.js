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

/** Splits a spot's missions into { major, minor }, each in `order` order. */
export function splitByTier(missions = []) {
  const sorted = [...missions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return {
    major: sorted.filter(isMajor),
    minor: sorted.filter((m) => !isMajor(m)),
  };
}
