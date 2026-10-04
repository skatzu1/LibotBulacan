import { renderHook, act } from "@testing-library/react-native";
import useCompassHeading from "../hooks/useCompassHeading";

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

const mount = async () => {
  const hook = renderHook(() => useCompassHeading());
  await act(async () => {}); // let watchHeadingAsync resolve
  return hook;
};

describe("useCompassHeading", () => {
  it("follows the compass", async () => {
    const { result } = await mount();
    compassFor(2, 90);
    expect(Math.abs(result.current.heading - 90)).toBeLessThan(1.5);
  });

  it("follows a turn", async () => {
    const { result } = await mount();
    compassFor(2, 90);
    compassFor(2, 180);
    expect(Math.abs(result.current.heading - 180)).toBeLessThan(1.5);
  });

  it("asks for a figure 8 while the OS says the compass is unreliable", async () => {
    const { result } = await mount();
    compassFor(0.5, 90, 30); // iOS accuracy 30° -> needs calibration
    expect(result.current.needsCalibration).toBe(true);
    compassFor(0.5, 90, 5);
    expect(result.current.needsCalibration).toBe(false);
  });
});
