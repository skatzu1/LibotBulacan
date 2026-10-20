import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// The leaderboard in pages, with your own standing pinned first on every page
// (the thesis panel, 2026-10-21).

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
const { pageButtons, PAGE_SIZE } = require("../Screens/Leaderboard");

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const json = (body) => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body });

const TOTAL = 45;
const traveler = (i) => ({
  _id: `u${i}`, clerkUserId: i === 31 ? "me" : `u${i}`, name: i === 31 ? "Mia Torres" : `Traveler ${i}`,
  points: (TOTAL - i) * 10, rank: i, spotsVisited: 2, ...(i === 4 && { title: "voyager", titleName: "Voyager" }),
});
const board = (page) => ({
  users: Array.from({ length: TOTAL }, (_, i) => traveler(i + 1)).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  me: { ...traveler(31), page: 2, title: "explorer" },
  total: TOTAL, page, pages: 3, pageSize: PAGE_SIZE,
});

beforeEach(() => {
  global.fetch = jest.fn(async (url) => json(board(Number(/page=(\d+)/.exec(url)[1]))));
});

it("pins your standing first and jumps to your page", async () => {
  const tree = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider><Leaderboard /></ThemeProvider>
    </SafeAreaProvider>,
  );
  await tree.findByText("Rankings", {}, { timeout: 8000 });
  expect(global.fetch.mock.calls[0][0]).toBe(`https://api.test/api/users?page=1&limit=${PAGE_SIZE}`);

  const you = tree.getByLabelText("Your standing: rank 31 of 45, 140 points, 2 spots visited, Explorer. Opens page 2");
  expect(tree.getByText("#31")).toBeTruthy();
  expect(tree.getByLabelText(/^Rank 4, Traveler 4, 410 points, 2 spots visited, Voyager$/)).toBeTruthy();
  expect(tree.getByText("Page 1 of 3 · 45 explorers")).toBeTruthy();

  fireEvent.press(you);
  await waitFor(() => expect(tree.getByText("Ranks 21–40 of 45")).toBeTruthy());
  expect(global.fetch).toHaveBeenLastCalledWith(`https://api.test/api/users?page=2&limit=${PAGE_SIZE}`, expect.anything());
  // On your page: your row is in the list, and the card no longer offers a jump.
  expect(tree.getByLabelText(/^Rank 31, you, 140 points/)).toBeTruthy();
  expect(tree.getByLabelText("Your standing: rank 31 of 45, 140 points, 2 spots visited, Explorer")).toBeTruthy();

  fireEvent.press(tree.getByLabelText("Next page"));
  await waitFor(() => expect(tree.getByText("Ranks 41–45 of 45")).toBeTruthy());
}, 20000);

it("page buttons: the ends and the neighbours, with gaps", () => {
  expect(pageButtons(1, 1)).toEqual([]);
  expect(pageButtons(1, 3)).toEqual([1, 2, 3]);
  expect(pageButtons(5, 12)).toEqual([1, "…", 4, 5, 6, "…", 12]);
  expect(pageButtons(1, 12)).toEqual([1, 2, "…", 12]);
  // A gap of one page shows that page rather than "…".
  expect(pageButtons(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
});
