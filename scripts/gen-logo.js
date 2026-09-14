/* Regenerates the Libot logo PNGs from a single source of truth.
 *
 * This is a LOCAL dev tool only — it is NOT a project dependency (keeping it
 * out of package.json avoids EAS build dependency issues). To run it:
 *
 *   npm i -D @resvg/resvg-js      # temporary, don't commit it
 *   node scripts/gen-logo.js
 *   npm rm @resvg/resvg-js
 *
 * Produces:
 *   assets/icon.png           1024  full-bleed yellow square + star   (app.json `icon`)
 *   assets/adaptive-icon.png  1024  star only, transparent            (Android adaptive foreground)
 *   assets/splash-icon.png     512  rounded square + star, transparent (splash, contain on cyan)
 *   assets/logo.png           1024  = icon.png (back-compat for any require())
 *
 * The mark: yellow rounded square, white 8-point compass star, cyan North ray.
 */
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const YELLOW = "#F3DA3C";
const WHITE = "#FFFFFF";
const CYAN = "#4FC3D6";

const ASSETS = path.join(__dirname, "..", "assets");

function starPts(c, L, w) {
  return [
    [c, c - L], [c + w, c - w], [c + L, c], [c + w, c + w],
    [c, c + L], [c - w, c + w], [c - L, c], [c - w, c - w],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

// star centred at c, primary ray length L / half-waist w, diagonal ray dL / dw
function starMarkup(c, L, w, dL, dw) {
  return `
    <g transform="rotate(45 ${c} ${c})"><polygon points="${starPts(c, dL, dw)}" fill="${WHITE}"/></g>
    <polygon points="${starPts(c, L, w)}" fill="${WHITE}"/>
    <polygon points="${c},${c - L} ${c + w},${c - w} ${c},${c} ${c - w},${c - w}" fill="${CYAN}"/>`;
}

const variants = [
  {
    file: "icon.png",
    size: 1024,
    svg: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${s}" height="${s}" fill="${YELLOW}"/>
      ${starMarkup(s / 2, s * 0.42, s * 0.078, s * 0.3, s * 0.06)}
    </svg>`,
  },
  {
    file: "adaptive-icon.png",
    size: 1024,
    // star only — kept inside Android's ~66% safe zone
    svg: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
      ${starMarkup(s / 2, s * 0.29, s * 0.053, s * 0.205, s * 0.041)}
    </svg>`,
  },
  {
    file: "splash-icon.png",
    size: 512,
    svg: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${s}" height="${s}" rx="${s * 0.23}" ry="${s * 0.23}" fill="${YELLOW}"/>
      ${starMarkup(s / 2, s * 0.42, s * 0.078, s * 0.3, s * 0.06)}
    </svg>`,
  },
];

for (const v of variants) {
  const svg = v.svg(v.size).trim();
  const png = new Resvg(svg, { fitTo: { mode: "width", value: v.size } }).render().asPng();
  fs.writeFileSync(path.join(ASSETS, v.file), png);
  console.log(`wrote assets/${v.file} (${v.size}px, ${(png.length / 1024).toFixed(1)} KB)`);
}

// back-compat: logo.png mirrors the app icon
fs.copyFileSync(path.join(ASSETS, "icon.png"), path.join(ASSETS, "logo.png"));
console.log("wrote assets/logo.png (= icon.png)");
