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

// Two towns finished, Baliwag last: it is the best, and with nothing picked
// yet the one on show. The GOAT Traveler and District 1 are still to earn.
const NAMES = { "town:Malolos": "Malolos Traveler", "town:Baliwag": "Baliwag Traveler" };
let shown = "town:Baliwag";
const achievements = {
  title: { key: "town:Baliwag", name: "Baliwag Traveler", tier: "bronze", earnedAt: "2026-10-20T02:00:00.000Z" },
  nextTitle: { key: "district:1", name: "District 1 Traveler", tier: "silver", townsLeft: 4 },
  titles: [
    { key: "goat", name: "The GOAT Traveler", tier: "gold", done: 2, total: 7, unit: "towns", earned: false },
    { key: "district:1", name: "District 1 Traveler", tier: "silver", done: 1, total: 5, unit: "towns", earned: false },
    { key: "town:Malolos", name: "Malolos Traveler", tier: "bronze", done: 8, total: 8, unit: "spots", earned: true },
    { key: "town:Baliwag", name: "Baliwag Traveler", tier: "bronze", done: 1, total: 1, unit: "spots", earned: true },
  ],
  spots: [],
  towns: [],
  districts: [{ district: "1", name: "District 1", tier: "silver", townsDone: 1, townsTotal: 5, earned: false }],
  unlocked: { spotBadges: [], townBadges: [], districtBadges: [], title: null },
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
  shown = "town:Baliwag";
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
  await page.findByRole("radio", { name: "Malolos Traveler, earned" });
  return page;
};
const radio = (page, name) => page.getByRole("radio", { name: `${name}, earned` });
const titleCalls = () => global.fetch.mock.calls.filter(([u, init]) => String(u).endsWith("/api/users/me/title") && init?.method === "PUT");

describe("Picking the title to show", () => {
  it("lists the earned titles to pick from, the shown one checked, a locked one not pickable", async () => {
    const page = await openTitles();
    expect(radio(page, "Baliwag Traveler").props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    expect(radio(page, "Malolos Traveler").props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
    expect(page.queryByRole("radio", { name: /GOAT Traveler/ })).toBeNull();
    expect(page.queryByRole("radio", { name: /District 1 Traveler/ })).toBeNull();
    expect(page.getByText("On your profile and the leaderboard")).toBeTruthy();
    // The locked ones say what they take, by tier.
    expect(page.getByText("Finish every town in Bulacan with spots (7)")).toBeTruthy();
    expect(page.getByText("Finish every town with spots in District 1 (5)")).toBeTruthy();
    expect(page.getByText("GOLD")).toBeTruthy();
    expect(page.getByText("SILVER")).toBeTruthy();
    // Two earned: the summary says which one others see.
    expect(page.getByRole("button", { name: "Baliwag Traveler shows on your profile and the leaderboard" })).toBeTruthy();
  });

  it("tapping another earned title shows it and saves the pick", async () => {
    const page = await openTitles();
    fireEvent.press(radio(page, "Malolos Traveler"));
    await waitFor(() => expect(titleCalls()).toHaveLength(1));
    expect(JSON.parse(titleCalls()[0][1].body)).toEqual({ key: "town:Malolos" });
    expect(radio(page, "Malolos Traveler").props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    expect(radio(page, "Baliwag Traveler").props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
    expect(page.getByRole("button", { name: "Malolos Traveler shows on your profile and the leaderboard" })).toBeTruthy();

    // The one already on show: nothing to send.
    fireEvent.press(radio(page, "Malolos Traveler"));
    expect(titleCalls()).toHaveLength(1);
  });

  it("puts the old pick back when the server says no", async () => {
    refuse = true;
    const page = await openTitles();
    fireEvent.press(radio(page, "Malolos Traveler"));
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith("Couldn't change your title", expect.any(String)));
    expect(radio(page, "Baliwag Traveler").props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
  });
});
