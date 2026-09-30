import React from "react";
import { ImageBackground, ScrollView, Text, StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthScaffold from "../components/AuthScaffold";
import { ThemeProvider, lightColors, darkColors } from "../context/ThemeContext";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const BOTTOM_INSET = 34;
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: BOTTOM_INSET } };

// ThemeProvider renders nothing until it has read the saved preference, so
// wait for the title before looking at the tree.
const renderScaffold = async (props = {}, themePref) => {
  if (themePref) await AsyncStorage.setItem("libot_theme_pref", themePref);
  const tree = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <AuthScaffold title="Welcome" subtitle="Sign in to continue." {...props}>
          <Text>form</Text>
        </AuthScaffold>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await tree.findByText("Welcome");
  return tree;
};

// The View whose flattened style has this background colour.
const viewWithBackground = (tree, color) =>
  tree.UNSAFE_root.findAll((n) => n.props?.style && StyleSheet.flatten(n.props.style)?.backgroundColor === color)[0];

beforeEach(() => AsyncStorage.clear());

describe("AuthScaffold", () => {
  it("fills the screen with bg.png under the light veil and panel", async () => {
    const tree = await renderScaffold({}, "light");
    const images = tree.UNSAFE_getAllByType(ImageBackground);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toBe(require("../assets/bg.png"));
    expect(viewWithBackground(tree, lightColors.photoVeil)).toBeTruthy();
    expect(viewWithBackground(tree, lightColors.panelOverPhoto)).toBeTruthy();
  });

  it("follows dark mode", async () => {
    const tree = await renderScaffold({}, "dark");
    expect(viewWithBackground(tree, darkColors.photoVeil)).toBeTruthy();
    expect(viewWithBackground(tree, darkColors.panelOverPhoto)).toBeTruthy();
    expect(viewWithBackground(tree, lightColors.panelOverPhoto)).toBeUndefined();
  });

  it("uses a screen's own background when given one", async () => {
    const other = require("../assets/welcome.jpg");
    const tree = await renderScaffold({ background: other }, "light");
    expect(tree.UNSAFE_getByType(ImageBackground).props.source).toBe(other);
  });

  // Regression: the bottom inset used to be padding on the scroll content,
  // outside the panel, so a strip of photo showed under the last link.
  it("runs the panel to the bottom edge, with the inset inside it", async () => {
    const tree = await renderScaffold({}, "light");
    const panel = StyleSheet.flatten(viewWithBackground(tree, lightColors.panelOverPhoto).props.style);
    expect(panel.paddingBottom).toBe(BOTTOM_INSET + 24);
    expect(panel.flex).toBe(1);
    const content = StyleSheet.flatten(tree.UNSAFE_getByType(ScrollView).props.contentContainerStyle);
    expect(content.paddingBottom ?? 0).toBe(0);
    expect(content.flexGrow).toBe(1);
  });
});
