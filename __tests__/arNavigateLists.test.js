import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// AR View and Navigate's spot lists, laid out like the Bakit List's (user,
// 2026-10-20): the spots divided by done / not done, each card saying which.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

const mockSpots = [
  { _id: "a", name: "Barasoain Church", city: "Malolos", category: ["Historical"] },
  { _id: "b", name: "Meyto Shrine", city: "Calumpit", category: ["Religious"] },
  { _id: "r", name: "Calumpit River", city: "Calumpit", category: ["Nature"] },  // no AR
];
jest.mock("../context/ArrivalContext", () => ({
  useArrival: () => ({ allSpots: mockSpots, spotsStatus: "ready", reloadSpots: jest.fn() }),
}));
jest.mock("../context/MissionContext", () => ({
  useMissions: () => ({
    getMissionsForSpot: (id) => (id === "r" ? [] : [{ _id: `${id}-ar`, type: "ar" }, { _id: `${id}-ai`, type: "ai" }]),
    completedMissions: ["a-ar", "b-ai"],
  }),
}));
// Barasoain and the river were visited; Meyto wasn't.
jest.mock("../context/PointsContext", () => ({ usePoints: () => ({ hasVisited: (id) => id !== "b" }) }));
const mockAtSpot = jest.fn(async () => true);
jest.mock("../utils/arLocationGate", () => ({
  spotHasAR: (spot) => !spot.category.includes("Nature"),
  ensureAtSpotForAR: (...args) => mockAtSpot(...args),
}));
jest.mock("../utils/cameraAccess", () => ({
  afterAlertCloses: jest.fn(async () => {}),
  ensureCameraAccess: jest.fn(async () => true),
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>{ui}</ThemeProvider>
  </SafeAreaProvider>,
);
const textsOf = (tree) => tree.UNSAFE_root
  .findAll((n) => n.type?.displayName === "Text")
  .flatMap((n) => [].concat(n.props.children).filter((c) => typeof c === "string"));
const inOrder = (texts, items) => {
  const at = items.map((t) => texts.indexOf(t));
  return at.every((i) => i > -1) && at.every((i, k) => k === 0 || i > at[k - 1]);
};

beforeEach(() => jest.clearAllMocks());

describe("AR View", () => {
  const ARSpotSelect = require("../Screens/ARspotSelect").default;

  it("divides the spots by whether their AR is done", async () => {
    const tree = wrap(<ARSpotSelect />);
    // AI scan done at Meyto doesn't count: only its AR activity does.
    expect(await tree.findByLabelText("Meyto Shrine, Calumpit, AR not done yet")).toBeTruthy();
    expect(tree.getByLabelText("Barasoain Church, Malolos, AR done")).toBeTruthy();
    expect(tree.queryByText("Calumpit River")).toBeNull();
    // Each heading comes before the cards under it.
    expect(inOrder(textsOf(tree), ["Not done yet", "Meyto Shrine", "Done", "Barasoain Church"])).toBe(true);
  });

  it("still checks the traveler is at the spot before opening AR", async () => {
    const tree = wrap(<ARSpotSelect />);
    fireEvent.press(await tree.findByLabelText("Barasoain Church, Malolos, AR done"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("ar", { spot: mockSpots[0], arMissionId: "a-ar" }));
    expect(mockAtSpot).toHaveBeenCalledWith(mockSpots[0], expect.anything());
  });
});

describe("Navigate", () => {
  const TrackSpotSelect = require("../Screens/TrackSpotSelect").default;

  it("divides the spots by whether they were visited", async () => {
    const tree = wrap(<TrackSpotSelect />);
    expect(await tree.findByLabelText("Meyto Shrine, Calumpit, not visited yet")).toBeTruthy();
    expect(tree.getByLabelText("Calumpit River, Calumpit, visited")).toBeTruthy();
    expect(inOrder(textsOf(tree), [
      "Not visited yet", "Meyto Shrine", "Visited", "Barasoain Church", "Calumpit River",
    ])).toBe(true);
  });

  it("opens directions to the spot", async () => {
    const tree = wrap(<TrackSpotSelect />);
    fireEvent.press(await tree.findByLabelText("Meyto Shrine, Calumpit, not visited yet"));
    expect(mockNavigate).toHaveBeenCalledWith("Track", { spot: mockSpots[1] });
  });
});
