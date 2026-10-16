import {
  strongPasswordError, passwordLevel, middleNameError, dobError, dobToIso, dobToDate, formatDob,
} from "../utils/authValidation";
import { spotProgress } from "../utils/missionTiers";
import { ensureAtSpotForAR } from "../utils/arLocationGate";
import { showAlert } from "../components/AppAlert";

// The app side of the certified QA's list (2026-10-16).

let mockPosition = null;
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: mockPosition })),
}));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe("new passwords follow sign-up's rules everywhere", () => {
  it("needs 8 characters and 3 of the 4 rules", () => {
    expect(strongPasswordError("")).toBe("Enter a password.");
    expect(strongPasswordError("", "Enter a new password.")).toBe("Enter a new password.");
    expect(strongPasswordError("Ab1!")).toMatch(/at least 8/);
    expect(strongPasswordError("abcdefgh")).toMatch(/Too weak/);   // length only
    expect(strongPasswordError("abcdefg1")).toMatch(/Too weak/);   // length + number
    expect(strongPasswordError("Abcdefg1")).toBeNull();            // 3 rules: Good
    expect(strongPasswordError("Abcdef1!")).toBeNull();            // 4 rules: Strong
  });

  it("levels match the meter: Weak, Fair, Good, Strong", () => {
    expect(passwordLevel("abc")).toBe(0);
    expect(passwordLevel("abcdefgh")).toBe(0);
    expect(passwordLevel("abcdefg1")).toBe(1);
    expect(passwordLevel("Abcdefg1")).toBe(2);
    expect(passwordLevel("Abcdef1!")).toBe(3);
  });
});

describe("registration: separate names and a date of birth", () => {
  it("the middle name is optional and may be an initial", () => {
    expect(middleNameError("")).toBeNull();
    expect(middleNameError("D.")).toBeNull();
    expect(middleNameError("Dela Cruz")).toBeNull();
    expect(middleNameError("R2")).toMatch(/letters only/);
    expect(middleNameError(".D")).toBe("Start with a letter.");
  });

  it("the calendar's date and the typed date are the same text, sent as YYYY-MM-DD", () => {
    const picked = new Date(2004, 1, 29);
    expect(formatDob(picked)).toBe("02/29/2004");
    expect(dobToIso("02/29/2004")).toBe("2004-02-29");
    expect(dobToIso("02/2")).toBe("");
    expect(dobToDate("02/29/2004").getTime()).toBe(picked.getTime());
    expect(dobToDate("02/2")).toBeNull();
  });

  it("refuses under 13 and impossible ages", () => {
    const today = new Date(2026, 9, 16);
    expect(dobError("10/17/2013", today)).toMatch(/at least 13/);
    expect(dobError("10/16/2013", today)).toBeNull();
    expect(dobError("01/01/1901", today)).toBe("Check the year."); // 125
  });
});

describe("Bakit List progress", () => {
  const missions = [{ _id: "m1" }, { _id: "m2" }, { _id: "m3" }];
  it("counts arriving as the first item, then each completed activity", () => {
    expect(spotProgress(missions, [], false)).toEqual({ done: 0, total: 4 });
    expect(spotProgress(missions, ["m2"], true)).toEqual({ done: 2, total: 4 });
    expect(spotProgress(missions, ["m1", "m2", "m3", "other"], true)).toEqual({ done: 4, total: 4 });
    expect(spotProgress([], [], true)).toEqual({ done: 1, total: 1 });
  });
});

describe("AR away from the spot", () => {
  const SPOT = { name: "Barasoain Church", coordinates: { lat: 14.8456, lng: 120.8121 } };
  const north = (m) => ({ latitude: SPOT.coordinates.lat + m / 111_320, longitude: SPOT.coordinates.lng, accuracy: 8 });

  it("doesn't open: only Cancel and Get directions, no Start anyway", async () => {
    mockPosition = north(2000);
    const onDirections = jest.fn();
    await expect(ensureAtSpotForAR(SPOT, { onDirections })).resolves.toBe(false);
    const buttons = showAlert.mock.calls[0][2];
    expect(buttons.map((b) => b.text)).toEqual(["Cancel", "Get directions"]);
    buttons[1].onPress();
    expect(onDirections).toHaveBeenCalled();
  });

  it("opens straight away at the spot", async () => {
    mockPosition = north(30);
    await expect(ensureAtSpotForAR(SPOT)).resolves.toBe(true);
    expect(showAlert).not.toHaveBeenCalled();
  });
});
