import React, { Component } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import {
  ViroARSceneNavigator,
  ViroARScene,
  ViroARPlane,
  Viro3DObject,
  ViroAmbientLight,
  ViroSpotLight,
  ViroNode,
} from "@reactvision/react-viro";

/* =========================================================
   AR SCENE
========================================================= */
class SimpleARScene extends Component {
  state = {
    planeFound: false,
    anchorPosition: null,
  };

  onAnchorFound = (anchor) => {
    console.log("Plane detected!", anchor);
    this.setState({
      planeFound: true,
      anchorPosition: anchor.position ?? [0, -0.5, -1.5],
    });
  };

  render() {
    const { planeFound, anchorPosition } = this.state;

    return (
      <ViroARScene>
        <ViroAmbientLight color="#ffffff" intensity={500} />
        <ViroSpotLight
          innerAngle={5}
          outerAngle={90}
          direction={[0, -1, -0.2]}
          position={[0, 3, 1]}
          color="#ffffff"
          intensity={1000}
        />

        {/* Once a plane is found, place the model at that plane's position */}
        {planeFound && anchorPosition && (
          <ViroNode position={anchorPosition}>
            <Viro3DObject
              source={require("../assets/models/question_mark.glb")}
              type="GLB"
              position={[0, 0, 0]}
              scale={[0.3, 0.3, 0.3]}
              rotation={[0, 0, 0]}
              onLoadStart={() => console.log("Loading model...")}
              onLoadEnd={() => console.log("Model loaded!")}
              onError={(e) => console.warn("Model error:", e)}
            />
          </ViroNode>
        )}

        {/* Keep scanning until a plane is found */}
        {!planeFound && (
          <ViroARPlane
            minHeight={0.1}
            minWidth={0.1}
            alignment="Horizontal"
            onAnchorFound={this.onAnchorFound}
          />
        )}
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
      <ViroARSceneNavigator
        style={styles.arNavigator}
        autofocus={true}
        worldAlignment="Gravity"
        initialScene={{ scene: SimpleARScene }}
      />

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Point your camera at a flat surface to reveal the 3D model
        </Text>
      </View>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  arNavigator: { flex: 1 },
  hint: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
  },
  hintText: { color: "white", fontSize: 15, textAlign: "center", lineHeight: 22 },
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
  backButtonText: { color: "white", fontSize: 28, fontWeight: "bold" },
});