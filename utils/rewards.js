/*
 * The calls that show a reward moment (components/RewardCelebration.js draws
 * them). Kept apart from the drawing, with no imports, so any screen or context
 * can call them without pulling in the celebration's UI.
 *
 *   celebrate(unlocked)      a full-screen moment per reward: a spot's badge,
 *                            then a town's, a district's, The GOAT Traveler
 *   showProgress(progress)   a small banner for a step that earns nothing yet:
 *                            "+5 points · 2 of 3 done at Barasoain Church"
 *   celebrateResult(reply)   either, from a progress route's reply
 *                            (POST /api/arrivals, PATCH /api/missions/:id/complete,
 *                            POST /api/verify/:id — `unlocked` and `progress`)
 */

let handlers = { items: null, banner: null };

/** RewardCelebrationProvider plugs its drawing in here; null when it unmounts. */
export function setRewardHandlers(next) {
  handlers = next || { items: null, banner: null };
}

/**
 * The server's `unlocked` (single or list fields) as moments, in order: spot
 * badges, then towns (bronze), districts (silver), The GOAT Traveler (gold).
 */
export function itemsFrom(unlocked) {
  if (!unlocked) return [];
  const all = (list, one) => [...(list || []), ...(one ? [one] : [])];
  return [
    ...all(unlocked.spotBadges, unlocked.spotBadge).map((badge) => ({ kind: "spot", badge })),
    ...all(unlocked.townBadges, unlocked.townBadge).map((town) => ({ kind: "town", town })),
    ...all(unlocked.districtBadges, unlocked.districtBadge).map((district) => ({ kind: "district", district })),
    ...(unlocked.title ? [{ kind: "title", title: unlocked.title }] : []),
  ];
}

/** Shows a moment for each reward in `unlocked`. True when there was one. */
export function celebrate(unlocked) {
  const items = itemsFrom(unlocked);
  if (!items.length || !handlers.items) return false;
  handlers.items(items);
  return true;
}

/** The small banner for a step on the way: { points, done, total, spotName, complete }. */
export function showProgress(progress) {
  if (handlers.banner && progress) handlers.banner(progress);
}

/** A progress route's reply: the moment if it unlocked something, else the banner. */
export function celebrateResult(reply, { points } = {}) {
  if (!reply) return false;
  if (celebrate(reply.unlocked)) return true;
  const pts = reply.pointsAwarded ?? reply.pointsEarned ?? points ?? 0;
  if (reply.progress && pts > 0) {
    showProgress({ points: pts, ...reply.progress });
    return true;
  }
  return false;
}
