import React, { useState, Component } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import {
  ViroARSceneNavigator,
  ViroARScene,
  Viro3DObject,
  ViroNode,
  ViroAmbientLight,
  ViroSpotLight,
  ViroTrackingStateConstants,
  ViroARPlane,
} from "@reactvision/react-viro";

/* =========================================================
   AR SCENE (what the camera sees)
========================================================= */
class ARScene extends Component {
  state = {
    trackingStatus: "Initializing AR...",
    modelPlaced: false,
  };

  onTrackingUpdated = (state) => {
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      this.setState({ trackingStatus: "Move your phone to detect a surface..." });
    } else if (state === ViroTrackingStateConstants.TRACKING_LIMITED) {
      this.setState({ trackingStatus: "Tracking limited — move slowly..." });
    } else {
      this.setState({ trackingStatus: "Tracking lost..." });
    }
  };

  render() {
    return (
      <ViroARScene onTrackingUpdated={this.onTrackingUpdated}>
        <ViroAmbientLight color="#ffffff" intensity={200} />

        <ViroSpotLight
          innerAngle={5}
          outerAngle={90}
          direction={[0, -1, -0.2]}
          position={[0, 3, 1]}
          color="#ffffff"
          intensity={500}
        />

        <ViroARPlane alignment="Horizontal">
          <ViroNode scale={[0.3, 0.3, 0.3]} dragType="FixedToWorld">
            <Viro3DObject
              source={require("../assets/models/question_mark.glb")}
              type="GLB"
            />
          </ViroNode>
        </ViroARPlane>
      </ViroARScene>
    );
  }
}

/* =========================================================
   MAIN SCREEN
========================================================= */
export default function ARScreen({ navigation }) {  // ← Add navigation prop
  const [showInstructions, setShowInstructions] = useState(true);

  return (
    <View style={styles.container}>
      <ViroARSceneNavigator
        style={styles.arNavigator}
        initialScene={{ scene: ARScene }}
      />

      {showInstructions && (
        <View style={styles.hintOverlay}>
          <Text style={styles.hintText}>
            Point at a flat surface to place the object
          </Text>
          <TouchableOpacity 
            style={styles.dismissButton}
            onPress={() => setShowInstructions(false)}
          >
            <Text style={styles.dismissText}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  arNavigator: {
    flex: 1,
  },
  hintOverlay: {
    position: "absolute",
    top: 60,
    width: "100%",
    alignItems: "center",
  },
  hintText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  dismissButton: {
  marginTop: 10,
  backgroundColor: "rgba(107,75,69,0.9)",
  paddingHorizontal: 20,
  paddingVertical: 10,
  borderRadius: 20,
  },
  dismissText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
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
  }
});