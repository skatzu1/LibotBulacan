import React from "react";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// Travelers tied on points share one podium step instead of standing on
// separate steps that all say 1 (2026-10-20).

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@clerk/clerk-expo", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: "me", getToken: async () => "token" }),
  useUser: () => ({ user: { id: "me", firstName: "Mia" }, isLoaded: true }),
}));
jest.mock("../api", () => ({ __esModule: true, BASE_URL: "https://api.test", default: {} }));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
jest.mock("../context/ProfileImageContext", () => ({ useProfileImage: () => ({ profileImage: null, loading: false }) }));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false, addListener: () => () => {} }),
}));

const Leaderboard = require("../Screens/Leaderboard").default;
const { podiumSteps } = require("../Screens/Leaderboard");

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const json = (body) => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body });

// The server's board: sorted, each with the rank it shares (1, 1, 3, 4).
const traveler = (id, name, points, rank) => ({ _id: id, clerkUserId: id, name, points, rank, spotsVisited: 2 });
const open = async (users) => {
  global.fetch = jest.fn().mockResolvedValue(json({ users, total: users.length }));
  const tree = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider><Leaderboard /></ThemeProvider>
    </SafeAreaProvider>,
  );
  await tree.findByText("Rankings", {}, { timeout: 8000 });
  return tree;
};

it("puts travelers tied for first on one step and leaves the place they skip empty", async () => {
  const tree = await open([
    traveler("a", "Ana Reyes", 100, 1),
    traveler("b", "Ben Cruz", 100, 1),
    traveler("c", "Cy Lopez", 50, 3),
    traveler("d", "Dee Santos", 10, 4),
  ]);

  // One face on the step, the rest of the tie as +N and in the list below.
  expect(tree.getAllByText("Ana Reyes")).toHaveLength(1);
  expect(tree.getByText("+1")).toBeTruthy();
  expect(tree.getByLabelText("Rank 1, tied: Ana Reyes and 1 more listed below, 100 points each")).toBeTruthy();
  expect(tree.getByLabelText(/^Rank 1, tied, Ben Cruz/)).toBeTruthy();
  expect(tree.getByLabelText("Rank 3, 50 points, 2 spots visited")).toBeTruthy();
  expect(tree.queryByLabelText(/^Rank 2/)).toBeNull(); // no silver: nobody is ranked 2
  expect(tree.getByLabelText("Rank 4, Dee Santos, 10 points, 2 spots visited")).toBeTruthy();
}, 15000);

it("keeps travelers with no points off the podium", async () => {
  const tree = await open([
    traveler("a", "Ana Reyes", 30, 1),
    traveler("b", "Ben Cruz", 25, 2),
    traveler("c", "Cy Lopez", 0, 3),
    traveler("d", "Dee Santos", 0, 3),
  ]);

  expect(tree.queryByLabelText(/^Rank 3, tied:/)).toBeNull();
  expect(tree.getByLabelText(/^Rank 3, tied, Cy Lopez/)).toBeTruthy();
  expect(tree.getByLabelText(/^Rank 3, tied, Dee Santos/)).toBeTruthy();
}, 15000);

it("counts the rest of a big tie as +N and lists them below, with you always on the step", async () => {
  const tree = await open([
    traveler("a", "Ana Reyes", 80, 1),
    traveler("b", "Ben Cruz", 80, 1),
    traveler("c", "Cy Lopez", 80, 1),
    traveler("d", "Dee Santos", 80, 1),
    traveler("me", "Mia Torres", 80, 1),
  ]);

  expect(tree.getByText("You")).toBeTruthy();
  expect(tree.getByText("+4")).toBeTruthy();
  expect(tree.getByLabelText(/^Rank 1, tied, Ana Reyes/)).toBeTruthy();
  expect(tree.getByLabelText(/^Rank 1, tied, Cy Lopez/)).toBeTruthy();
  expect(tree.getByLabelText(/^Rank 1, tied, Dee Santos/)).toBeTruthy();
  // Your own standing is pinned first too (2026-10-21), with nowhere to jump: it's this page.
  expect(tree.getByLabelText("Your standing: rank 1 of 5, 80 points, 2 spots visited")).toBeTruthy();
}, 15000);

it("gives each place its own step when nobody is tied", () => {
  const users = [
    { name: "Ana", rank: 1, points: 40 }, { name: "Ben", rank: 2, points: 30 },
    { name: "Cy", rank: 3, points: 20 }, { name: "Dee", rank: 4, points: 10 },
  ];
  const steps = podiumSteps(users);
  expect(Object.keys(steps).sort()).toEqual(["1", "2", "3"]);
  expect(steps[2]).toEqual({ lead: users[1], count: 1 });
});
