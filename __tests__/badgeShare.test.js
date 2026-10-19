import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
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
}));
jest.mock("../context/ArrivalContext", () => ({ useArrival: () => ({ allSpots: [] }) }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn(async () => ({})) } }));

const badge = {
  _id: "b1",
  name: "Barasoain Church",
  description: "",
  image: "https://res.cloudinary.com/demo/image/upload/v1/badge.png",
  spotId: { _id: "s1", name: "Barasoain Church", city: "Malolos" },
};

const reply = (body) => Promise.resolve({ ok: true, json: async () => body });
global.fetch = jest.fn((url) => (String(url).endsWith("/api/badges")
  ? reply({ badges: [badge] })
  : reply({ user: { badges: [{ spotId: "s1", claimedAt: "2026-10-18T02:00:00.000Z" }] } })));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

beforeEach(() => {
  jest.clearAllMocks();
  return AsyncStorage.clear();
});

describe("Sharing a badge", () => {
  it("has one Share button, which sends the badge's link for a preview card", async () => {
    const page = render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider>
          <BadgeScreen />
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    fireEvent.press(await page.findByLabelText(/^Barasoain Church badge, earned/));
    const share = await page.findByRole("button", { name: "Share a link to this badge" });
    expect(page.queryByText("Share as image")).toBeNull();

    fireEvent.press(share);
    expect(RNShare.open).toHaveBeenCalledTimes(1);
    const options = RNShare.open.mock.calls[0][0];
    expect(options.url).toBe(badgeShareUrl("b1"));
    expect(options.url).toBe("https://libotbulacan.com/badge/b1");
    // The link goes once, as the link — not also inside the text.
    expect(options.message).toContain("Barasoain Church");
    expect(options.message).not.toContain("http");
    // Never a picture.
    expect(options.type).toBeUndefined();
  });
});
