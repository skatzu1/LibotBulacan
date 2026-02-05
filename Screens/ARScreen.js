/* =========================================================
   Line 216
   -AR Objects data
========================================================= */


/* =========================================================
   IMPORTS
========================================================= */
import React, { useState, useEffect, Component, useMemo } from "react";
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
  Viro3DObject,
  ViroNode,
  ViroAmbientLight,
  ViroSpotLight,
  ViroTrackingStateConstants,
} from "@reactvision/react-viro";
import * as Location from "expo-location";

/* =========================================================
   UTILITY: GPS DISTANCE (METERS)
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

/* =========================================================
   UTILITY: CONVERT GPS TO AR POSITION
   Calculates relative x,z position from user to object
   lakas ni claude
========================================================= */
function gpsToARPosition(userLat, userLon, userHeading, objLat, objLon) {
  const R = 6371e3; // Earth radius in meters
  
  // Convert to radians
  const φ1 = (userLat * Math.PI) / 180;
  const φ2 = (objLat * Math.PI) / 180;
  const Δλ = ((objLon - userLon) * Math.PI) / 180;
  
  // Calculate bearing (direction to object)
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let bearing = Math.atan2(y, x);
  
  // Calculate distance
  const distance = getDistance(userLat, userLon, objLat, objLon);
  
  // Adjust bearing relative to user's heading
  const relativeBearing = bearing - (userHeading * Math.PI / 180);
  
  // Convert to AR coordinates (x, z)
  // In AR: x is left/right, z is forward/back
  const arX = distance * Math.sin(relativeBearing);
  const arZ = -distance * Math.cos(relativeBearing); // negative because forward is -z
  
  return { x: arX, z: arZ, distance };
}

/* =========================================================
   COLLECTION ANIMATION
========================================================= */
function CollectionAnimation({ visible }) {
  const scale = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    scale.setValue(0);
    opacity.setValue(1);

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.collectionAnimation,
        { transform: [{ scale }], opacity },
      ]}
    >
      <Text style={styles.collectionText}>✨ Collected! ✨</Text>
    </Animated.View>
  );
}

/* =========================================================
   Camera Visoin
========================================================= */
class ARScene extends Component {
  state = {
    trackingStatus: "Initializing AR...",
    rotation: 0,
  };

  componentDidMount() {
    // rotation animation for objects
    this.rotationInterval = setInterval(() => {
      this.setState((prev) => ({
        rotation: (prev.rotation + 0.02) % (Math.PI * 2),
      }));
    }, 16);
  }

