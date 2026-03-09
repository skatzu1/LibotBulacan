/* =========================================================
   SimpleARScreen.js

   A minimal AR screen that just places a 3D model in front
   of the user using ViroARPlane for surface detection.
   No GPS, no collecting, no logic — just AR + model.
========================================================= */

import React, { Component } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import {
  ViroARSceneNavigator,
  ViroARScene,
  ViroARPlane,
  Viro3DObject,
  ViroAmbientLight,
  ViroSpotLight,
} from "@reactvision/react-viro";

/* =========================================================
   AR SCENE
   - Waits for a flat surface (ViroARPlane)
   - Once found, renders the 3D model on it
========================================================= */
class SimpleARScene extends Component {
  state = {
    planeFound: false,
  };

  onAnchorFound = () => {
    console.log("Plane detected!");
    this.setState({ planeFound: true });
  };

  render() {
    const { planeFound } = this.state;

    return (
      <ViroARScene>
        {/* Lighting */}
        <ViroAmbientLight color="#ffffff" intensity={300} />
        <ViroSpotLight
          innerAngle={5}
          outerAngle={90}
          direction={[0, -1, -0.2]}
          position={[0, 3, 1]}
          color="#ffffff"
          intensity={800}
        />

        {/* Plane detector — scans for a flat horizontal surface */}
        <ViroARPlane
          minHeight={0.1}
          minWidth={0.1}
          alignment="Horizontal"
          onAnchorFound={this.onAnchorFound}
        >
          {/* Only render the model once a plane is found */}
          {planeFound && (
            <Viro3DObject
              source={require("../assets/models/question_mark.glb")}
              type="GLB"
              position={[0, 0, 0]}
              scale={[0.3, 0.3, 0.3]}
              onLoadStart={() => console.log("Loading model...")}
              onLoadEnd={() => console.log("Model loaded!")}
              onError={(e) => console.warn("Model error:", e)}
            />
          )}
        </ViroARPlane>
      </ViroARScene>
    );
  }
}

/* =========================================================
   MAIN SCREEN
========================================================= */
export default function SimpleARScreen({ navigation }) {
  return (
    <View style={styles.container}>
      {/* AR View */}
      <ViroARSceneNavigator
        style={styles.arNavigator}
        autofocus={true}
        worldAlignment="Gravity"
        initialScene={{ scene: SimpleARScene }}
      />

      {/* Hint */}
      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Point your camera at a flat surface to reveal the 3D model
        </Text>
      </View>

      {/* Back button */}
      {navigation && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  arNavigator: {
    flex: 1,
  },
  hint: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
  },
  hintText: {
    color: "white",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
  },
});