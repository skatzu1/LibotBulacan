import React from "react";
import { render, renderHook, act } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../context/ThemeContext";

// "Report wrong info" on a spot's page (2026-10-18): the report goes to the
// server's spot reports, which the admin panel's Spot Reports page lists, and
// Report a Problem no longer offers a spot category of its own.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.3.0" } }));
jest.mock("@clerk/clerk-expo", () => ({
  // Signed out, so the provider makes no requests of its own on mount.
  useAuth: () => ({ isLoaded: true, isSignedIn: false, getToken: jest.fn() }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: "ana@test.local" } }, isLoaded: true }),
}));
const mockPost = jest.fn();
jest.mock("../api", () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args), get: jest.fn() },
  BASE_URL: "https://api.test",
}));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));

const { ReviewProvider, useReviews } = require("../context/ReviewContext");

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("reportSpot", () => {
  const hook = () => renderHook(() => useReviews(), { wrapper: ({ children }) => <ReviewProvider>{children}</ReviewProvider> });

  it("sends the spot, the reason and the details to the spot reports", async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    const { result } = hook();
    let sent;
    await act(async () => {
      sent = await result.current.reportSpot({ spotId: "s1", reason: "wrong_info", details: "Open until 5 PM, not 6" });
    });
    expect(sent).toBe(true);
    expect(mockPost).toHaveBeenCalledWith("/api/reports", { spotId: "s1", reason: "wrong_info", details: "Open until 5 PM, not 6" });
  });

  it("says false when the report couldn't be sent, and sends nothing without a reason", async () => {
    mockPost.mockRejectedValue(new Error("Network Error"));
    const { result } = hook();
    let sent;
    await act(async () => { sent = await result.current.reportSpot({ spotId: "s1", reason: "closed" }); });
    expect(sent).toBe(false);

    mockPost.mockClear();
    await act(async () => { sent = await result.current.reportSpot({ spotId: "s1", reason: "" }); });
    expect(sent).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("Report a Problem", () => {
  const ReportProblem = require("../Screens/ReportProblem").default;
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

  it("points wrong spot details to the spot's page instead of its own category", async () => {
    const tree = render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider><ReportProblem navigation={{ goBack: jest.fn() }} /></ThemeProvider>
      </SafeAreaProvider>,
    );
    expect(await tree.findByText(/tap Report wrong info/)).toBeTruthy();
    expect(tree.queryByLabelText("Wrong details about a spot")).toBeNull();
  });
});
