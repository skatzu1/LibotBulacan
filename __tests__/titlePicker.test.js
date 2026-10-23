import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../context/ThemeContext";
import { showAlert } from "../components/AppAlert";
import BadgeScreen from "../Screens/BadgeScreen";

// Achievements → Titles (2026-10-24): the titles a traveler has earned are a
// pick-one list; the one picked shows on their profile and the leaderboard
// (PUT /api/users/me/title).

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../api", () => ({ __esModule: true, BASE_URL: "https://api.test", default: {} }));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));
const mockNavigation = { addListener: () => () => {}, navigate: jest.fn(), goBack: jest.fn() };
const mockRoute = { params: { tab: "titles" } };
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../context/ArrivalContext", () => ({ useArrival: () => ({ allSpots: [] }) }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn(async () => ({})) } }));

// Voyager is the highest; nothing picked yet, so it is the one on show.
const NAMES = { explorer: "Explorer", voyager: "Voyager" };
let shown = "voyager";
const achievements = {
  title: { key: "voyager", name: "Voyager", earnedAt: "2026-10-20T02:00:00.000Z" },
  nextTitle: { key: "goat", name: "GOAT Traveler", townsLeft: 4 },
  titles: [
    { key: "explorer", name: "Explorer", towns: 1, all: false, earned: true },
    { key: "voyager", name: "Voyager", towns: 3, all: false, earned: true },
    { key: "goat", name: "GOAT Traveler", towns: 7, all: true, earned: false },
  ],
  spots: [],
  towns: [],
  unlocked: { spotBadges: [], townBadges: [], title: null },
};

const reply = (body, ok = true) => Promise.resolve({ ok, json: async () => body });
// The server keeps the pick, unless the test has it say no.
let refuse = false;
global.fetch = jest.fn((url, init) => {
  const u = String(url);
  if (u.endsWith("/api/achievements/me")) {
    return reply({ success: true, ...achievements, shownTitle: { key: shown, name: NAMES[shown] } });
  }
  if (u.endsWith("/api/users/me/title") && init?.method === "PUT") {
    if (refuse) return reply({ success: false }, false);
    shown = JSON.parse(init.body).key;
    return reply({ success: true, title: { key: shown, name: NAMES[shown] } });
  }
  return reply({});
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

beforeEach(() => {
  jest.clearAllMocks();
  shown = "voyager";
  refuse = false;
  return AsyncStorage.clear();
});

const openTitles = async () => {
  const page = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <BadgeScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await page.findByRole("radio", { name: "Explorer, earned" });
  return page;
};
const radio = (page, name) => page.getByRole("radio", { name: `${name}, earned` });
const titleCalls = () => global.fetch.mock.calls.filter(([u, init]) => String(u).endsWith("/api/users/me/title") && init?.method === "PUT");

describe("Picking the title to show", () => {
  it("lists the earned titles to pick from, the shown one checked, a locked one not pickable", async () => {
    const page = await openTitles();
    expect(radio(page, "Voyager").props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    expect(radio(page, "Explorer").props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
    expect(page.queryByRole("radio", { name: /GOAT Traveler/ })).toBeNull();
    expect(page.getByText("On your profile and the leaderboard")).toBeTruthy();
    // Two earned: the summary says which one others see.
    expect(page.getByRole("button", { name: "Voyager shows on your profile and the leaderboard" })).toBeTruthy();
  });

  it("tapping another earned title shows it and saves the pick", async () => {
    const page = await openTitles();
    fireEvent.press(radio(page, "Explorer"));
    await waitFor(() => expect(titleCalls()).toHaveLength(1));
    expect(JSON.parse(titleCalls()[0][1].body)).toEqual({ key: "explorer" });
    expect(radio(page, "Explorer").props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    expect(radio(page, "Voyager").props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
    expect(page.getByRole("button", { name: "Explorer shows on your profile and the leaderboard" })).toBeTruthy();

    // The one already on show: nothing to send.
    fireEvent.press(radio(page, "Explorer"));
    expect(titleCalls()).toHaveLength(1);
  });

  it("puts the old pick back when the server says no", async () => {
    refuse = true;
    const page = await openTitles();
    fireEvent.press(radio(page, "Explorer"));
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith("Couldn't change your title", expect.any(String)));
    expect(radio(page, "Voyager").props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
  });
});
