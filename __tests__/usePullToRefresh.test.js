import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import usePullToRefresh from "../hooks/usePullToRefresh";
import { ThemeProvider, lightColors } from "../context/ThemeContext";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

let pull;
const Probe = ({ load, options }) => {
  pull = usePullToRefresh(load, options);
  return pull.refreshControl;
};

// ThemeProvider renders nothing until it has read the saved preference.
const renderPull = async (load, options) => {
  pull = undefined;
  await AsyncStorage.setItem("libot_theme_pref", "light");
  render(<ThemeProvider><Probe load={load} options={options} /></ThemeProvider>);
  await waitFor(() => expect(pull).toBeDefined());
};

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

beforeEach(() => AsyncStorage.clear());

describe("usePullToRefresh", () => {
  it("spins until the reload settles", async () => {
    const d = deferred();
    const load = jest.fn(() => d.promise);
    await renderPull(load);
    expect(pull.refreshing).toBe(false);

    act(() => { pull.refreshControl.props.onRefresh(); });
    expect(load).toHaveBeenCalledTimes(1);
    expect(pull.refreshing).toBe(true);
    expect(pull.refreshControl.props.refreshing).toBe(true);

    await act(async () => { d.resolve(); });
    expect(pull.refreshing).toBe(false);
  });

  it("stops spinning when the reload fails", async () => {
    const d = deferred();
    await renderPull(() => d.promise);
    act(() => { pull.refreshControl.props.onRefresh(); });
    await act(async () => { d.reject(new Error("offline")); });
    expect(pull.refreshing).toBe(false);
  });

  it("uses the app's brand colour and can be switched off", async () => {
    await renderPull(jest.fn(), { enabled: false });
    expect(pull.refreshControl.props.enabled).toBe(false);
    expect(pull.refreshControl.props.colors).toEqual([lightColors.brand]);
    expect(pull.refreshControl.props.tintColor).toBe(lightColors.brand);
  });
});
