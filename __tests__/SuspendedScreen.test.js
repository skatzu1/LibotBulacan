import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// A suspension locks the account until it ends: the screen says when, what a
// next suspension would mean, and lets the traveler sign out.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
const mockSignOut = jest.fn();
jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
const SuspendedScreen = require("../Screens/SuspendedScreen").default;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>{ui}</ThemeProvider>
  </SafeAreaProvider>,
);
const inDays = (n) => new Date(Date.now() + n * 86_400_000 - 60_000).toISOString();

it("shows the days left and the end date, and signs out", async () => {
  const until = inDays(7);
  const tree = wrap(<SuspendedScreen suspensionInfo={{ isSuspended: true, suspendedUntil: until, suspensionCount: 1 }} />);

  expect(await tree.findByText("Your account is suspended")).toBeTruthy();
  expect(tree.getByText("7 days")).toBeTruthy();
  expect(tree.getByText(new Date(until).toDateString())).toBeTruthy();
  expect(tree.getByText(/suspended again, it will be for 14 days/)).toBeTruthy();

  fireEvent.press(tree.getByText("Sign out"));
  expect(mockSignOut).toHaveBeenCalled();
});

it("warns that a 3rd suspension is a permanent ban", async () => {
  const tree = wrap(<SuspendedScreen suspensionInfo={{ isSuspended: true, suspendedUntil: inDays(1), suspensionCount: 2 }} />);
  expect(await tree.findByText("1 day")).toBeTruthy();
  expect(tree.getByText(/suspended again, it will be banned permanently/)).toBeTruthy();
});
