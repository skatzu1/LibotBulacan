import React, { useState } from "react";
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroAnimations,
  ViroMaterials,
  Viro3DObject,
  ViroNode,
  ViroText,

  //Plan B
  //ViroARPlaneSelector,

  //GPS Anchor Try
  //ViroGeospatialPose,
} from "@reactvision/react-viro";

const InitialScene = () => {
  return (
    <ViroARScene>
      <ViroText
        text="Hello World"
        position={[0, -10, -3]}
        style={{ fontSize: 10, fontFamily: "Arial", color: "#FF0000" }}
      />
    </ViroARScene>
  );
};

export default function ARScreen() {
  return (
    <ViroARSceneNavigator
      initialScene={{
        scene: InitialScene,
      }}
      style={{ flex: 1 }}
    />
  );
}