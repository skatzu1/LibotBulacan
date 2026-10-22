import React from "react";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { fetchSystemStatus } from "../utils/systemStatus";

// The super admin's update notice (mock defense 2026-10-21). Maintenance is
// for the console only (user rule 2026-10-23), so the app never reads it.

const useSystemStatus = require("../hooks/useSystemStatus").default;

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
