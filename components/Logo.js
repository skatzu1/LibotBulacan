import React from "react";
import Svg, { Rect, Polygon } from "react-native-svg";

// The Libot mark: a yellow rounded square holding an 8-point compass star.
// The star is white except the North (top) ray, which is cyan.
// Colours are brand-fixed (they do NOT flip with dark mode) so the logo stays
// recognisable everywhere.

const YELLOW = "#F3DA3C";
const CYAN   = "#4FC3D6";
const WHITE  = "#FFFFFF";

function starPoints(c, L, w) {
  return [
    [c, c - L], [c + w, c - w], [c + L, c], [c + w, c + w],
    [c, c + L], [c - w, c + w], [c - L, c], [c - w, c - w],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

export default function Logo({ size = 72, showSquare = true, style }) {
  const c = size / 2;
  const primaryL = size * 0.46;
  const primaryW = size * 0.085;
  const diagonal = starPoints(c, size * 0.32, size * 0.065);
  const primary  = starPoints(c, primaryL, primaryW);
  const sq  = size * 0.92;
  const off = (size - sq) / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={style}>
      {showSquare && (
        <Rect
          x={off}
          y={off}
          width={sq}
          height={sq}
          rx={size * 0.24}
          ry={size * 0.24}
          fill={YELLOW}
        />
      )}
      {/* diagonal (shorter) rays */}
      <Polygon points={diagonal} fill={WHITE} rotation={45} origin={`${c}, ${c}`} />
      {/* primary N/E/S/W rays */}
      <Polygon points={primary} fill={WHITE} />
      {/* North (top) ray in cyan — a kite from the top tip down to the centre,
          so it reads as a pointed banner with a V-notched base. */}
      <Polygon
        points={`${c},${c - primaryL} ${c + primaryW},${c - primaryW} ${c},${c} ${c - primaryW},${c - primaryW}`}
        fill={CYAN}
      />
    </Svg>
  );
}
