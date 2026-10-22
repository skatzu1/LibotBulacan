import React from "react";
import { act, render, fireEvent, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";
import { withTimeout } from "../utils/fetchTimeout";
import { fetchSystemStatus, hintMaintenance, maintenanceHintFrom, onMaintenanceHint } from "../utils/systemStatus";

// Maintenance (mock defense 2026-10-21): while the super admin has the system
// under maintenance, the app shows MaintenanceScreen in place of everything.
// A 503 only makes the app ask; the status route decides.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
const useSystemStatus = require("../hooks/useSystemStatus").default;
const MaintenanceScreen = require("../Screens/MaintenanceScreen").default;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>{ui}</ThemeProvider>
  </SafeAreaProvider>,
);

let seen;
const Probe = ({ fetchStatus }) => {
  seen = useSystemStatus({ fetchStatus });
  return <Text>{seen.ready ? (seen.maintenance.on ? "down" : "up") : "waiting"}</Text>;
};

describe("useSystemStatus", () => {
  it("opens the app when the check answers, and follows maintenance", async () => {
    const fetchStatus = jest.fn().mockResolvedValue({ maintenance: { on: false }, notice: null });
    const tree = render(<Probe fetchStatus={fetchStatus} />);
    expect(await tree.findByText("up")).toBeTruthy();

    fetchStatus.mockResolvedValue({ maintenance: { on: true, message: "Moving the database." }, notice: null });
    await act(async () => { await seen.recheck(); });
    expect(tree.getByText("down")).toBeTruthy();
    expect(seen.maintenance.message).toBe("Moving the database.");
  });

  it("a 503 hint makes it ask at once", async () => {
    const fetchStatus = jest.fn().mockResolvedValue({ maintenance: { on: false }, notice: null });
    const tree = render(<Probe fetchStatus={fetchStatus} />);
    await tree.findByText("up");
    fetchStatus.mockResolvedValue({ maintenance: { on: true }, notice: null });
    await act(async () => { hintMaintenance(); });
    await waitFor(() => expect(tree.getByText("down")).toBeTruthy());
  });

  it("an unreadable status keeps what it had and never shuts anyone out", async () => {
    const fetchStatus = jest.fn().mockResolvedValue(null);
    const tree = render(<Probe fetchStatus={fetchStatus} />);
    expect(await tree.findByText("up")).toBeTruthy();
  });
});

describe("the 503 hint", () => {
  it("comes from fetch responses of our own server only", async () => {
    const hint = jest.fn();
    const off = onMaintenanceHint(hint);
    const onResponse = maintenanceHintFrom("https://api.test");
    const f = withTimeout(async (url) => ({ status: url.includes("busy") ? 503 : 200, url }), 1000, { onResponse });
    await f("https://api.test/api/spots");
    await f("https://api.test/busy");
    await f("https://elsewhere.test/busy");
    off();
    expect(hint).toHaveBeenCalledTimes(1);
  });

  it("fetchSystemStatus reads the status route", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ maintenance: { on: true, message: "x" }, notice: { id: "n1" } }) });
    const res = await fetchSystemStatus("https://api.test", fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.test/api/system/status");
    expect(res).toEqual({ maintenance: { on: true, message: "x" }, notice: { id: "n1" } });
    expect(await fetchSystemStatus("https://api.test", jest.fn().mockRejectedValue(new Error("offline")))).toBeNull();
  });
});

describe("MaintenanceScreen", () => {
  it("shows the super admin's message and when it should be back, and retries", async () => {
    const onRetry = jest.fn().mockResolvedValue();
    const tree = wrap(<MaintenanceScreen maintenance={{ on: true, message: "Moving to a bigger database.", expectedEndAt: "2026-10-24T07:00:00.000Z" }} onRetry={onRetry} />);
    expect(await tree.findByText("Under maintenance")).toBeTruthy();
    expect(tree.getByText("Moving to a bigger database.")).toBeTruthy();
    expect(tree.getByText("Expected back")).toBeTruthy();
    expect(tree.getByText(/Oct 24/)).toBeTruthy();
    await act(async () => { fireEvent.press(tree.getByText("Try again")); });
    expect(onRetry).toHaveBeenCalled();
  });

  it("says something even without a message", async () => {
    const tree = wrap(<MaintenanceScreen maintenance={{ on: true }} />);
    expect(await tree.findByText(/being updated/)).toBeTruthy();
    expect(tree.queryByText("Expected back")).toBeNull();
  });
});
