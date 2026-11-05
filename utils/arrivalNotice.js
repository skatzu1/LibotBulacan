export const joinNames = (names) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

export function arrivalNoticeContent(arrivals) {
  const first = arrivals[0];
  if (arrivals.length === 1) {
    return {
      title: first.isFirstVisit ? "You arrived!" : "Welcome back!",
      body: first.isFirstVisit
        ? `You've reached ${first.spotName}! Open LibotBulacan to claim your badge.`
        : `You've arrived at ${first.spotName}. Open LibotBulacan to explore!`,
      data: { spotId: first.spotId, spotName: first.spotName, isFirstVisit: first.isFirstVisit },
    };
  }
  const anyFirst = arrivals.some((a) => a.isFirstVisit);
  const names = joinNames(arrivals.map((a) => a.spotName));
  return {
    title: anyFirst ? `You arrived at ${arrivals.length} spots!` : "Welcome back!",
    body: anyFirst
      ? `You've reached ${names}! Open LibotBulacan to claim your badges.`
      : `You've arrived at ${names}. Open LibotBulacan to explore!`,
    // A tap opens the first spot, as a single arrival's does.
    data: {
      spotId: first.spotId,
      spotName: first.spotName,
      isFirstVisit: anyFirst,
      spotIds: arrivals.map((a) => a.spotId),
    },
  };
}
