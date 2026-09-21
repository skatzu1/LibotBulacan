import { PixelRatio } from "react-native";

/*
 * Cloudinary delivery-side image sizing.
 *
 * WHY THIS EXISTS
 * ---------------
 * A helper like this already lived inside Screens/Lists.js and was used in
 * exactly ONE place. Every other screen — the Home hero carousel, the
 * most-visited grid, every SpotCard, the Information hero, Previous Trips, the
 * badge grid, every avatar — requested the raw Cloudinary original.
 *
 * Measured over all 24 spots in the live database:
 *     raw originals                       3651 KB
 *     f_auto,q_auto,c_limit,w_800          831 KB   (-77%)
 *
 * Most of that is format: several spots are stored as PNG, which is the wrong
 * container for a photograph (one 314x210 PNG is 149 KB; the same image as
 * WebP is ~20 KB). `f_auto` fixes that without re-uploading anything.
 *
 * THE c_limit RULE — do not drop it
 * ---------------------------------
 * `w_800` on its own UPSCALES a source smaller than 800px, which costs
 * bandwidth AND produces a blurry result. The spot images in this database are
 * mostly 200–620px wide, so a plain `w_` transform made several of them LARGER
 * than the original. `c_limit` only ever scales down, never up.
 */

// Cap the device pixel ratio we honour. A 3x phone asking for a 400pt-wide hero
// would otherwise request 1200px — larger than any source here, and pointless
// once c_limit clamps it anyway.
const MAX_DPR = 2;

const isCloudinary = (url) =>
  typeof url === "string" && url.includes("res.cloudinary.com") && url.includes("/upload/");

/**
 * Build a Cloudinary derivative.
 *
 * @param url     any image URL — non-Cloudinary URLs (Clerk avatars, Google
 *                profile photos) pass through untouched, so this is safe to
 *                wrap around every <Image> in the app.
 * @param width   target width in LOGICAL points (not device pixels)
 * @param height  optional target height in logical points
 * @param crop    'limit' (default, never upscales) | 'fill' (crops to exact box)
 * @param gravity subject focus when cropping — 'auto' uses Cloudinary's
 *                content-aware detection
 */
export function cdn(url, { width, height, crop = "limit", gravity } = {}) {
  if (!isCloudinary(url)) return url;

  const dpr = Math.min(PixelRatio.get(), MAX_DPR);
  const t = ["f_auto", "q_auto"];

  if (width)  t.push(`w_${Math.round(width * dpr)}`);
  if (height) t.push(`h_${Math.round(height * dpr)}`);

  if (width || height) {
    // c_fill needs both dimensions to mean anything; fall back to limit.
    t.push(crop === "fill" && width && height ? "c_fill" : "c_limit");
    if (gravity) t.push(`g_${gravity}`);
  }

  return url.replace("/upload/", `/upload/${t.join(",")}/`);
}

/** Full-bleed photo in a card or hero. Crops to the box so the art direction
 *  is predictable, with content-aware gravity so subjects aren't beheaded. */
export const spotImage = (url, width, height) =>
  cdn(url, { width, height, crop: "fill", gravity: "auto" });

/** Square avatar. Face gravity keeps the person centred when cropping. */
export const avatarImage = (url, size) =>
  cdn(url, { width: size, height: size, crop: "fill", gravity: "face" });

/** Badge art and other transparent PNGs — sized but never cropped, and left as
 *  PNG when it has an alpha channel (f_auto handles that itself). */
export const badgeImage = (url, size) => cdn(url, { width: size });
