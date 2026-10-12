// What the "you arrived" notification says, for one arrival or several at once.
//
// Spots can sit very close together — a festival held in a churchyard, a
// museum beside its church: 7 pairs of spots are under 100 m apart, the
// closest 29 m — so one walk can enter two or three 50 m arrival circles at
// the same moment. Each used to raise its own notification; arrivals that come
// together now share one, which names them all.
//
// Each arrival is { spotId, spotName, isFirstVisit }.

const joinNames = (names) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

export function arrivalNoticeContent(arrivals) {
  const first = arrivals[0];
  if (arrivals.length === 1) {
    return {
      title: first.isFirstVisit ? "You arrived!" : "Welcome back!",
      body: first.isFirstVisit
        ? `You've reached ${first.spotName}! Open Libot Bulacan to claim your badge.`
        : `You've arrived at ${first.spotName}. Open Libot Bulacan to explore!`,
      data: { spotId: first.spotId, spotName: first.spotName, isFirstVisit: first.isFirstVisit },
    };
  }
  const anyFirst = arrivals.some((a) => a.isFirstVisit);
  const names = joinNames(arrivals.map((a) => a.spotName));
  return {
    title: anyFirst ? `You arrived at ${arrivals.length} spots!` : "Welcome back!",
    body: anyFirst
      ? `You've reached ${names}! Open Libot Bulacan to claim your badges.`
      : `You've arrived at ${names}. Open Libot Bulacan to explore!`,
    // A tap opens the first spot, as a single arrival's does.
    data: {
      spotId: first.spotId,
      spotName: first.spotName,
      isFirstVisit: anyFirst,
      spotIds: arrivals.map((a) => a.spotId),
    },
  };
}
