import React from "react";
import { Text } from "react-native";
import { render, act } from "@testing-library/react-native";

// Drives the real ArrivalProvider with a fake location service and checks the
// adaptive GPS rate: the watch is re-created with cheaper settings far from
// every spot and full-rate settings near one — and arrivals still fire.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@clerk/clerk-expo", () => {
  const getToken = async () => "token";
  return {
    useAuth: () => ({ isSignedIn: true, getToken }),
    useUser: () => ({ user: { id: "user_test" } }),
  };
});
jest.mock("expo-task-manager", () => ({ defineTask: jest.fn() }));
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  AndroidImportance: { HIGH: 4, MAX: 5, DEFAULT: 3 },
}));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn() }));

const mockWatches = [];
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted", canAskAgain: true })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getBackgroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: "denied", canAskAgain: true })),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  stopLocationUpdatesAsync: jest.fn(async () => {}),
  startLocationUpdatesAsync: jest.fn(async () => {}),
  watchPositionAsync: jest.fn(async (options, callback) => {
    const w = { options, callback, removed: false };
    w.remove = () => { w.removed = true; };
    mockWatches.push(w);
    return { remove: w.remove };
  }),
}));

const SPOT = { _id: "spot1", name: "Barasoain", coordinates: { lat: 14.8456, lng: 120.8121 } };
const north = (m) => SPOT.coordinates.lat + m / 111_320;

const body = (url) => (String(url).endsWith("/api/spots") ? { success: true, spots: [SPOT] } : { success: true, spotIds: [] });
// `offline` makes every reward call fail the way fetch does with no signal.
let offline = false;
global.fetch = jest.fn(async (url) => {
  if (offline && !String(url).endsWith("/api/spots")) throw new TypeError("Network request failed");
  return {
    ok: true,
    status: 200,
    json: async () => body(url),
    text: async () => JSON.stringify(body(url)),
  };
});

const { ThemeProvider } = require("../context/ThemeContext");
const { ArrivalProvider } = require("../context/ArrivalContext");

const live = () => mockWatches.filter((w) => !w.removed);
const feed = async (meters, accuracy = 8) => {
  const w = live().at(-1);
  await act(async () => {
    w.callback({ coords: { latitude: north(meters), longitude: SPOT.coordinates.lng, accuracy }, timestamp: Date.now() });
  });
  await act(async () => {});
};

const AsyncStorage = require("@react-native-async-storage/async-storage");

beforeEach(async () => {
  mockWatches.length = 0;
  offline = false;
  await AsyncStorage.clear();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); });

const settle = async (n = 6) => { for (let i = 0; i < n; i++) await act(async () => {}); };
const mount = async () => {
  render(
    <ThemeProvider>
      <ArrivalProvider>
        <Text>app</Text>
      </ArrivalProvider>
    </ThemeProvider>,
  );
  await settle();
};

it("adapts GPS effort to the distance from the nearest spot, and still detects arrival", async () => {
  render(
    <ThemeProvider>
      <ArrivalProvider>
        <Text>app</Text>
      </ArrivalProvider>
    </ThemeProvider>,
  );
  for (let i = 0; i < 6; i++) await act(async () => {}); // mount effects, spots fetch

  // Starts in the middle tier until the first fix says how far away we are.
  expect(live()).toHaveLength(1);
  expect(live()[0].options).toMatchObject({ timeInterval: 8000, distanceInterval: 25 });

  // 20 km away -> low-power network fixes, big steps.
  await feed(20_000, 60);
  expect(live()).toHaveLength(1);
  expect(live()[0].options).toMatchObject({ accuracy: 3, timeInterval: 20000, distanceInterval: 150 });

  // 300 m away -> full rate.
  await feed(300);
  expect(live()[0].options).toMatchObject({ accuracy: 4, timeInterval: 3000, distanceInterval: 5 });
  expect(mockWatches.filter((w) => w.removed)).toHaveLength(2); // old watches were stopped

  // Arrival: one precise fix inside the radius logs the visit with the server.
  global.fetch.mockClear();
  await feed(10, 6);
  for (let i = 0; i < 4; i++) await act(async () => {});
  const calls = global.fetch.mock.calls.map(([u]) => String(u));
  expect(calls.some((u) => u.endsWith("/api/spots/spot1/visit"))).toBe(true);
});

it("keeps a visit made with no signal and delivers it once the connection is back", async () => {
  await mount();
  await feed(20_000, 60);                 // establishes the watch; nothing nearby

  // At the spot, but the reward calls can't get out.
  offline = true;
  await feed(10, 6);
  await settle();
  const pendingKey = "pendingRewards_user_test";
  expect(JSON.parse(await AsyncStorage.getItem(pendingKey))).toEqual(["spot1"]);

  // Signal returns; the next location fix after the retry interval replays it.
  offline = false;
  global.fetch.mockClear();
  const realNow = Date.now;
  jest.spyOn(Date, "now").mockImplementation(() => realNow() + 60_000);
  await feed(12, 6);
  await settle(10);

  const paths = global.fetch.mock.calls.map(([u]) => new URL(String(u)).pathname);
  expect(paths).toEqual(expect.arrayContaining([
    "/api/spots/spot1/visit", "/api/users/points", "/api/visitlogs", "/api/users/badges",
  ]));
  expect(JSON.parse(await AsyncStorage.getItem(pendingKey))).toEqual([]);
});

it("a visit that reaches the server is not queued", async () => {
  await mount();
  await feed(20_000, 60);
  await feed(10, 6);
  await settle();
  expect(JSON.parse(await AsyncStorage.getItem("pendingRewards_user_test"))).toEqual([]);
});

describe('"Allow all the time" (background location)', () => {
  const Location = require("expo-location");
  const { showAlert } = require("../components/AppAlert");
  const { Platform } = require("react-native");
  let realOS;

  beforeEach(() => {
    realOS = Platform.OS;
    Platform.OS = "android";
    showAlert.mockClear();
    Location.requestBackgroundPermissionsAsync.mockClear();
  });
  afterEach(() => { Platform.OS = realOS; });

  const disclosure = () =>
    showAlert.mock.calls.find(([title]) => /Background location access needed/.test(title));
  const press = async (label) => {
    await act(async () => { disclosure()[2].find((b) => b.text === label).onPress(); });
    await settle();
  };

  it("explains it in a modal before Android's permission screen opens", async () => {
    await mount();
    expect(disclosure()).toBeTruthy();
    expect(disclosure()[1]).toMatch(/even when the app is closed/);
    expect(disclosure()[1]).toMatch(/Allow all the time/);
    // The modal is up and the system screen has NOT been opened.
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();

    await press("Continue");
    expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('"Not now" never opens the permission screen', async () => {
    await mount();
    await press("Not now");
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
