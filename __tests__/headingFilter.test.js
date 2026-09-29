import { HeadingFilter, angleDiff, shouldEmit } from "../utils/headingFilter";

// Deterministic noise so the numbers below are reproducible.
function noise(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1; // [-1, 1)
}

const HZ = 30;
const DT = 1000 / HZ;

describe("HeadingFilter", () => {
  it("holds steady at rest: ±5° of sensor noise becomes at most 1.5° of wobble", () => {
    const f = new HeadingFilter();
    const n = noise(7);
    const out = [];
    for (let i = 0; i < HZ * 6; i++) out.push(f.push(120 + n() * 5, i * DT));
    const settled = out.slice(HZ * 2); // after 2 s
    const spread = Math.max(...settled.map((h) => angleDiff(h, 120)));
    expect(spread).toBeLessThan(1.5);
  });

  it("follows a noisy 90°/s turn closely (within 6°)", () => {
    const f = new HeadingFilter();
    const n = noise(3);
    let h = 0;
    let out = 0;
    for (let i = 0; i < HZ * 2; i++) {
      h = (i * DT / 1000) * 90;                 // 0° -> 180° over 2 s
      out = f.push(h + n() * 5, i * DT);
    }
    expect(angleDiff(out, h)).toBeLessThan(6);
  });

  it("is steadier at rest than the old fixed 0.3 average it replaces", () => {
    const n1 = noise(11);
    const n2 = noise(11);
    const f = new HeadingFilter();
    let ema = null;
    const newOut = [];
    const oldOut = [];
    for (let i = 0; i < HZ * 6; i++) {
      const r1 = 200 + n1() * 5;
      newOut.push(f.push(r1, i * DT));
      const r2 = 200 + n2() * 5;
      ema = ema === null ? r2 : ema + (r2 - ema) * 0.3;
      oldOut.push(ema);
    }
    const wobble = (arr) => Math.max(...arr.slice(HZ * 2).map((h) => angleDiff(h, 200)));
    // Measured: ~1.7° against ~2.9° for this noise — about 40 % less wobble.
    expect(wobble(newOut)).toBeLessThan(wobble(oldOut) * 0.7);
  });

  it("settles on a new direction within half a second after the turn stops", () => {
    const f = new HeadingFilter();
    for (let i = 0; i < HZ; i++) f.push(10, i * DT);
    let out;
    for (let i = HZ; i < HZ + HZ / 2; i++) out = f.push(100, i * DT);
    expect(angleDiff(out, 100)).toBeLessThan(3);
  });

  it("takes the short way across north (350° -> 10° is a 20° turn, not 340°)", () => {
    const f = new HeadingFilter();
    for (let i = 0; i < HZ; i++) f.push(350, i * DT);
    const seen = [];
    for (let i = HZ; i < HZ * 2; i++) seen.push(f.push(10, i * DT));
    // Every intermediate value stays in the 20° sector around north.
    expect(seen.every((v) => v >= 349 || v <= 11)).toBe(true);
    expect(angleDiff(seen.at(-1), 10)).toBeLessThan(2);
  });

  it("behaves the same at 10 Hz and 60 Hz sensor rates (time-based, not per reading)", () => {
    const run = (hz) => {
      const f = new HeadingFilter();
      let out;
      for (let i = 0; i <= hz; i++) out = f.push(i === 0 ? 0 : 60, (i * 1000) / hz);
      return out;
    };
    expect(Math.abs(run(10) - run(60))).toBeLessThan(4);
  });

  it("ignores invalid readings", () => {
    const f = new HeadingFilter();
    f.push(45, 0);
    expect(f.push(NaN, 10)).toBe(45);
  });
});

describe("shouldEmit", () => {
  it("drops sub-degree changes and updates faster than 30 fps", () => {
    expect(shouldEmit(null, 10, 0, 0)).toBe(true);
    expect(shouldEmit(10, 10.5, 0, 100)).toBe(false);
    expect(shouldEmit(10, 12, 0, 10)).toBe(false);
    expect(shouldEmit(10, 12, 0, 100)).toBe(true);
    expect(shouldEmit(359.5, 0.8, 0, 100)).toBe(true); // 1.3° across north
  });
});
