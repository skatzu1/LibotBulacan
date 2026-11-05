import React from "react";
import { Image } from "react-native";

export default function Logo({ size = 72, radius = size * 0.24, style }) {
  return (
    <Image
      source={require("../assets/logo.png")}
      style={[{ width: size, height: size, borderRadius: radius }, style]}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="LibotBulacan"
    />
  );
}
