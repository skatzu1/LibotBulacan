import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// The app's side of achievements (the thesis panel, 2026-10-21; tiers
// 2026-10-24): the reward moments, the progress banner, titles, and the Terms
// pop-up's text.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));
jest.mock("../api", () => ({ __esModule: true, BASE_URL: "https://api.test", default: {} }));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
}));
const mockNavigate = jest.fn();
jest.mock("../navigation/navigationRef", () => ({
  navigationRef: { isReady: () => true, navigate: (...a) => mockNavigate(...a) },
}));
jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn(async () => ({})) } }));

const { itemsFrom, celebrate, celebrateResult, showProgress } = require("../utils/rewards");
const { RewardCelebrationProvider, copyFor } = require("../components/RewardCelebration");
const { nextTitleLine, titleName, titleTier } = require("../utils/titles");
const { reachedEnd } = require("../components/LegalConsentModal");
const { LEGAL_DOCS, LEGAL_VERSION } = require("../utils/legalText");

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
// The theme loads first, so wait for the screen behind the moments to be up.
const mount = async () => {
  const { Text } = require("react-native");
  const tree = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider><RewardCelebrationProvider><Text>screen</Text></RewardCelebrationProvider></ThemeProvider>
    </SafeAreaProvider>,
  );
  await tree.findByText("screen", {}, { timeout: 8000 });
  return tree;
};

const SPOT_BADGE = { badgeId: "b1", name: "Barasoain Church", image: "https://res.cloudinary.com/demo/image/upload/v1/b.png" };
const TOWN = {
  municipality: "Malolos", name: "Malolos", description: "Finished every mission in Malolos", image: null,
  tier: "bronze", title: { key: "town:Malolos", name: "Malolos Traveler", tier: "bronze" },
};
const DISTRICT = {
  district: "1", name: "District 1", description: "Finished every mission in District 1", image: null,
  tier: "silver", title: { key: "district:1", name: "District 1 Traveler", tier: "silver" },
};
const GOAT = { key: "goat", name: "The GOAT Traveler", tier: "gold" };

describe("utils/rewards", () => {
  it("orders a step's rewards: the spot's badge, the town's, the district's, then the gold title", () => {
    const items = itemsFrom({ title: GOAT, districtBadge: DISTRICT, townBadge: TOWN, spotBadge: SPOT_BADGE });
    expect(items.map((i) => i.kind)).toEqual(["spot", "town", "district", "title"]);
    // The lists GET /api/achievements/me sends work too.
    expect(itemsFrom({ spotBadges: [SPOT_BADGE, SPOT_BADGE], townBadges: [], districtBadges: [DISTRICT], title: null }).length).toBe(3);
    expect(itemsFrom({ spotBadge: null, townBadge: null, districtBadge: null, title: null })).toEqual([]);
    expect(itemsFrom(undefined)).toEqual([]);
  });

  it("does nothing when no celebration is on screen", () => {
    expect(celebrate({ spotBadge: SPOT_BADGE })).toBe(false);
    expect(celebrateResult(null)).toBe(false);
  });
});

