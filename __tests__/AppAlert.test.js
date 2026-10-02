import React from "react";
import { Modal, Text } from "react-native";
import { render, act } from "@testing-library/react-native";
import { AppAlertProvider, showToast, showAlert } from "../components/AppAlert";
import { ThemeProvider } from "../context/ThemeContext";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// ThemeProvider renders nothing until it has read the saved preference.
const renderApp = async () => {
  const tree = render(
    <ThemeProvider>
      <AppAlertProvider>
        <Text>screen</Text>
      </AppAlertProvider>
    </ThemeProvider>,
  );
  await tree.findByText("screen");
  return tree;
};

// pointerEvents of the nearest ancestor that sets one.
const pointerEventsAround = (node) => {
  for (let n = node; n; n = n.parent) if (n.props?.pointerEvents) return n.props.pointerEvents;
  return undefined;
};

describe("AppAlert", () => {
  // Regression: the toast was drawn in a <Modal>, which on Android is its own
  // window and takes every touch — the screen ignored taps while it showed
  // (e.g. right after toggling terminals on the route map).
  it("shows a toast without a Modal, letting touches through", async () => {
    const tree = await renderApp();
    act(() => showToast("Terminals hidden", { type: "info" }));

    const message = await tree.findByText("Terminals hidden");
    expect(tree.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
    expect(pointerEventsAround(message)).toBe("none");
  });

  it("still puts an alert in a Modal, so it blocks the screen until answered", async () => {
    const tree = await renderApp();
    act(() => showAlert("Discard changes?", "You have unsaved changes."));

    await tree.findByText("Discard changes?");
    expect(tree.UNSAFE_queryAllByType(Modal)).toHaveLength(1);
  });
});
