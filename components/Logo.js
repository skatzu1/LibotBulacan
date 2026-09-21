import React from "react";
import { Image } from "react-native";

// The Libot mark, rendered straight from assets/logo.png — the artwork is the
// source of truth, so there is no vector copy of it to keep in sync.
// `radius` only softens the corners for in-app use; the app icon and splash
// assets use the full-bleed square.

export default function Logo({ size = 72, radius = size * 0.24, style }) {
  return (
    <Image
      source={require("../assets/logo.png")}
      style={[{ width: size, height: size, borderRadius: radius }, style]}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Libot"
    />
  );
}
