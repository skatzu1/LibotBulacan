import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchSystemStatus } from "../utils/systemStatus";

// The super admin's update notice (mock defense 2026-10-21). Maintenance is
// for the console only (user rule 2026-10-23), so the app never reads it.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ colors: {} }), fonts: {}, radius: {}, MAX_FONT_SCALE: 1.3,
}));
jest.mock("../components/ui", () => ({ H_PAD: 16 }));
jest.mock("../components/Icon", () => ({ __esModule: true, default: () => null }));

const useSystemStatus = require("../hooks/useSystemStatus").default;
const { SystemStatusContext } = require("../hooks/useSystemStatus");
const UpdateNotice = require("../components/UpdateNotice").default;

describe("UpdateNotice", () => {
  const notice = { id: "n1", kind: "completed", title: "New UI", message: "Immersive UI" };
  const show = async (value = notice) => {
    const tree = render(
      <SystemStatusContext.Provider value={{ notice: value }}>
        <UpdateNotice />
      </SystemStatusContext.Provider>,
    );
    await act(async () => {});
    return tree;
  };

  beforeEach(() => AsyncStorage.clear());

  it("shows to a traveler who has never put a notice away", async () => {
    const tree = await show();
    expect(tree.getByText("New UI")).toBeTruthy();
  });

  it("stays away once put away, on this launch and the next", async () => {
    const tree = await show();
    fireEvent.press(tree.getByLabelText("Put this notice away"));
    expect(tree.queryByText("New UI")).toBeNull();
    tree.unmount();
    expect((await show()).queryByText("New UI")).toBeNull();
  });

  it("a newer notice shows even after an older one was put away", async () => {
    await AsyncStorage.setItem("dismissedUpdateNotice", "older");
    const tree = await show();
    expect(tree.getByText("New UI")).toBeTruthy();
  });
});

let seen;
const Probe = ({ fetchStatus }) => {
  seen = useSystemStatus({ fetchStatus });
  return <Text>{seen.notice ? seen.notice.title : "no notice"}</Text>;
};

describe("useSystemStatus", () => {
  it("follows the newest notice", async () => {
    const fetchStatus = jest.fn().mockResolvedValue({ notice: null });
    const tree = render(<Probe fetchStatus={fetchStatus} />);
    expect(await tree.findByText("no notice")).toBeTruthy();

    fetchStatus.mockResolvedValue({ notice: { id: "n1", kind: "scheduled", title: "New AR spots" } });
    await act(async () => { await seen.recheck(); });
    expect(tree.getByText("New AR spots")).toBeTruthy();
  });

  it("an unreadable status keeps what it had", async () => {
    const fetchStatus = jest.fn().mockResolvedValue({ notice: { id: "n1", title: "New AR spots" } });
    const tree = render(<Probe fetchStatus={fetchStatus} />);
    expect(await tree.findByText("New AR spots")).toBeTruthy();
    fetchStatus.mockResolvedValue(null);
    await act(async () => { await seen.recheck(); });
    expect(tree.getByText("New AR spots")).toBeTruthy();
  });
});

describe("fetchSystemStatus", () => {
  it("reads the notice from the status route and leaves maintenance out", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ maintenance: { on: true, message: "x" }, notice: { id: "n1" } }) });
    const res = await fetchSystemStatus("https://api.test", fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.test/api/system/status");
    expect(res).toEqual({ notice: { id: "n1" } });
    expect(await fetchSystemStatus("https://api.test", jest.fn().mockRejectedValue(new Error("offline")))).toBeNull();
  });
});
