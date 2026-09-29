import {
  createArrivalState, evaluateFix, watchTierFor, distanceMeters,
  ENTER_M, EXIT_M, WATCH_TIERS,
} from "../utils/arrivalEngine";

// Barasoain Church, and points a given distance due north of it.
const SPOT = { id: "barasoain", lat: 14.8456, lng: 120.8121 };
const north = (m) => SPOT.lat + m / 111_320;
const fix = (m, accuracy = 8) => ({ latitude: north(m), longitude: SPOT.lng, accuracy });
const feed = (state, ...fixes) => fixes.map((f) => evaluateFix(state, f, [SPOT]));

describe("distanceMeters", () => {
  it("is accurate at this latitude", () => {
    expect(distanceMeters(SPOT.lat, SPOT.lng, north(100), SPOT.lng)).toBeCloseTo(100, 0);
  });
});

describe("arriving", () => {
  it("one precise fix inside the radius is an arrival", () => {
    const s = createArrivalState();
    const [r] = feed(s, fix(30, 10));
    expect(r.entered).toEqual(["barasoain"]);
  });

  it("an ordinary fix needs a second one in a row (a single multipath jump is not a visit)", () => {
    const s = createArrivalState();
    const [first, second] = feed(s, fix(40, 35), fix(38, 35));
    expect(first.entered).toEqual([]);
    expect(second.entered).toEqual(["barasoain"]);
  });

  it("a stray inside fix followed by an outside one does not count", () => {
    const s = createArrivalState();
    const results = feed(s, fix(40, 35), fix(300, 10), fix(45, 35));
    expect(results.flatMap((r) => r.entered)).toEqual([]);
  });

  it("ignores fixes too vague to judge, however close they claim to be", () => {
    const s = createArrivalState();
    const results = feed(s, fix(5, 150), fix(5, 150), fix(5, 150));
    expect(results.flatMap((r) => r.entered)).toEqual([]);
  });

  it("arrives only once while you stay", () => {
    const s = createArrivalState();
    const results = feed(s, fix(10), fix(20), fix(15), fix(30));
    expect(results.flatMap((r) => r.entered)).toEqual(["barasoain"]);
  });
});

describe("leaving (hysteresis)", () => {
  it("wandering around the 50 m line does not leave and re-arrive", () => {
    const s = createArrivalState();
    // Jitter between 45 and 70 m — the old rule flip-flopped on every crossing of 50 m.
    const results = feed(s, fix(45), fix(55), fix(48), fix(70), fix(46), fix(65));
    expect(results.flatMap((r) => r.entered)).toEqual(["barasoain"]);
    expect(results.flatMap((r) => r.left)).toEqual([]);
  });

  it(`leaves beyond ${EXIT_M} m, and can then arrive again`, () => {
    const s = createArrivalState(["barasoain"]);
    const [gone] = feed(s, fix(EXIT_M + 20));
    expect(gone.left).toEqual(["barasoain"]);
    const [back] = feed(s, fix(ENTER_M - 20, 10));
    expect(back.entered).toEqual(["barasoain"]);
  });

  it("a vague fix far away does not evict you", () => {
    const s = createArrivalState(["barasoain"]);
    const [r] = feed(s, fix(400, 250));
    expect(r.left).toEqual([]);
  });
});

describe("watchTierFor (adaptive GPS rate)", () => {
  it("works hard only near a spot", () => {
    expect(watchTierFor(100).key).toBe("near");
    expect(watchTierFor(1500).key).toBe("approach");
    expect(watchTierFor(20000).key).toBe("far");
    expect(WATCH_TIERS.far.accuracy).toBe("balanced");
  });

  it("switches to a nearer tier immediately", () => {
    expect(watchTierFor(350, "far").key).toBe("near");
  });

  it("needs 20 % past the boundary to switch back out (no restart loop at the edge)", () => {
    expect(watchTierFor(450, "near").key).toBe("near");      // 400 m boundary, 480 m to leave
    expect(watchTierFor(500, "near").key).toBe("approach");
  });

  it("cannot skip past a spot: each tier's distance step is smaller than the gap to the next tier", () => {
    // From the far tier's boundary, the next fix arrives before you can be
    // inside the approach tier's boundary by more than one step.
    expect(WATCH_TIERS.far.distanceInterval).toBeLessThan(WATCH_TIERS.approach.maxM - WATCH_TIERS.near.maxM);
    expect(WATCH_TIERS.approach.distanceInterval).toBeLessThan(WATCH_TIERS.near.maxM - ENTER_M);
    expect(WATCH_TIERS.near.distanceInterval).toBeLessThan(ENTER_M);
  });

  it("keeps the current tier when there is no distance yet", () => {
    expect(watchTierFor(null, "near").key).toBe("near");
  });
});
