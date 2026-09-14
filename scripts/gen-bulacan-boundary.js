/* eslint-disable no-console */
// Regenerates utils/bulacanBoundary.js from OpenStreetMap.
//
//   node scripts/gen-bulacan-boundary.js
//
// Pulls the Bulacan province boundary (OSM relation 1504656, admin_level 4),
// simplifies it with Douglas–Peucker (~150 m), and writes a static module the
// Track map uses for its "focus mask" — so the cut is always the real
// provincial shape and never depends on a live Overpass/Nominatim call.

const fs = require("fs");
const path = require("path");

const OSM_RELATION = 1504656;
const TOLERANCE_DEG = 0.0015; // ~150 m
const OUT = path.join(__dirname, "..", "utils", "bulacanBoundary.js");

function perp(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  const L = dx * dx + dy * dy;
  if (L === 0) return Math.hypot(x - x1, y - y1);
  let t = ((x - x1) * dx + (y - y1) * dy) / L;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function douglasPeucker(pts, eps) {
  if (pts.length < 3) return pts;
  let dmax = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perp(pts[i], pts[0], pts[pts.length - 1]);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) {
    const l = douglasPeucker(pts.slice(0, idx + 1), eps);
    const r = douglasPeucker(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [pts[0], pts[pts.length - 1]];
}

(async () => {
  const url =
    `https://nominatim.openstreetmap.org/details?osmtype=R&osmid=${OSM_RELATION}` +
    `&format=json&polygon_geojson=1&addressdetails=0&linkedplaces=0&hierarchy=0`;
  const res = await fetch(url, { headers: { "User-Agent": "libot-bulacan-dev" } });
  const data = await res.json();

  if (data?.localname !== "Bulacan" || String(data?.admin_level) !== "4") {
    throw new Error(`Unexpected relation: ${data?.localname} (admin_level ${data?.admin_level})`);
  }

  const geom = data.geometry;
  // Largest ring across Polygon / MultiPolygon.
  const rings =
    geom.type === "Polygon"
      ? geom.coordinates
      : geom.coordinates.map((poly) => poly[0]);
  const ring = rings.sort((a, b) => b.length - a.length)[0];

  let simplified = douglasPeucker(ring, TOLERANCE_DEG)
    .map(([lng, lat]) => [+lat.toFixed(5), +lng.toFixed(5)]);

  const first = simplified[0], last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push([first[0], first[1]]);

  const lats = simplified.map((p) => p[0]);
  const lngs = simplified.map((p) => p[1]);
  const bbox = {
    south: (Math.min(...lats) - 0.03).toFixed(4),
    west: (Math.min(...lngs) - 0.03).toFixed(4),
    north: (Math.max(...lats) + 0.03).toFixed(4),
    east: (Math.max(...lngs) + 0.03).toFixed(4),
  };

  const out = `// Bulacan province boundary — static, so the map "focus mask" is always the
// real provincial shape and never falls back to a rectangle.
//
// Source: OpenStreetMap relation ${OSM_RELATION} (© OpenStreetMap contributors, ODbL),
// simplified with Douglas–Peucker (~150 m tolerance) to ${simplified.length} points.
// Regenerate with scripts/gen-bulacan-boundary.js.
//
// Format: [latitude, longitude] pairs, ring closed (first === last).
export const BULACAN_BOUNDARY = ${JSON.stringify(simplified)};

// Bounding box of the province (with a small margin), for the map's maxBounds.
export const BULACAN_BBOX = {
  south: ${bbox.south},
  west:  ${bbox.west},
  north: ${bbox.north},
  east:  ${bbox.east},
};
`;

  fs.writeFileSync(OUT, out);
  console.log(`Wrote ${OUT} — ${simplified.length} points, bbox ${JSON.stringify(bbox)}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
