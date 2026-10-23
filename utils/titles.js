import { districtName } from "./districts";

/*
 * Traveler titles (the thesis panel, 2026-10-24), each earned with its
 * achievement:
 *
 *   bronze  "<Town> Traveler"      every mission at every spot in the town
 *   silver  "District 1 Traveler"  every town in the district that has spots
 *   gold    "The GOAT Traveler"    every town in Bulacan that has spots
 *
 * The backend awards them (LibotBackend utils/titles.js; keep the two the same)
 * and sends `{ key, name, tier }`, or only the key on the leaderboard. Keys:
 * "town:<Town>", "district:<key>", "goat". A traveler keeps every title they
 * earn and picks the one to show.
 */

export const GOAT = "goat";

/** { key, name, tier } from a key or the server's object, or null. */
export function titleInfo(title) {
  const key = typeof title === "string" ? title : title?.key;
  if (!key) return null;
  if (key === GOAT) return { key, name: "The GOAT Traveler", tier: "gold" };
  const colon = key.indexOf(":");
  const kind = colon > 0 ? key.slice(0, colon) : "";
  const id = key.slice(colon + 1);
  if (kind === "town" && id) return { key, name: `${id} Traveler`, tier: "bronze" };
  if (kind === "district" && districtName(id)) return { key, name: `${districtName(id)} Traveler`, tier: "silver" };
  return null;
}

/** The title's display name, or null. Accepts a key or the server's { key, name }. */
export const titleName = (title) => titleInfo(title)?.name ?? null;

/** "bronze", "silver" or "gold", or null. */
export const titleTier = (title) => titleInfo(title)?.tier ?? null;

/** A tier's colours from the theme: `fill` for rings and plates, `ink` for text on `soft`. */
export function tierColors(colors, tier) {
  if (tier === "iron") return { fill: colors.iron, ink: colors.ironInk, soft: colors.ironSoft };
  if (tier === "bronze") return { fill: colors.bronze, ink: colors.bronzeInk, soft: colors.bronzeSoft };
  if (tier === "silver") return { fill: colors.silver, ink: colors.silverInk, soft: colors.silverSoft };
  return { fill: colors.accent, ink: colors.accentDark, soft: colors.accentSoft };
}

// Iron is a spot's badge, which comes with no title.
export const TIER_LABEL = { iron: "Iron", bronze: "Bronze", silver: "Silver", gold: "Gold" };

/** "2 more municipalities to District 1 Traveler" — from the server's nextTitle { name, townsLeft }. */
export function nextTitleLine(next) {
  if (!next) return "You've earned every title";
  const n = next.townsLeft;
  return `${n} more ${n === 1 ? "municipality" : "municipalities"} to ${next.name}`;
}
