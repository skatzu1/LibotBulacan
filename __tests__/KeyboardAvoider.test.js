import React from "react";
import { Keyboard, Platform, StyleSheet, Text, View } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

// An edge-to-edge Android screen: the view runs under the status bar (30) and
// the navigation bar (48), on a 900-tall window.
const SCREEN_H = 900;
const KEYBOARD_TOP = 560;

// The component picks its Android version when the module loads.
const realOS = Platform.OS;
Platform.OS = "android";
const KeyboardAvoider = require("../components/KeyboardAvoider").default;
afterAll(() => { Platform.OS = realOS; });

let handlers;

beforeEach(() => {
  handlers = {};
  jest.spyOn(Keyboard, "addListener").mockImplementation((type, fn) => {
    handlers[type] = fn;
    return { remove: jest.fn() };
  });
  jest.spyOn(Keyboard, "isVisible").mockReturnValue(false);
  jest.spyOn(Keyboard, "metrics").mockReturnValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

const renderAvoider = () => {
  const tree = render(
    <KeyboardAvoider style={{ flex: 1 }}>
      <Text>{"Don't have an account?"}</Text>
    </KeyboardAvoider>,
  );
  const view = tree.UNSAFE_getAllByType(View)[0];
  view.instance.measureInWindow = (cb) => cb(0, 0, 400, SCREEN_H);
  return { tree, view };
};

const paddingOf = (view) => StyleSheet.flatten(view.props.style).paddingBottom;

describe("KeyboardAvoider (Android)", () => {
  it("pads by the part of the view the keyboard covers", () => {
    const { view } = renderAvoider();
    expect(paddingOf(view)).toBe(0);
    act(() => handlers.keyboardDidShow({ endCoordinates: { screenY: KEYBOARD_TOP, height: 292 } }));
    expect(paddingOf(view)).toBe(SCREEN_H - KEYBOARD_TOP);
  });

  // Regression: React Native's KeyboardAvoidingView measures itself against
  // the hide event too, whose screenY is the visible frame (screen minus both
  // bars), so it kept 78 of padding: a gap under "Don't have an account?".
  it("gives all the space back when the keyboard closes", () => {
    const { view } = renderAvoider();
    act(() => handlers.keyboardDidShow({ endCoordinates: { screenY: KEYBOARD_TOP, height: 292 } }));
    act(() => handlers.keyboardDidHide({ endCoordinates: { screenY: SCREEN_H - 30 - 48, height: 0 } }));
    expect(paddingOf(view)).toBe(0);
  });

  it("avoids a keyboard that was already up when it mounted", () => {
    Keyboard.isVisible.mockReturnValue(true);
    Keyboard.metrics.mockReturnValue({ screenY: KEYBOARD_TOP, height: 292 });
    const { view } = renderAvoider();
    fireEvent(view, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: SCREEN_H } } });
    expect(paddingOf(view)).toBe(SCREEN_H - KEYBOARD_TOP);
  });
});
