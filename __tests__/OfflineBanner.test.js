import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { ThemeProvider } from "../context/ThemeContext";
import OfflineBanner from "../components/OfflineBanner";
import { readStarted } from "../utils/serverActivity";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Capture the listener the banner registers so the test can play network
// changes into it.
let mockEmit;
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((cb) => { mockEmit = cb; return jest.fn(); }),
    refresh: jest.fn(),
  },
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const renderBanner = async () => {
  const utils = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <OfflineBanner />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  // ThemeProvider renders nothing until it has read the saved theme.
  await act(async () => {});
  return utils;
};

describe("OfflineBanner", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("says nothing while online, including while NetInfo is still unsure", async () => {
    await renderBanner();
    act(() => mockEmit({ isConnected: true, isInternetReachable: null }));
    expect(screen.queryByText(/You're offline/)).toBeNull();
  });

  it("explains the problem and offers a retry when the connection drops", async () => {
    NetInfo.refresh.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    await renderBanner();
    act(() => mockEmit({ isConnected: false, isInternetReachable: false }));

    expect(screen.getByText(/You're offline/)).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText("Check the connection again")); });
    expect(NetInfo.refresh).toHaveBeenCalled();
  });

  it("explains a slow server once a read has waited 4 s, and goes when it answers", async () => {
    await renderBanner();
    act(() => mockEmit({ isConnected: true, isInternetReachable: true }));
    let ended;
    act(() => { ended = readStarted(); });
    act(() => jest.advanceTimersByTime(3900));
    expect(screen.queryByText(/Waking up the server/)).toBeNull(); // a normal wait says nothing
    act(() => jest.advanceTimersByTime(200));
    expect(screen.getByText(/Waking up the server/)).toBeTruthy();

    act(() => ended());
    act(() => jest.advanceTimersByTime(500));
    expect(screen.queryByText(/Waking up the server/)).toBeNull();
  });

  it("says offline, not slow, when both are true", async () => {
    await renderBanner();
    let ended;
    act(() => { ended = readStarted(); });
    act(() => mockEmit({ isConnected: false, isInternetReachable: false }));
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByText(/You're offline/)).toBeTruthy();
    expect(screen.queryByText(/Waking up the server/)).toBeNull();
    act(() => ended());
  });

  it("confirms when the connection comes back, then gets out of the way", async () => {
    await renderBanner();
    act(() => mockEmit({ isConnected: false, isInternetReachable: false }));
    act(() => mockEmit({ isConnected: true, isInternetReachable: true }));

    expect(screen.getByText("Back online")).toBeTruthy();
    act(() => jest.advanceTimersByTime(3000)); // confirmation times out…
    act(() => jest.advanceTimersByTime(500));  // …and the slide-out finishes
    // Unmounted, not merely off-screen, so a screen reader can't land on it.
    expect(screen.queryByText("Back online")).toBeNull();
  });
});
