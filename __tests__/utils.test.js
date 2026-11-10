import { PixelRatio } from "react-native";
import { cdn, spotImage, avatarImage } from "../utils/image";
import { isBetterFix, isBetterMapFix, GpsSmoother } from "../utils/gpsFilter";
import { resolveTrail } from "../utils/arTrail";
import { getSpotCoords } from "../utils/arLocationGate";

jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn() }));

const CLOUD = "https://res.cloudinary.com/demo/image/upload/v17/spots/barasoain.png";

describe("cdn()", () => {
  beforeEach(() => jest.spyOn(PixelRatio, "get").mockReturnValue(3));
  afterEach(() => jest.restoreAllMocks());

  it("leaves non-Cloudinary URLs alone (Google and Clerk avatars)", () => {
    const google = "https://lh3.googleusercontent.com/a/photo.jpg";
    expect(cdn(google, { width: 100 })).toBe(google);
    expect(cdn(null, { width: 100 })).toBeNull();
  });

  it("adds format and quality, caps the pixel ratio at 2, and never upscales", () => {
    expect(cdn(CLOUD, { width: 400 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800,c_limit/v17/spots/barasoain.png",
    );
  });

  it("crops to the box only when both sides are known", () => {
    expect(spotImage(CLOUD, 300, 200)).toContain("w_600,h_400,c_fill,g_auto");
    expect(cdn(CLOUD, { width: 300, crop: "fill" })).toContain("c_limit");
    expect(avatarImage(CLOUD, 48)).toContain("g_face");
  });
});

describe("isBetterFix()", () => {
  const fix = (accuracy, timestamp, lat = 14.85, lng = 120.81) =>
    ({ latitude: lat, longitude: lng, accuracy, timestamp });

  it("takes the first valid fix and rejects garbage", () => {
    expect(isBetterFix(null, fix(20, 0))).toBe(true);
    expect(isBetterFix(null, { latitude: NaN, longitude: 1 })).toBe(false);
  });

  it("prefers a more accurate fix", () => {
    expect(isBetterFix(fix(40, 1000), fix(5, 1500))).toBe(true);
  });

  it("does not let a much vaguer network fix replace a GPS fix", () => {
    expect(isBetterFix(fix(5, 1000), fix(80, 2000))).toBe(false);
  });

  it("takes any fix once the current one is stale", () => {
    expect(isBetterFix(fix(5, 0), fix(80, 20_000))).toBe(true);
  });

  it("ignores fixes that arrive badly out of order", () => {
    expect(isBetterFix(fix(20, 20_000), fix(5, 0))).toBe(false);
  });
});

describe("GpsSmoother", () => {
  it("settles jitter while standing still", () => {
    const s = new GpsSmoother();
    let out;
    for (let i = 0; i < 20; i++) {
      const jitter = (i % 2 ? 1 : -1) * 0.00005; // about 5.5 m either way
      out = s.push({ latitude: 14.85 + jitter, longitude: 120.81, accuracy: 8, timestamp: i * 1000 });
    }
    expect(Math.abs(out.latitude - 14.85)).toBeLessThan(0.00003);
    expect(out.accuracy).toBeLessThan(8);
  });
});

describe("resolveTrail()", () => {
  const anchor = (index, isInRange) => ({ index, label: `M${index}`, distance: 10, radius: 15, isInRange });

  it("follows the trail in order, not by distance", () => {
    // Standing at #2 while #1 is unexplored is not "in range".
    const r = resolveTrail([anchor(2, true), anchor(1, false)], new Set(), false);
    expect(r.next.index).toBe(1);
    expect(r.inRange).toBe(false);
    expect(r.focus).toBeNull();
    expect(r.pending.index).toBe(1);
  });

  it("moves on once an anchor is explored", () => {
    const r = resolveTrail([anchor(1, true), anchor(2, true)], new Set([1]), false);
    expect(r.focus.index).toBe(2);
  });

  it("holds the next model back while a trivia card is open", () => {
    const r = resolveTrail([anchor(1, true)], new Set(), true);
    expect(r.inRange).toBe(true);
    expect(r.focus).toBeNull();
  });

  it("is empty when the trail is finished", () => {
    const r = resolveTrail([anchor(1, true)], new Set([1]), false);
    expect(r).toEqual({ next: null, inRange: false, focus: null, pending: null });
  });
});

describe("getSpotCoords()", () => {
  it("prefers coordinates, then latitude/longitude, then the anchor centroid", () => {
    expect(getSpotCoords({ coordinates: { lat: 1, lng: 2 }, latitude: 9, longitude: 9 })).toEqual({ lat: 1, lng: 2 });
    expect(getSpotCoords({ latitude: 3, longitude: 4 })).toEqual({ lat: 3, lng: 4 });
    expect(getSpotCoords({ modelsCoordinates: [{ lat: 0, lng: 0 }, { lat: 2, lng: 4 }] })).toEqual({ lat: 1, lng: 2 });
    expect(getSpotCoords({ coordinates: { lat: null, lng: null } })).toBeNull();
    expect(getSpotCoords(null)).toBeNull();
  });
});

// Indoors on an upper floor: the navigation map must not get stuck on, or
// jump to, a cell-tower guess a town away.
describe("isBetterMapFix()", () => {
  const fix = (accuracy, timestamp, lat = 14.85, lng = 120.81) =>
    ({ latitude: lat, longitude: lng, accuracy, timestamp });

  test("shows a vague fix when nothing better is known", () => {
    expect(isBetterMapFix(fix(1500, 0), fix(800, 1000))).toBe(true);
    expect(isBetterMapFix(null, fix(1500, 0))).toBe(true);
  });

  test("a good fix replaces a vague one at once", () => {
    expect(isBetterMapFix(fix(1500, 0), fix(12, 1000))).toBe(true);
  });

  test("a vague fix never replaces a fresh good one", () => {
    // ~1.3 km away, ±1500 m: what an upper floor gets from cell towers.
    expect(isBetterMapFix(fix(10, 0), fix(1500, 30_000, 14.862))).toBe(false);
  });

  test("an old good fix gives way only when the vague one rules it out", () => {
    expect(isBetterMapFix(fix(10, 0), fix(1500, 120_000, 14.862))).toBe(false); // still inside its circle
    expect(isBetterMapFix(fix(10, 0), fix(300, 120_000, 14.862))).toBe(true);   // you have moved
  });
});
