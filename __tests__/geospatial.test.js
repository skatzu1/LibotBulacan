import {
  isEarthTracking, evaluateGeospatial, ensureGeospatialEnabled, readGeoHeading, GEO_ACCURACY_LIMIT_M,
} from "../utils/geospatial";

// A stand-in for Viro's sceneNavigator. Viro reports Earth tracking as
// "Enabled" | "Paused" | "Stopped" (enum ARScene.EarthTrackingState
// { ENABLED, PAUSED, STOPPED }), so that is what this fake returns.
function fakeNav({ supported = true, state = "Enabled", pose = { heading: 42, headingAccuracy: 4, horizontalAccuracy: 1.5 }, poseOk = true } = {}) {
  return {
    isGeospatialModeSupported: jest.fn(async () => ({ supported })),
    setGeospatialModeEnabled: jest.fn(),
    checkVPSAvailability: jest.fn(async () => ({ availability: "Available" })),
    getEarthTrackingState: jest.fn(async () => ({ state })),
    getCameraGeospatialPose: jest.fn(async () => (poseOk ? { success: true, pose } : { success: false, error: "no pose" })),
  };
}

jest.spyOn(console, "log").mockImplementation(() => {});

describe("isEarthTracking", () => {
  it("accepts Viro's 'Enabled' — the state it actually reports while tracking", () => {
    expect(isEarthTracking("Enabled")).toBe(true);
  });
  it("rejects paused and stopped", () => {
    expect(isEarthTracking("Paused")).toBe(false);
    expect(isEarthTracking("Stopped")).toBe(false);
    expect(isEarthTracking(undefined)).toBe(false);
  });
});

describe("evaluateGeospatial", () => {
  it("is usable when Earth is tracking with a VPS-grade pose (the old check always said not tracking)", async () => {
    const v = await evaluateGeospatial(fakeNav(), 14.84, 120.81);
    expect(v).toEqual({ usable: true, reason: "ok", accuracy: 1.5 });
  });

  it("still refuses a GNSS-grade pose", async () => {
    const v = await evaluateGeospatial(fakeNav({ pose: { horizontalAccuracy: GEO_ACCURACY_LIMIT_M + 5 } }), 0, 0);
    expect(v.reason).toBe("low-accuracy");
  });

  it("switches geospatial mode on once per navigator, not on every retry", async () => {
    const nav = fakeNav({ state: "Paused" });
    for (let i = 0; i < 3; i++) await evaluateGeospatial(nav, 0, 0);
    expect(nav.setGeospatialModeEnabled).toHaveBeenCalledTimes(1);
  });
});

describe("ensureGeospatialEnabled", () => {
  it("does nothing on an unsupported device", async () => {
    const nav = fakeNav({ supported: false });
    expect(await ensureGeospatialEnabled(nav)).toBe(false);
    expect(nav.setGeospatialModeEnabled).not.toHaveBeenCalled();
  });
  it("enables once and reports it on later calls", async () => {
    const nav = fakeNav();
    expect(await ensureGeospatialEnabled(nav)).toBe(true);
    expect(await ensureGeospatialEnabled(nav)).toBe(true);
    expect(nav.setGeospatialModeEnabled).toHaveBeenCalledTimes(1);
  });
});

describe("readGeoHeading", () => {
  it("returns ARCore's camera heading and its accuracy while tracking", async () => {
    const r = await readGeoHeading(fakeNav());
    expect(r).toMatchObject({ heading: 42, accuracy: 4 });
    expect(typeof r.at).toBe("number");
  });
  it("normalises the heading into 0–360", async () => {
    const r = await readGeoHeading(fakeNav({ pose: { heading: -10, headingAccuracy: 3 } }));
    expect(r.heading).toBe(350);
  });
  it("is null when Earth isn't tracking or there is no pose", async () => {
    expect(await readGeoHeading(fakeNav({ state: "Paused" }))).toBeNull();
    expect(await readGeoHeading(fakeNav({ poseOk: false }))).toBeNull();
    expect(await readGeoHeading(null)).toBeNull();
  });
});
