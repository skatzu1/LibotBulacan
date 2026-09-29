import { renderHook, act } from "@testing-library/react-native";
import useCompassHeading from "../hooks/useCompassHeading";
import { createValueStore, isGeoHeadingUsable, GEO_HEADING_STALE_MS, GEO_HEADING_MAX_ACCURACY_DEG } from "../utils/headingSource";

// A fake compass: the test pushes readings into the callback the hook
// registers with expo-location.
let mockCompass = null;
jest.mock("expo-location", () => ({
  watchHeadingAsync: jest.fn(async (cb) => {
    mockCompass = cb;
    return { remove: jest.fn() };
  }),
}));

const T0 = 1_800_000_000_000;
let now = T0;

beforeEach(() => {
  now = T0;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  mockCompass = null;
});
afterEach(() => jest.restoreAllMocks());

const step = (ms) => { now += ms; };
// Feed the same compass reading for `seconds` at 20 Hz so the filter settles.
const compassFor = (seconds, heading, accuracy = 3) => {
  for (let i = 0; i < seconds * 20; i++) {
    step(50);
    act(() => mockCompass({ trueHeading: heading, magHeading: heading, accuracy }));
  }
};
const geoFor = (store, seconds, heading, accuracy = 4) => {
  for (let i = 0; i < seconds * 4; i++) {
    step(250);
    act(() => store.set({ heading, accuracy, at: now }));
  }
};

const mount = async (store) => {
  const hook = renderHook(() => useCompassHeading(store));
  await act(async () => {}); // let watchHeadingAsync resolve
  return hook;
};

describe("headingSource", () => {
  it("uses ARCore only when it's accurate and fresh", () => {
    expect(isGeoHeadingUsable({ heading: 10, accuracy: 5, at: T0 }, T0)).toBe(true);
    expect(isGeoHeadingUsable({ heading: 10, accuracy: GEO_HEADING_MAX_ACCURACY_DEG + 1, at: T0 }, T0)).toBe(false);
    expect(isGeoHeadingUsable({ heading: 10, accuracy: 5, at: T0 }, T0 + GEO_HEADING_STALE_MS + 1)).toBe(false);
    expect(isGeoHeadingUsable(null, T0)).toBe(false);
  });

  it("store notifies subscribers until they unsubscribe", () => {
    const s = createValueStore(null);
    const seen = [];
    const off = s.subscribe((v) => seen.push(v));
    s.set(1);
    off();
    s.set(2);
    expect(seen).toEqual([1]);
    expect(s.get()).toBe(2);
  });
});

describe("useCompassHeading", () => {
  it("follows the compass when ARCore has nothing", async () => {
    const { result } = await mount(createValueStore(null));
    compassFor(2, 90);
    expect(Math.round(result.current.heading)).toBeGreaterThanOrEqual(89);
    expect(result.current.precise).toBe(false);
  });

  it("switches to ARCore's heading and ignores the compass while it's fresh", async () => {
    const store = createValueStore(null);
    const { result } = await mount(store);
    compassFor(2, 90);

    // ARCore says the camera faces 120°; the (magnetically disturbed) compass keeps saying 90°.
    for (let i = 0; i < 12; i++) {
      geoFor(store, 0.25, 120);
      compassFor(0.2, 90);
    }
    expect(result.current.precise).toBe(true);
    expect(Math.abs(result.current.heading - 120)).toBeLessThan(3);
  });

  it("hides the calibration prompt while ARCore is steering", async () => {
    const store = createValueStore(null);
    const { result } = await mount(store);
    compassFor(0.5, 90, 30); // iOS accuracy 30° -> needs calibration
    expect(result.current.needsCalibration).toBe(true);
    geoFor(store, 1, 100);
    compassFor(0.2, 90, 30);
    expect(result.current.needsCalibration).toBe(false);
  });

  it("falls back to the compass once ARCore goes quiet", async () => {
    const store = createValueStore(null);
    const { result } = await mount(store);
    geoFor(store, 1, 200);
    expect(result.current.precise).toBe(true);

    step(GEO_HEADING_STALE_MS + 100); // tracking lost: no more readings
    compassFor(3, 250);
    expect(result.current.precise).toBe(false);
    expect(Math.abs(result.current.heading - 250)).toBeLessThan(3);
  });

  it("ignores ARCore readings that aren't accurate enough", async () => {
    const store = createValueStore(null);
    const { result } = await mount(store);
    compassFor(2, 60);
    geoFor(store, 1, 180, 40); // ±40° — worse than the limit
    compassFor(0.5, 60);
    expect(result.current.precise).toBe(false);
    expect(Math.abs(result.current.heading - 60)).toBeLessThan(3);
  });
});
