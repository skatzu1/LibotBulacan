/* =========================================================
<<<<<<< HEAD
   Line 250
   -AR Objects data
=======
   ARScreen.js

   HOW IT WORKS:
   - Each AR object has a GPS position and a collectRadius
   - Objects are INVISIBLE until the user walks within collectRadius
   - Once in range, a ViroARPlane begins scanning for a flat surface
     AT that object's AR position
   - Only when BOTH conditions are true (in range + plane found)
     does the 3D model appear on the surface
   - User can then face the object and tap COLLECT
>>>>>>> d292da0dc2c052c418600c7069e4e1defc45555e
========================================================= */

import React, { useState, useEffect, Component, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";
import {
  ViroARSceneNavigator,
  ViroARScene,
  ViroARPlane,
  Viro3DObject,
  ViroNode,
  ViroAmbientLight,
  ViroSpotLight,
  ViroTrackingStateConstants,
} from "@reactvision/react-viro";
import * as Location from "expo-location";

/* =========================================================
   UTILITY FUNCTIONS
========================================================= */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

<<<<<<< HEAD
/* =========================================================
   UTILITY: CONVERT GPS TO AR POSITION
   Calculates relative x,z position from user to object
   lakas ni claude
========================================================= */
=======
>>>>>>> d292da0dc2c052c418600c7069e4e1defc45555e
function gpsToARPosition(userLat, userLon, userHeading, objLat, objLon) {
  const φ1 = (userLat * Math.PI) / 180;
  const φ2 = (objLat * Math.PI) / 180;
  const Δλ = ((objLon - userLon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const bearing = Math.atan2(y, x);
  const distance = getDistance(userLat, userLon, objLat, objLon);
<<<<<<< HEAD
  
  // Adjust bearing relative to user's heading
  const relativeBearing = bearing - (userHeading * Math.PI / 180);
  
  // Convert to AR coordinates (x, z)
  // In AR: x is left/right, z is forward/back
  const arX = distance * Math.sin(relativeBearing);
  const arZ = -distance * Math.cos(relativeBearing); // negative because forward is -z
  
  return { x: arX, z: arZ, distance };
=======
  const relativeBearing = bearing - (userHeading * Math.PI) / 180;
  const renderDistance = Math.min(distance, 10);
  return {
    x: renderDistance * Math.sin(relativeBearing),
    z: -renderDistance * Math.cos(relativeBearing),
    distance,
  };
>>>>>>> d292da0dc2c052c418600c7069e4e1defc45555e
}

function getBearingToObject(userLat, userLon, objLat, objLon) {
  const φ1 = (userLat * Math.PI) / 180;
  const φ2 = (objLat * Math.PI) / 180;
  const Δλ = ((objLon - userLon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function isFacingObject(userHeading, objectBearing, threshold = 30) {
  let diff = Math.abs(userHeading - objectBearing);
  if (diff > 180) diff = 360 - diff;
  return diff <= threshold;
}

/* =========================================================
   COLLECTION ANIMATION
========================================================= */
function CollectionAnimation({ visible }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    opacity.setValue(1);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View style={[styles.collectionAnimation, { transform: [{ scale }], opacity }]}>
      <Text style={styles.collectionText}>✨ Collected! ✨</Text>
    </Animated.View>
  );
}

/* =========================================================
   AR OBJECT NODE
   Renders ONE object's plane + 3D model.

   Props:
     obj         — the AR object data (id, x, z, inRange, etc.)
     collected   — bool, whether this object is already collected
     onPlaneFound(id) — callback when plane is detected for this obj
     planeFound  — bool passed from parent, true once plane detected
========================================================= */
class ARObjectNode extends Component {
  onAnchorFound = () => {
    console.log(`Plane found for object ${this.props.obj.id}`);
    this.props.onPlaneFound(this.props.obj.id);
  };

<<<<<<< HEAD
  componentDidMount() {
    // rotation animation for objects
    this.rotationInterval = setInterval(() => {
      this.setState((prev) => ({
        rotation: (prev.rotation + 0.02) % (Math.PI * 2),
      }));
    }, 16);
  }
=======
  render() {
    const { obj, collected, planeFound } = this.props;
>>>>>>> d292da0dc2c052c418600c7069e4e1defc45555e

    // Gate 1: skip if collected
    if (collected) return null;

    // Gate 2: skip if user is NOT within collectRadius
    if (!obj.inRange) return null;

    return (
      /*
        ViroNode positions the plane scanner at the object's
        GPS-calculated AR coordinates (x, z).
        y = 0 means ground level relative to the AR world origin.
      */
      <ViroNode position={[obj.x, 0, obj.z]}>
        {/*
          ViroARPlane scans for a horizontal surface at this position.
          - Only activates when the parent ViroNode is rendered
            (i.e. user is already within collectRadius)
          - onAnchorFound fires once a valid plane is locked
          - minHeight/minWidth: ignore tiny or noisy surfaces
        */}
        <ViroARPlane
          minHeight={0.1}
          minWidth={0.1}
          alignment="Horizontal"
          onAnchorFound={this.onAnchorFound}
        >
          {/*
            Gate 3: only show the 3D model once a plane is confirmed.
            The model sits ON the plane surface (position [0,0,0]
            inside ViroARPlane = the plane's anchor point).
          */}
          {planeFound && (
            <Viro3DObject
              source={require("../assets/models/question_mark.glb")}
              type="GLB"
              position={[0, 0, 0]}
              scale={[0.3, 0.3, 0.3]}
              // Draggable along the plane surface
              dragType="FixedToPlane"
              dragPlane={{
                planePoint: [0, 0, 0],
                planeNormal: [0, 1, 0], // horizontal
                maxDistance: 1,
              }}
              onLoadStart={() => console.log(`Loading model for obj ${obj.id}`)}
              onLoadEnd={() => console.log(`Model loaded for obj ${obj.id}`)}
              onError={(e) => console.warn(`Model error obj ${obj.id}:`, e)}
            />
          )}
        </ViroARPlane>
      </ViroNode>
    );
  }
}

/* =========================================================
   MAIN AR SCENE
   Single scene — no mode switching.
   Passes each in-range object to ARObjectNode.
========================================================= */
class ARScene extends Component {
  onTrackingUpdated = (state) => {
    const cb = this.props.sceneNavigator?.viroAppProps?.onTrackingUpdated;
    if (cb) cb(state);
  };

  render() {
    const {
      arPositions = [],
      collectedObjects = [],
      planesFound = {},
      onPlaneFound,
    } = this.props.sceneNavigator?.viroAppProps || {};

    return (
      <ViroARScene onTrackingUpdated={this.onTrackingUpdated}>
        <ViroAmbientLight color="#ffffff" intensity={300} />
        <ViroSpotLight
          innerAngle={5}
          outerAngle={90}
          direction={[0, -1, -0.2]}
          position={[0, 3, 1]}
          color="#ffffff"
          intensity={800}
        />

<<<<<<< HEAD
        {/* AR objects will only display according to their uhh pag nasa loob ng data ng lugar kinginamo */}
        {arPositions.map((obj) => {

          if (collectedObjects.includes(obj.id)) return null;
/*-------------------Dito palitan distance (Distance between you and the object bago mag render)----------------------------*/
          if (obj.distance > 20) return null;
// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
          return (
            <ViroNode
              key={obj.id}
              position={[obj.x, -1.5, obj.z]}
              scale={[0.5, 0.5, 0.5]}
              rotation={[0, this.state.rotation * (180 / Math.PI), 0]}
              transformBehaviors={["billboardY"]}
            >
              <Viro3DObject
                source={require("../assets/models/question_mark.glb")}
                type="GLB"
                position={[0, 0, 0]}
                onLoadStart={() => console.log(`Loading object ${obj.id}...`)}
                onLoadEnd={() => console.log(`Object ${obj.id} loaded!`)}
                onError={(error) => console.log(`Object ${obj.id} error:`, error)}
              />
            </ViroNode>
          );
        })}
=======
        {arPositions.map((obj) => (
          <ARObjectNode
            key={obj.id}
            obj={obj}
            collected={collectedObjects.includes(obj.id)}
            planeFound={!!planesFound[obj.id]}
            onPlaneFound={onPlaneFound}
          />
        ))}
>>>>>>> d292da0dc2c052c418600c7069e4e1defc45555e
      </ViroARScene>
    );
  }
}

/* =========================================================
   MAIN AR SCREEN
========================================================= */
export default function ARScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [locationPermission, setLocationPermission] = useState(false);
  const [collectedObjects, setCollectedObjects] = useState([]);
  const [showCollection, setShowCollection] = useState(false);
  const [targetObject, setTargetObject] = useState(null);
  const [showInstructions, setShowInstructions] = useState(true);
  // planesFound: { [objectId]: true } — tracks which objects have a plane
  const [planesFound, setPlanesFound] = useState({});

<<<<<<< HEAD
  /* ---------------- Example Data nigga ---------------- */
  const arObjects = useMemo(
    () => [
      {
        id: 1,
        name: "Historic Marker",
        latitude: 14.813330703468642,
        longitude: 121.03685068219062,
        description: "Found at Barasoain Church",
        collectRadius: 10,
      },
      {
        id: 2,
        name: "Mystery Box",
        latitude: 14.813430703468642,
        longitude: 121.03695068219062,
        description: "Hidden treasure near the plaza",
        collectRadius: 10,
      },
      {
        id: 3,
        name: "Wild Jeff",
        latitude: 14.842125,
        longitude: 121.045882,
        description: "Hidden treasure of STI",
        collectRadius: 20,
      },
      {
        id: 4,
        name: "Test",
        latitude: 14.779107,
        longitude: 121.074327,
        description: "Hidden treasure of STI",
        collectRadius: 10,
      },
      // Add more objects here
    ],
    []
  );
=======
  /* ---------------- AR Objects Data ---------------- */
  const arObjects = useMemo(() => [
    {
      id: 1,
      name: "Historic Marker",
      latitude: 14.813330703468642,
      longitude: 121.03685068219062,
      description: "Found at Barasoain Church",
      collectRadius: 10,
    },
    {
      id: 2,
      name: "Mystery Box",
      latitude: 14.813430703468642,
      longitude: 121.03695068219062,
      description: "Hidden treasure near the plaza",
      collectRadius: 10,
    },
    {
      id: 3,
      name: "Wild Jeff",
      latitude: 14.842125,
      longitude: 121.045882,
      description: "Hidden treasure of STI",
      collectRadius: 20,
    },
    {
      id: 4,
      name: "Wild Grey",
      latitude: 14.779076,
      longitude: 121.07449,
      description: "Hidden treasure of STI",
      collectRadius: 10,
    },
  ], []);
>>>>>>> d292da0dc2c052c418600c7069e4e1defc45555e

  /* ---------------- CALCULATE AR POSITIONS ---------------- */
  const arPositions = useMemo(() => {
    if (!location) return [];
    return arObjects
      .filter((obj) => !collectedObjects.includes(obj.id))
      .map((obj) => {
        const distance = getDistance(
          location.latitude, location.longitude,
          obj.latitude, obj.longitude
        );
        const position = gpsToARPosition(
          location.latitude, location.longitude,
          heading, obj.latitude, obj.longitude
        );
        const bearing = getBearingToObject(
          location.latitude, location.longitude,
          obj.latitude, obj.longitude
        );
        const facing = isFacingObject(heading, bearing, 30);
        return {
          ...obj,
          ...position,
          distance,
          bearing,
          facing,
          // inRange = user is close enough to activate plane scanning + collect
          inRange: distance <= obj.collectRadius,
        };
      });
  }, [location, heading, arObjects, collectedObjects]);

  // Objects within range that user is also facing → collectable
  const targetableObject = useMemo(
    () => arPositions.find((o) => o.inRange && o.facing && planesFound[o.id]) ?? null,
    [arPositions, planesFound]
  );

  // Nearest in-range object (for bottom bar hint)
  const currentObject = useMemo(
    () => arPositions.find((o) => o.inRange) ?? null,
    [arPositions]
  );

  const nearestDistance = useMemo(() => {
    if (!arPositions.length) return null;
    return Math.min(...arPositions.map((o) => o.distance));
  }, [arPositions]);

  useEffect(() => { setTargetObject(targetableObject); }, [targetableObject]);

  /* ---------------- PLANE FOUND CALLBACK ---------------- */
  // Called by ARObjectNode when its ViroARPlane detects a surface
  const handlePlaneFound = (objectId) => {
    setPlanesFound((prev) => ({ ...prev, [objectId]: true }));
  };

  /* ---------------- LOCATION TRACKING ---------------- */
  useEffect(() => {
    let locationSub = null;
    let headingSub = null;
    let lastHeading = 0;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      setLocationPermission(true);

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setLocation(loc.coords);

      locationSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 0.5,
          timeInterval: 1000,
        },
        (l) => setLocation(l.coords)
      );

      headingSub = await Location.watchHeadingAsync((h) => {
        const newH = h.trueHeading ?? h.magHeading;
        if (Math.abs(newH - lastHeading) > 2) {
          setHeading(newH);
          lastHeading = newH;
        }
      });
    })();

    return () => {
      locationSub?.remove();
      headingSub?.remove();
    };
  }, []);

  /* ---------------- COLLECT ---------------- */
  const handleCollect = () => {
    if (!targetObject) return;
    const obj = arObjects.find((o) => o.id === targetObject.id);
    if (!obj) return;

    setCollectedObjects((prev) => [...prev, targetObject.id]);
    setShowCollection(true);

    Alert.alert("Item Collected 🎉", `${obj.name}\n\n${obj.description}`, [
      { text: "OK", onPress: () => setShowCollection(false) },
    ]);

    setTimeout(() => setShowCollection(false), 2000);
  };

  /* ---------------- PERMISSION GATE ---------------- */
  if (!locationPermission) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.permissionText}>
          📍 Location permission required for AR experience.
        </Text>
      </View>
    );
  }

  /* ---------------- STATUS MESSAGE ---------------- */
  // Tells user what's happening at each stage
  const getStatusMessage = () => {
    if (!currentObject) {
      if (collectedObjects.length === arObjects.length) return "🎉 All objects collected!";
      return nearestDistance !== null
        ? `Nearest object: ${nearestDistance.toFixed(0)}m away`
        : "Searching for objects...";
    }
    if (!planesFound[currentObject.id]) {
      return `🔍 ${currentObject.name} nearby!\nPoint camera at a flat surface to reveal it`;
    }
    if (!currentObject.facing) {
      return `✨ ${currentObject.name} appeared!\nFace the object to collect it`;
    }
    return `✅ Ready to collect ${currentObject.name}!`;
  };

  /* ---------------- RENDER ---------------- */
  return (
    <View style={styles.container}>
      <ViroARSceneNavigator
        style={styles.arNavigator}
        autofocus={true}
        worldAlignment="GravityAndHeading"
        initialScene={{ scene: ARScene }}
        viroAppProps={{
          arPositions,
          collectedObjects,
          planesFound,
          onPlaneFound: handlePlaneFound,
          onTrackingUpdated: () => {},
        }}
      />

      {/* Instructions banner */}
      {showInstructions && (
        <View style={styles.hintOverlay}>
          <Text style={styles.hintText}>
            Walk to a marked location, then point your camera at a flat surface to reveal hidden objects
          </Text>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => setShowInstructions(false)}
          >
            <Text style={styles.dismissText}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Collection animation */}
      <CollectionAnimation visible={showCollection} />

      {/* Collect button — only when facing a plane-confirmed in-range object */}
      {targetObject && (
        <View style={styles.collectButtonContainer}>
          <TouchableOpacity style={styles.collectButton} onPress={handleCollect}>
            <Text style={styles.collectButtonText}>COLLECT</Text>
            <Text style={styles.collectButtonSubtext}>{targetObject.name}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom status bar */}
      <View style={styles.bottomOverlay}>
        <Text style={styles.statusText}>{getStatusMessage()}</Text>
        <Text style={styles.statsText}>
          Collected: {collectedObjects.length}/{arObjects.length}
        </Text>
      </View>

      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      {/* Debug overlay (DEV only) */}
      {__DEV__ && location && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>Lat: {location.latitude.toFixed(6)}</Text>
          <Text style={styles.debugText}>Lon: {location.longitude.toFixed(6)}</Text>
          <Text style={styles.debugText}>Heading: {heading.toFixed(0)}°</Text>
          {nearestDistance != null && (
            <Text style={styles.debugText}>Nearest: {nearestDistance.toFixed(1)}m</Text>
          )}
          <Text style={styles.debugText}>
            In range: {arPositions.filter((o) => o.inRange).length}
          </Text>
          <Text style={styles.debugText}>
            Planes: {Object.keys(planesFound).join(", ") || "none"}
          </Text>
          {targetObject && (
            <>
              <Text style={styles.debugText}>--- Target ---</Text>
              <Text style={styles.debugText}>ID: {targetObject.id}</Text>
              <Text style={styles.debugText}>X: {targetObject.x.toFixed(2)}</Text>
              <Text style={styles.debugText}>Z: {targetObject.z.toFixed(2)}</Text>
              <Text style={styles.debugText}>
                Facing: {targetObject.facing ? "YES" : "NO"}
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  centered: { justifyContent: "center", alignItems: "center" },
  arNavigator: { flex: 1 },

  hintOverlay: {
    position: "absolute",
    top: 60,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 100,
  },
  hintText: {
    color: "white",
    fontSize: 15,
    fontWeight: "bold",
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    textAlign: "center",
    lineHeight: 22,
  },
  dismissButton: {
    marginTop: 10,
    backgroundColor: "rgba(107,75,69,0.9)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  dismissText: { color: "white", fontSize: 14, fontWeight: "600" },

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
    zIndex: 300,
  },
  backButtonText: { color: "white", fontSize: 28, fontWeight: "bold" },

  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    zIndex: 100,
  },
  statusText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
  },
  statsText: { color: "#aaa", fontSize: 14, marginTop: 8 },
  permissionText: { color: "white", fontSize: 16, textAlign: "center", padding: 20 },

  collectionAnimation: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    backgroundColor: "gold",
    padding: 25,
    borderRadius: 20,
    zIndex: 10,
  },
  collectionText: { color: "white", fontSize: 22, fontWeight: "bold" },

  collectButtonContainer: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    zIndex: 100,
  },
  collectButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 50,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    borderWidth: 3,
    borderColor: "#fff",
  },
  collectButtonText: { color: "white", fontSize: 24, fontWeight: "bold", letterSpacing: 2 },
  collectButtonSubtext: { color: "white", fontSize: 14, marginTop: 4, opacity: 0.9 },

  debugInfo: {
    position: "absolute",
    top: 100,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 10,
    borderRadius: 5,
    zIndex: 200,
  },
  debugText: { color: "lime", fontSize: 11, fontFamily: "monospace" },
});