describe("The reward moments", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("shows each reward in turn, then closes", async () => {
    const tree = await mount();
    await act(async () => {
      celebrate({ spotBadge: SPOT_BADGE, townBadge: TOWN, districtBadge: DISTRICT, title: GOAT });
    });
    expect(tree.getByText("BADGE UNLOCKED · IRON")).toBeTruthy();
    expect(tree.getByText("Barasoain Church")).toBeTruthy();
    expect(tree.getByLabelText("1 of 4")).toBeTruthy();

    fireEvent.press(tree.getByLabelText("Next reward"));
    expect(tree.getByText("TOWN FINISHED · BRONZE")).toBeTruthy();
    expect(tree.getByText("Every spot in Malolos, every mission. That's the whole town.")).toBeTruthy();
    expect(tree.getByText(/New title: Malolos Traveler/)).toBeTruthy();

    fireEvent.press(tree.getByLabelText("Next reward"));
    expect(tree.getByText("DISTRICT FINISHED · SILVER")).toBeTruthy();
    expect(tree.getByText("District 1")).toBeTruthy();
    expect(tree.getByText(/New title: District 1 Traveler/)).toBeTruthy();

    fireEvent.press(tree.getByLabelText("Next reward"));
    expect(tree.getByText("NEW TITLE · GOLD")).toBeTruthy();
    expect(tree.getByText("The GOAT Traveler")).toBeTruthy();
    // Only a spot badge can be shared.
    expect(tree.queryByLabelText("Share a link to this badge")).toBeNull();
  }, 15000);

  it("View achievements opens the tab of the reward on screen", async () => {
    const tree = await mount();
    await act(async () => { celebrate({ townBadge: TOWN }); });
    await act(async () => {
      fireEvent.press(tree.getByLabelText("View your achievements"));
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(mockNavigate).toHaveBeenCalledWith("Badges", { tab: "towns" });

    await act(async () => { celebrate({ districtBadge: DISTRICT }); });
    await act(async () => {
      fireEvent.press(tree.getByLabelText("View your achievements"));
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(mockNavigate).toHaveBeenLastCalledWith("Badges", { tab: "districts" });
  }, 15000);

  it("a step that earns nothing yet: the banner, with points and how far along", async () => {
    const tree = await mount();
    await act(async () => {
      expect(celebrateResult({ pointsAwarded: 5, unlocked: { spotBadge: null, townBadge: null, title: null }, progress: { done: 2, total: 3, spotName: "Barasoain Church", complete: false } })).toBe(true);
    });
    expect(tree.getByText("+5 points")).toBeTruthy();
    expect(tree.getByText("2 of 3 done at Barasoain Church")).toBeTruthy();
    expect(tree.queryByText("BADGE UNLOCKED · IRON")).toBeNull();
    // Nothing earned and no points (a mission done before): no banner.
    await act(async () => { showProgress(null); });
    expect(celebrateResult({ pointsAwarded: 0, progress: { done: 3, total: 3, spotName: "X" } })).toBe(false);
  }, 15000);

  it("words for each reward", () => {
    expect(copyFor({ kind: "spot", badge: SPOT_BADGE })).toEqual(expect.objectContaining({ headline: "Barasoain Church", tier: "iron" }));
    expect(copyFor({ kind: "town", town: { ...TOWN, name: "Malolos Heritage", description: "The first republic's town." } }))
      .toEqual(expect.objectContaining({ headline: "Malolos Heritage", body: "The first republic's town." }));
    expect(copyFor({ kind: "town", town: TOWN }).title).toBe("Malolos Traveler");
    expect(copyFor({ kind: "district", district: DISTRICT }))
      .toEqual(expect.objectContaining({ headline: "District 1", title: "District 1 Traveler", tier: "silver" }));
    expect(copyFor({ kind: "title", title: GOAT })).toEqual(expect.objectContaining({ headline: "The GOAT Traveler", tier: "gold" }));
    expect(copyFor({ kind: "title", title: GOAT }).body).toMatch(/no title above/);
  });
});

describe("Titles", () => {
  it("names, tiers and the next goal", () => {
    expect(titleName("town:Baliwag")).toBe("Baliwag Traveler");
    expect(titleName("district:1")).toBe("District 1 Traveler");
    expect(titleName("district:sjdm")).toBe("San Jose del Monte District Traveler");
    expect(titleName({ key: "goat", name: "The GOAT Traveler" })).toBe("The GOAT Traveler");
    expect(["town:Malolos", "district:2", "goat"].map(titleTier)).toEqual(["bronze", "silver", "gold"]);
    // The old ladder's keys name nothing now.
    expect([titleName("voyager"), titleName("explorer"), titleName("district:9"), titleName(null)]).toEqual([null, null, null, null]);
    expect(nextTitleLine({ name: "District 1 Traveler", townsLeft: 2 })).toBe("2 more towns to District 1 Traveler");
    expect(nextTitleLine({ name: "The GOAT Traveler", townsLeft: 1 })).toBe("1 more town to The GOAT Traveler");
    expect(nextTitleLine(null)).toBe("You've earned every title");
  });
});

describe("The Terms pop-up", () => {
  it("counts the end as reached a little before the last pixel, and a short text at once", () => {
    expect(reachedEnd({ layoutHeight: 700, offsetY: 5280, contentHeight: 6000 })).toBe(true);
    expect(reachedEnd({ layoutHeight: 700, offsetY: 5000, contentHeight: 6000 })).toBe(false);
    expect(reachedEnd({ layoutHeight: 700, offsetY: 0, contentHeight: 500 })).toBe(true);
    expect(reachedEnd({ layoutHeight: 0, offsetY: 0, contentHeight: 500 })).toBe(false);
  });

  it("shows the website's Terms and Privacy Policy, versioned by date", () => {
    expect(LEGAL_DOCS.map((d) => d.title)).toEqual(["Terms and Conditions", "Privacy Policy"]);
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const terms = LEGAL_DOCS[0].blocks;
    expect(terms.some((b) => b.type === "h" && /Who can use/.test(b.text))).toBe(true);
    expect(terms.some((b) => b.runs?.some((r) => /13 years/.test(r.text)))).toBe(true);
    const privacy = LEGAL_DOCS[1].blocks;
    expect(privacy.some((b) => b.runs?.some((r) => /middle name/i.test(r.text)))).toBe(true);
  });
});
