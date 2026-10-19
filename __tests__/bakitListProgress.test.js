import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// The Bakit List quick action, laid out like the Badges screen (user,
// 2026-10-20): a finished/total count, a filter with counts, and a grid where
// finished spots come first and each card says how far along it is.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

const trio = (id) => [
  { _id: `${id}-ai`, type: "ai", order: 1 },
  { _id: `${id}-eat`, type: "location", order: 2 },
  { _id: `${id}-ar`, type: "ar", order: 3 },
];
const mockSpots = [
  { _id: "c", name: "Casa Real", city: "Malolos" },          // nothing yet
  { _id: "a", name: "Barasoain Church", city: "Malolos" },   // all done
  { _id: "d", name: "Bagbag Bridge", city: "Calumpit" },     // no missions yet, not arrived
  { _id: "b", name: "Meyto Shrine", city: "Calumpit" },      // arrived only
];
const mockMissions = { a: trio("a"), b: trio("b"), c: trio("c"), d: [] };
jest.mock("../context/ArrivalContext", () => ({
  useArrival: () => ({ allSpots: mockSpots, spotsStatus: "ready", reloadSpots: jest.fn() }),
}));
jest.mock("../context/MissionContext", () => ({
  useMissions: () => ({ getMissionsForSpot: (id) => mockMissions[id] || [], completedMissions: ["a-ai", "a-eat", "a-ar"] }),
}));
jest.mock("../context/PointsContext", () => ({ usePoints: () => ({ hasVisited: (id) => id === "a" || id === "b" }) }));

const MissionsSpotSelect = require("../Screens/MissionsSpotSelect").default;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = () => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider><MissionsSpotSelect /></ThemeProvider>
  </SafeAreaProvider>,
);

// Every text in the tree, in order.
const textsOf = (tree) => tree.UNSAFE_root
  .findAll((n) => n.type?.displayName === "Text")
  .flatMap((n) => [].concat(n.props.children).filter((c) => typeof c === "string"));
const NAMES = mockSpots.map((s) => s.name);
const shownSpots = (tree) => textsOf(tree).filter((t) => NAMES.includes(t)).filter((t, i, all) => all.indexOf(t) === i);

it("counts the finished spots and lists them first, then the furthest along", async () => {
  const tree = wrap();
  expect(await tree.findByLabelText("1 of 4 finished")).toBeTruthy();
  expect(tree.getByLabelText("All, 4 spots")).toBeTruthy();
  expect(tree.getByLabelText("To do, 3 spots")).toBeTruthy();
  expect(tree.getByLabelText("Finished, 1 spots")).toBeTruthy();
  expect(shownSpots(tree)).toEqual(["Barasoain Church", "Meyto Shrine", "Casa Real", "Bagbag Bridge"]);
});

it("says how far along each spot is", async () => {
  const tree = wrap();
  expect(await tree.findByText("All done")).toBeTruthy();
  expect(tree.getByText("1 of 4")).toBeTruthy();
  expect(tree.getByText("0 of 4")).toBeTruthy();
  // A spot with no activities yet still has arriving on its list.
  expect(tree.getByText("0 of 1")).toBeTruthy();
  expect(tree.getByLabelText(
    "Meyto Shrine, Calumpit, 1 of 4 done, Arrive done, AR not done, AI Scan not done, Nearby Eats not done",
  )).toBeTruthy();
});

it("filters like the badges: finished only, or to do only", async () => {
  const tree = wrap();
  fireEvent.press(await tree.findByLabelText("Finished, 1 spots"));
  expect(shownSpots(tree)).toEqual(["Barasoain Church"]);
  fireEvent.press(tree.getByLabelText("To do, 3 spots"));
  expect(shownSpots(tree)).toEqual(["Meyto Shrine", "Casa Real", "Bagbag Bridge"]);
});

it("searches by spot or town", async () => {
  const tree = wrap();
  fireEvent.changeText(await tree.findByPlaceholderText("Search by spot or town"), "calumpit");
  expect(shownSpots(tree)).toEqual(["Meyto Shrine", "Bagbag Bridge"]);
});

it("opens the spot on its Bakit List tab", async () => {
  const tree = wrap();
  fireEvent.press(await tree.findByLabelText(/^Casa Real,/));
  expect(mockNavigate).toHaveBeenCalledWith("InformationScreen", { spot: mockSpots[0], tab: "BucketList" });
});