  componentWillUnmount() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
    }
  }

  onTrackingUpdated = (state) => {
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      this.setState({ trackingStatus: "AR Ready" });
    } else if (state === ViroTrackingStateConstants.TRACKING_LIMITED) {
      this.setState({ trackingStatus: "Move device slowly..." });
    } else {
      this.setState({ trackingStatus: "Tracking lost..." });
    }
  };

  render() {
  const {
    arPositions = [],
    collectedObjects = [],
    onCollect = () => {},
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
          intensity={500}
        />

        {/* AR objects will only display according to their uhh pag nasa loob ng data ng lugar kinginamo */}
        {arPositions.map((obj) => {

          if (collectedObjects.includes(obj.id)) return null;
/*-------------------Dito palitan distance (Distance between you and the object bago mag render)----------------------------*/
          if (obj.distance > 100) return null;

          return (
            <ViroNode
              key={obj.id}
              position={[obj.x, 0, obj.z]}
              scale={[0.3, 0.3, 0.3]}
              rotation={[0, this.state.rotation * (180 / Math.PI), 0]}
              onClick={() => onCollect(obj.id)}
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
      </ViroARScene>
    );
  }
}

/* =========================================================
   MAIN AR SCREEN
========================================================= */
export default function ARScreen({ navigation }) {
  const [showInstructions, setShowInstructions] = useState(true);
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [locationPermission, setLocationPermission] = useState(false);
  const [collectedObjects, setCollectedObjects] = useState([]);
  const [showCollection, setShowCollection] = useState(false);

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
        name: "etits",
        latitude: 14.842185253551245,
        longitude: 121.04589108833301,
        description: "bahay ko",
        collectRadius: 10,
      }
      // Add more objects here
    ],
    []
  );

  /* ---------------- CALCULATE AR POSITIONS ---------------- */
  const arPositions = useMemo(() => {
    if (!location) return [];

    return arObjects
      .filter((obj) => !collectedObjects.includes(obj.id))
      .map((obj) => {
        const distance = getDistance(
          location.latitude,
          location.longitude,
          obj.latitude,
          obj.longitude
        );

        const position = gpsToARPosition(
          location.latitude,
          location.longitude,
          heading,
          obj.latitude,
          obj.longitude
        );

        return {
          ...obj,
          ...position,
          distance,
          inRange: distance <= obj.collectRadius,
        };
      });
  }, [location, heading, arObjects, collectedObjects]);

  /* ---------------- NEARBY COLLECTIBLE OBJECTS ---------------- */
  const collectibleObjects = useMemo(() => {
    return arPositions.filter((obj) => obj.inRange);
  }, [arPositions]);

  const currentObject = collectibleObjects[0] ?? null;

  /* ---------------- NEAREST DISTANCE ---------------- */
  const nearestDistance = useMemo(() => {
    if (arPositions.length === 0) return null;
    const distances = arPositions.map((obj) => obj.distance);
    return Math.min(...distances);
  }, [arPositions]);

  /* ---------------- LOCATION TRACKING ---------------- */
  useEffect(() => {
    let locationSubscription = null;
    let headingSubscription = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationPermission(true);

        // Get initial location
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation.coords);

        // Watch location
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 1,
            timeInterval: 1000,
          },
          (loc) => {
            console.log("Location updated:", loc.coords);
            setLocation(loc.coords);
          }
        );

        // Watch heading (compass)
        headingSubscription = await Location.watchHeadingAsync((headingData) => {
          setHeading(headingData.trueHeading || headingData.magHeading);
        });
      }
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
      if (headingSubscription) headingSubscription.remove();
    };
  }, []);

  /* ---------------- COLLECT ---------------- */
  const handleCollect = (objectId) => {
    const obj = arObjects.find((o) => o.id === objectId);
    if (!obj) return;

    // Check if in range
    const objPosition = arPositions.find((p) => p.id === objectId);
    if (!objPosition || !objPosition.inRange) {
      Alert.alert("Too Far!", "Get closer to collect this object");
      return;
    }

    setCollectedObjects((prev) => [...prev, objectId]);
    setShowCollection(true);

    Alert.alert(
      "Item Collected 🎉",
      `${obj.name}\n\n${obj.description}`,
      [{ text: "OK", onPress: () => setShowCollection(false) }]
    );

    setTimeout(() => setShowCollection(false), 2000);
  };

  /* ---------------- PERMISSIONS CHECK ---------------- */
  if (!locationPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Location permission required for AR experience
        </Text>
      </View>
    );
  }

  /* ---------------- RENDER ---------------- */
  return (
    <View style={styles.container}>
      {/* AR Navigator */}
      <ViroARSceneNavigator
        style={styles.arNavigator}
        initialScene={{
          scene: ARScene,
        }}
        viroAppProps={{
          arPositions,
          collectedObjects,
          onCollect: handleCollect,
        }}
        autofocus={true}
      />

      {/* Instructions overlay */}
      {showInstructions && (
        <View style={styles.hintOverlay}>
          <Text style={styles.hintText}>
            {currentObject
              ? `${currentObject.name} nearby!\nLook around and tap the 3D object to collect`
              : "Move around to find hidden AR objects"}
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

      {/* Bottom info bar */}
      <View style={styles.bottomOverlay}>
        {currentObject ? (
          <View style={styles.objectInfo}>
            <Text style={styles.objectName}>
              📍 {currentObject.name} - {currentObject.distance.toFixed(1)}m away
            </Text>
            <Text style={styles.objectHint}>
              Look around and tap the object!
            </Text>
          </View>
        ) : (
          <Text style={styles.infoText}>
            {nearestDistance !== null
              ? `Nearest object: ${nearestDistance.toFixed(0)}m away`
              : collectedObjects.length === arObjects.length
              ? "🎉 All objects collected!"
              : "Searching for objects..."}
          </Text>
        )}

        {/* Stats */}
        <Text style={styles.statsText}>
          Collected: {collectedObjects.length}/{arObjects.length}
        </Text>
      </View>

      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      {/* Debug info (remove in production) */}
      {__DEV__ && location && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Lat: {location.latitude.toFixed(6)}
          </Text>
          <Text style={styles.debugText}>
            Lon: {location.longitude.toFixed(6)}
          </Text>
          <Text style={styles.debugText}>
            Heading: {heading.toFixed(0)}°
          </Text>
          {nearestDistance && (
            <Text style={styles.debugText}>
              Nearest: {nearestDistance.toFixed(1)}m
            </Text>
          )}
          <Text style={styles.debugText}>
            Visible: {arPositions.length}
          </Text>
        </View>
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
  hintOverlay: {
    position: "absolute",
    top: 60,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  hintText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    textAlign: "center",
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
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
  },
  objectInfo: {
    alignItems: "center",
    width: "100%",
  },
  objectName: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  objectHint: {
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "600",
  },
  infoText: {
    color: "white",
    fontSize: 16,
  },
  statsText: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 8,
  },
  permissionText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    padding: 20,
  },
  collectionAnimation: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    backgroundColor: "gold",
    padding: 25,
    borderRadius: 20,
    zIndex: 10,
  },
  collectionText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  debugInfo: {
    position: "absolute",
    top: 100,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderRadius: 5,
  },
  debugText: {
    color: "lime",
    fontSize: 12,
    fontFamily: "monospace",
  },
});