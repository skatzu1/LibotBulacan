import { BULACAN_MUNICIPALITIES } from "./municipalities";

/*
 * The seal drawn for a town badge without an uploaded image
 * (components/TownEmblem.js). Each of the 24 towns has its own ink: hues step
 * 105° through the municipality list, which visits all 24 before repeating and
 * keeps neighbours apart; the lightness keeps white lettering above 7:1. The
 * admin panel's Town Badges page draws the same seal (libot-admin-1
 * utils/townSeal.js) — keep the two alike.
 */
export function sealInk(town = "") {
  let i = BULACAN_MUNICIPALITIES.indexOf(town);
  if (i < 0) { for (const ch of town) i = (i * 31 + ch.charCodeAt(0)) >>> 0; }
  return `hsl(${(i * 105) % 360}, 45%, 30%)`;
}

/** An eight-point star, the Libot logo's: long rays on the compass points. */
export function starPath(cx, cy, long, short, waist) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI / 8) * i - Math.PI / 2;
    const r = i % 4 === 0 ? long : i % 2 === 0 ? short : waist;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}
