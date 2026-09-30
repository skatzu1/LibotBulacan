import React from "react";
import { ImageBackground, Text, StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthScaffold from "../components/AuthScaffold";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const renderScaffold = (props) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AuthScaffold title="Welcome" subtitle="Sign in to continue." {...props}>
        <Text>form</Text>
      </AuthScaffold>
    </SafeAreaProvider>,
  );

// Backgrounds of every rendered View, flattened.
const backgrounds = (tree) =>
  tree.UNSAFE_root.findAll((n) => n.props?.style)
    .map((n) => StyleSheet.flatten(n.props.style)?.backgroundColor)
    .filter(Boolean);

describe("AuthScaffold background", () => {
  it("login: bg.png fills the screen, no separate hero photo, see-through panel", () => {
    const bg = require("../assets/bg.png");
    const tree = renderScaffold({ background: bg });
    const images = tree.UNSAFE_getAllByType(ImageBackground);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toBe(bg);
    expect(backgrounds(tree)).toContain("rgba(168,233,242,0.88)");
    expect(tree.getByText("Welcome")).toBeTruthy();
  });

  it("other screens are unchanged: hero photo and solid panel", () => {
    const tree = renderScaffold({});
    const images = tree.UNSAFE_getAllByType(ImageBackground);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toBe(require("../assets/welcome.jpg"));
    expect(backgrounds(tree)).not.toContain("rgba(168,233,242,0.88)");
  });
});
