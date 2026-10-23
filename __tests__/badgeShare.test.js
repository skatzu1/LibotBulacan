import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNShare from "react-native-share";
import { ThemeProvider } from "../context/ThemeContext";
import BadgeScreen from "../Screens/BadgeScreen";
import { badgeShareUrl } from "../utils/legalLinks";

// A badge is shared as a link to its page on the website, whose preview tags
// show the badge in the chat (2026-10-20) — never as a picture.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../api", () => ({ __esModule: true, BASE_URL: "https://api.test", default: {} }));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ addListener: () => () => {}, navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
jest.mock("../context/ArrivalContext", () => ({ useArrival: () => ({ allSpots: [] }) }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn(async () => ({})) } }));

// The Achievements screen's data (GET /api/achievements/me): one earned spot badge.
const achievements = {
  title: null,
  nextTitle: { key: "goat", name: "The GOAT Traveler", tier: "gold", townsLeft: 1 },
  titles: [
    { key: "goat", name: "The GOAT Traveler", tier: "gold", done: 0, total: 1, unit: "towns", earned: false },
    { key: "town:Malolos", name: "Malolos Traveler", tier: "bronze", done: 1, total: 1, unit: "spots", earned: false },
  ],
  spots: [{
    spotId: "s1", name: "Barasoain Church", town: "Malolos",
    badge: { badgeId: "b1", name: "Barasoain Church", image: "https://res.cloudinary.com/demo/image/upload/v1/badge.png" },
    steps: [{ key: "arrive", type: "arrive", done: true }], done: 1, total: 1, complete: true,
    earned: true, earnedAt: "2026-10-18T02:00:00.000Z",
  }],
  towns: [{ municipality: "Malolos", name: "Malolos", description: "", image: null, tier: "bronze", spotsDone: 1, spotsTotal: 1, earned: false }],
  districts: [],
  unlocked: { spotBadges: [], townBadges: [], districtBadges: [], title: null },
};

const reply = (body, ok = true) => Promise.resolve({ ok, json: async () => body });
// The share code request: answered with a code, or failing (offline, server error).
let shareReply = () => reply({ success: true, token: "abcDEF123456" });
global.fetch = jest.fn((url, init) => {
  const u = String(url);
  if (u.endsWith("/api/achievements/me")) return reply({ success: true, ...achievements });
  if (u.endsWith("/api/users/me/badges/b1/share") && init?.method === "POST") return shareReply();
  return reply({});
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

beforeEach(() => {
  jest.clearAllMocks();
  shareReply = () => reply({ success: true, token: "abcDEF123456" });
  return AsyncStorage.clear();
});

const openShare = async () => {
  const page = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <BadgeScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  fireEvent.press(await page.findByLabelText(/^Barasoain Church badge, earned/));
  const share = await page.findByRole("button", { name: "Share a link to this badge" });
  return { page, share };
};

describe("Sharing a badge", () => {
  it("has one Share button, which sends the badge's link, with the sharer's code, for a preview card", async () => {
    const { page, share } = await openShare();
    expect(page.queryByText("Share as image")).toBeNull();

    fireEvent.press(share);
    await waitFor(() => expect(RNShare.open).toHaveBeenCalledTimes(1));
    const options = RNShare.open.mock.calls[0][0];
    // The code lets the badge page say who shared it.
    expect(options.url).toBe(badgeShareUrl("b1", "abcDEF123456"));
    expect(options.url).toBe("https://libotbulacan.com/badge/b1/abcDEF123456");
    // The link goes once, as the link — not also inside the text.
    expect(options.message).toContain("Barasoain Church");
    expect(options.message).not.toContain("http");
    // Never a picture.
    expect(options.type).toBeUndefined();
  });

  it("still shares the plain link when the code can't be had", async () => {
    shareReply = () => reply({ success: false }, false);
    const { share } = await openShare();
    fireEvent.press(share);
    await waitFor(() => expect(RNShare.open).toHaveBeenCalledTimes(1));
    expect(RNShare.open.mock.calls[0][0].url).toBe("https://libotbulacan.com/badge/b1");
  });

  it("…and when the request fails outright", async () => {
    shareReply = () => Promise.reject(new TypeError("Network request failed"));
    const { share } = await openShare();
    fireEvent.press(share);
    await waitFor(() => expect(RNShare.open).toHaveBeenCalledTimes(1));
    expect(RNShare.open.mock.calls[0][0].url).toBe("https://libotbulacan.com/badge/b1");
  });
});
