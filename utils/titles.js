/*
 * Traveler titles, earned by finishing towns — every mission at every spot in
 * the town. The backend awards them (LibotBackend utils/titles.js, keep the two
 * the same): 1 town Explorer, 3 towns Voyager, every town that has spots GOAT
 * Traveler. A title never goes down. The server sends `{ key, name }`; this is
 * for the ladder's wording and order.
 */

export const TITLES = [
  { key: "explorer", name: "Explorer",      towns: 1,     blurb: "Finished every mission in a town" },
  { key: "voyager",  name: "Voyager",       towns: 3,     blurb: "Finished three towns" },
  { key: "goat",     name: "GOAT Traveler", towns: "all", blurb: "Finished every town with spots" },
];

export const titleRank = (key) => TITLES.findIndex((t) => t.key === key);

/** The title's display name, or null. Accepts a key or the server's { key, name }. */
export function titleName(title) {
  const key = typeof title === "string" ? title : title?.key;
  return TITLES.find((t) => t.key === key)?.name ?? (typeof title === "object" && title?.name) ?? null;
}

/** "2 more towns to Voyager" — from the server's nextTitle { name, townsLeft }. */
export function nextTitleLine(next) {
  if (!next) return "You've earned every title";
  const n = next.townsLeft;
  return `${n} more town${n === 1 ? "" : "s"} to ${next.name}`;
}
