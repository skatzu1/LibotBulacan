import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// The app's side of achievements (the thesis panel, 2026-10-21): the reward
// moments, the progress banner, titles, and the Terms pop-up's text.

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
const { nextTitleLine, titleName } = require("../utils/titles");
const { reachedEnd } = require("../components/LegalConsentModal");
const { LEGAL_DOCS, LEGAL_VERSION } = require("../utils/legalText");
const { sealInk } = require("../utils/townEmblem");
const { BULACAN_MUNICIPALITIES } = require("../utils/municipalities");

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
const TOWN = { municipality: "Malolos", name: "Malolos", description: "Finished every mission in Malolos", image: null };

describe("utils/rewards", () => {
  it("orders a step's rewards: the spot's badge, the town's, then the title", () => {
    const items = itemsFrom({ title: { key: "explorer", name: "Explorer" }, townBadge: TOWN, spotBadge: SPOT_BADGE });
    expect(items.map((i) => i.kind)).toEqual(["spot", "town", "title"]);
    // The lists GET /api/achievements/me sends work too.
    expect(itemsFrom({ spotBadges: [SPOT_BADGE, SPOT_BADGE], townBadges: [], title: null }).length).toBe(2);
    expect(itemsFrom({ spotBadge: null, townBadge: null, title: null })).toEqual([]);
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
      celebrate({ spotBadge: SPOT_BADGE, townBadge: TOWN, title: { key: "explorer", name: "Explorer" } });
    });
    expect(tree.getByText("BADGE UNLOCKED")).toBeTruthy();
    expect(tree.getByText("Barasoain Church")).toBeTruthy();
    expect(tree.getByLabelText("1 of 3")).toBeTruthy();

    fireEvent.press(tree.getByLabelText("Next reward"));
    expect(tree.getByText("TOWN FINISHED")).toBeTruthy();
    expect(tree.getByText("Every spot in Malolos, every mission. That's the whole town.")).toBeTruthy();

    fireEvent.press(tree.getByLabelText("Next reward"));
    expect(tree.getByText("NEW TITLE")).toBeTruthy();
    expect(tree.getByText("Explorer")).toBeTruthy();
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
  }, 15000);

  it("a step that earns nothing yet: the banner, with points and how far along", async () => {
    const tree = await mount();
    await act(async () => {
      expect(celebrateResult({ pointsAwarded: 5, unlocked: { spotBadge: null, townBadge: null, title: null }, progress: { done: 2, total: 3, spotName: "Barasoain Church", complete: false } })).toBe(true);
    });
    expect(tree.getByText("+5 points")).toBeTruthy();
    expect(tree.getByText("2 of 3 done at Barasoain Church")).toBeTruthy();
    expect(tree.queryByText("BADGE UNLOCKED")).toBeNull();
    // Nothing earned and no points (a mission done before): no banner.
    await act(async () => { showProgress(null); });
    expect(celebrateResult({ pointsAwarded: 0, progress: { done: 3, total: 3, spotName: "X" } })).toBe(false);
  }, 15000);

  it("words for each reward", () => {
    expect(copyFor({ kind: "spot", badge: SPOT_BADGE }).headline).toBe("Barasoain Church");
    expect(copyFor({ kind: "town", town: { ...TOWN, name: "Malolos Heritage", description: "The first republic's town." } }))
      .toEqual(expect.objectContaining({ headline: "Malolos Heritage", body: "The first republic's town." }));
    expect(copyFor({ kind: "title", title: { key: "goat", name: "GOAT Traveler" } }).body).toMatch(/no title above/);
  });
});

describe("Titles", () => {
  it("names and the next goal", () => {
    expect(titleName("voyager")).toBe("Voyager");
    expect(titleName({ key: "goat", name: "GOAT Traveler" })).toBe("GOAT Traveler");
    expect(titleName(null)).toBeNull();
    expect(nextTitleLine({ name: "Voyager", townsLeft: 2 })).toBe("2 more towns to Voyager");
    expect(nextTitleLine({ name: "Explorer", townsLeft: 1 })).toBe("1 more town to Explorer");
    expect(nextTitleLine(null)).toBe("You've earned every title");
  });

  it("each of the 24 towns has its own seal ink", () => {
    expect(new Set(BULACAN_MUNICIPALITIES.map(sealInk)).size).toBe(24);
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
