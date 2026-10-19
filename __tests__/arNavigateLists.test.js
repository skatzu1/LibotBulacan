import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// AR View and Navigate's spot lists, laid out like the Badges screen (user,
// 2026-10-20): a done/total count, a filter with counts, done spots first.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

const mockSpots = [
  { _id: "b", name: "Meyto Shrine", city: "Calumpit", category: ["Religious"] },
  { _id: "a", name: "Barasoain Church", city: "Malolos", category: ["Historical"] },
  { _id: "r", name: "Calumpit River", city: "Calumpit", category: ["Nature"] },  // no AR
];
jest.mock("../context/ArrivalContext", () => ({
  useArrival: () => ({ allSpots: mockSpots, spotsStatus: "ready", reloadSpots: jest.fn() }),
}));
jest.mock("../context/MissionContext", () => ({
  useMissions: () => ({
    getMissionsForSpot: (id) => (id === "r" ? [] : [{ _id: `${id}-ar`, type: "ar", points: 50 }, { _id: `${id}-ai`, type: "ai" }]),
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
const NAMES = mockSpots.map((s) => s.name);
const shownSpots = (tree) => tree.UNSAFE_root
  .findAll((n) => n.type?.displayName === "Text")
  .flatMap((n) => [].concat(n.props.children).filter((c) => typeof c === "string"))
  .filter((t) => NAMES.includes(t))
  .filter((t, i, all) => all.indexOf(t) === i);

beforeEach(() => jest.clearAllMocks());

describe("AR View", () => {
  const ARSpotSelect = require("../Screens/ARspotSelect").default;

  it("counts the AR done, lists those first, and shows what the rest are worth", async () => {
    const tree = wrap(<ARSpotSelect />);
    expect(await tree.findByLabelText("1 of 2 done")).toBeTruthy();
    expect(tree.getByLabelText("Not done, 1 spots")).toBeTruthy();
    // AI scan done at Meyto doesn't count: only its AR activity does.
    expect(tree.getByLabelText("Meyto Shrine, Calumpit, AR not done yet")).toBeTruthy();
    expect(shownSpots(tree)).toEqual(["Barasoain Church", "Meyto Shrine"]);
    expect(tree.getByText("AR done")).toBeTruthy();
    expect(tree.getByText("+50")).toBeTruthy();
  });

  it("still checks the traveler is at the spot before opening AR", async () => {
    const tree = wrap(<ARSpotSelect />);
    fireEvent.press(await tree.findByLabelText("Barasoain Church, Malolos, AR done"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("ar", { spot: mockSpots[1], arMissionId: "a-ar" }));
    expect(mockAtSpot).toHaveBeenCalledWith(mockSpots[1], expect.anything());
  });
});

describe("Navigate", () => {
  const TrackSpotSelect = require("../Screens/TrackSpotSelect").default;

  it("counts the visited spots, lists them first, and filters by it", async () => {
    const tree = wrap(<TrackSpotSelect />);
    expect(await tree.findByLabelText("2 of 3 visited")).toBeTruthy();
    expect(shownSpots(tree)).toEqual(["Barasoain Church", "Calumpit River", "Meyto Shrine"]);
    fireEvent.press(tree.getByLabelText("Not visited, 1 spots"));
    expect(shownSpots(tree)).toEqual(["Meyto Shrine"]);
  });

  it("opens directions to the spot", async () => {
    const tree = wrap(<TrackSpotSelect />);
    fireEvent.press(await tree.findByLabelText("Meyto Shrine, Calumpit, not visited yet"));
    expect(mockNavigate).toHaveBeenCalledWith("Track", { spot: mockSpots[0] });
  });
});
