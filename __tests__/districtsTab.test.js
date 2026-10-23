import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../context/ThemeContext";
import BadgeScreen from "../Screens/BadgeScreen";

// Achievements → Districts (the thesis panel, 2026-10-24): a silver badge per
// district, for every town in it that has spots, with its title.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../api", () => ({ __esModule: true, BASE_URL: "https://api.test", default: {} }));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));
const mockNavigation = { addListener: () => () => {}, navigate: jest.fn(), goBack: jest.fn() };
const mockRoute = { params: { tab: "districts" } };
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

const town = (name, earned, spotsDone, spotsTotal) => ({
  municipality: name, name, description: `Finished every mission in ${name}`, image: null, district: "1", tier: "bronze",
  title: { key: `town:${name}`, name: `${name} Traveler`, tier: "bronze" }, spotsDone, spotsTotal, earned,
  earnedAt: earned ? "2026-10-22T02:00:00.000Z" : null,
});
const achievements = {
  title: { key: "town:Malolos", name: "Malolos Traveler", tier: "bronze", earnedAt: "2026-10-22T02:00:00.000Z" },
  shownTitle: { key: "town:Malolos", name: "Malolos Traveler", tier: "bronze" },
  nextTitle: { key: "district:1", name: "District 1 Traveler", tier: "silver", townsLeft: 1 },
  titles: [],
  spots: [],
  towns: [town("Malolos", true, 2, 2), town("Calumpit", false, 1, 3)],
  districts: [{
    district: "1", name: "District 1", description: "Finished every mission in District 1",
    towns: ["Bulakan", "Calumpit", "Hagonoy", "Malolos", "Paombong", "Pulilan"], townsWithSpots: ["Calumpit", "Malolos"],
    image: null, tier: "silver", title: { key: "district:1", name: "District 1 Traveler", tier: "silver" },
    townsDone: 1, townsTotal: 2, earned: false, earnedAt: null,
  }],
  unlocked: { spotBadges: [], townBadges: [], districtBadges: [], title: null },
};
global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, ...achievements }) }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
beforeEach(() => AsyncStorage.clear());

it("lists each district's silver badge, opening its towns and the title it comes with", async () => {
  const page = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider><BadgeScreen /></ThemeProvider>
    </SafeAreaProvider>,
  );
  const card = await page.findByLabelText("District 1 district badge, Silver, locked, 1 of 2 towns done", {}, { timeout: 8000 });
  expect(page.getByText("1 of 2 towns")).toBeTruthy();
  expect(page.getByText("1 more town to District 1 Traveler")).toBeTruthy();

  fireEvent.press(card);
  expect(await page.findByText("Finish every town in District 1 that has spots to earn it.")).toBeTruthy();
  expect(page.getByLabelText("Comes with the title District 1 Traveler")).toBeTruthy();
  expect(page.getByLabelText("Malolos, town finished")).toBeTruthy();
  expect(page.getByText("No spots yet in Bulakan, Hagonoy, Paombong, Pulilan")).toBeTruthy();

  // A town in it opens that town's card.
  fireEvent.press(page.getByLabelText("Calumpit, 1 of 3 spots done"));
  expect(await page.findByText("Finish every mission at every spot in Calumpit to earn it.")).toBeTruthy();
  expect(page.getByLabelText("Comes with the title Calumpit Traveler")).toBeTruthy();
}, 20000);
