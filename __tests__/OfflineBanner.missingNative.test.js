import React from "react";
import { render, act } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// A build made before NetInfo was added has no native side, and the library
// throws on import — this is exactly what a dev client or an OTA-updated store
// build without the module hits. The app must keep running.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@react-native-community/netinfo", () => {
  throw new Error("@react-native-community/netinfo: NativeModule.RNCNetInfo is null.");
});

it("renders nothing, instead of crashing the app, when NetInfo's native module is missing", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const OfflineBanner = require("../components/OfflineBanner").default;

  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const screen = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <Text>rest of the app</Text>
        <OfflineBanner />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {});

  expect(screen.getByText("rest of the app")).toBeTruthy();
  expect(screen.queryByText(/offline/i)).toBeNull();
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("NetInfo native module missing"), expect.anything());
  warn.mockRestore();
});

it("still explains a slow server without NetInfo", async () => {
  jest.useFakeTimers();
  const OfflineBanner = require("../components/OfflineBanner").default;
  const { readStarted } = require("../utils/serverActivity");
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const screen = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <OfflineBanner />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {});
  let ended;
  act(() => { ended = readStarted(); });
  act(() => jest.advanceTimersByTime(4100));
  expect(screen.getByText(/Waking up the server/)).toBeTruthy();
  act(() => ended());
  jest.useRealTimers();
});
