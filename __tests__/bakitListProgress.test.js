import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// The Bakit List quick action (user, 2026-10-20: the "2/5" chips were
// confusing): a summary, the spots divided by progress, and each spot's items
// by name.

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
jest.mock("../context/ReviewContext", () => ({ useReviews: () => ({ getAverageRating: () => null }) }));

const MissionsSpotSelect = require("../Screens/MissionsSpotSelect").default;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = () => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider><MissionsSpotSelect /></ThemeProvider>
  </SafeAreaProvider>,
);

// Every text in the tree, in order.
const textsOf = (tree) => tree.UNSAFE_root
  .findAll((n) => typeof n.props?.children === "string" && n.type === "Text" || n.type?.displayName === "Text")
  .flatMap((n) => [].concat(n.props.children).filter((c) => typeof c === "string"));

it("sums up every spot, then divides them: in progress, not started, finished", async () => {
  const tree = wrap();
  expect(await tree.findByText("5 of 13 things done")).toBeTruthy();
  expect(tree.getByLabelText("1 in progress")).toBeTruthy();
  expect(tree.getByLabelText("2 not started")).toBeTruthy();
  expect(tree.getByLabelText("1 finished")).toBeTruthy();

  // The summary's counts use the same words, so each section is found by the
  // line under its heading.
  const texts = textsOf(tree);
  const order = [
    SUB.started, "Meyto Shrine",
    SUB.todo, "Casa Real", "Bagbag Bridge",
    SUB.finished, "Barasoain Church",
  ].map((t) => texts.indexOf(t));
  expect(order.every((i) => i > -1)).toBe(true);
  expect([...order].sort((x, y) => x - y)).toEqual(order);
});

const SUB = {
  started:  "Pick up where you left off.",
  todo:     "Arriving at the spot ticks the first item.",
  finished: "Every item done.",
};

it("names each spot's items and says which are done", async () => {
  const tree = wrap();
  expect(await tree.findByLabelText(
    "Meyto Shrine, Calumpit, 1 of 4 done, Arrive done, AR not done, AI Scan not done, Nearby Eats not done",
  )).toBeTruthy();
  expect(tree.getByLabelText(
    "Barasoain Church, Malolos, Bakit List finished, Arrive done, AR done, AI Scan done, Nearby Eats done",
  )).toBeTruthy();
  // A spot with no activities yet still has arriving on its list.
  expect(tree.getByLabelText("Bagbag Bridge, Calumpit, 0 of 1 done, Arrive not done")).toBeTruthy();
});

it("opens the spot on its Bakit List tab", async () => {
  const tree = wrap();
  fireEvent.press(await tree.findByLabelText(/^Casa Real,/));
  expect(mockNavigate).toHaveBeenCalledWith("InformationScreen", { spot: mockSpots[0], tab: "BucketList" });
});

it("keeps the sections while searching", async () => {
  const tree = wrap();
  fireEvent.changeText(await tree.findByPlaceholderText("Search by spot or town"), "calumpit");
  const texts = textsOf(tree);
  expect(texts).toContain(SUB.started);
  expect(texts).toContain(SUB.todo);
  expect(texts).not.toContain(SUB.finished);
  expect(texts).not.toContain("Casa Real");
});
