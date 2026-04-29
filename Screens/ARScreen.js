import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import Geolocation from "@react-native-community/geolocation";
import { Feather } from "@expo/vector-icons";
import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroARPlane,
  Viro3DObject,
  ViroNode,
  ViroText,
  ViroAmbientLight,
  ViroSpotLight,
  ViroAnimations,
} from "@reactvision/react-viro";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

/**
 * User must be within this distance of spot.modelsCoordinates
 * before plane detection activates.
 */
const MODEL_RADIUS_METERS = 20;

// ─────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────
ViroAnimations.registerAnimations({
  fadeIn: { properties: { opacity: 1 }, duration: 600 },
});

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────
// AR SCENE  (receives props via viroAppProps)
// ─────────────────────────────────────────────
const ModelOnPlane = ({ spot }) => {
  const [placed, setPlaced] = useState(false);

  return (
    <ViroARPlane
      minHeight={0.1}
      minWidth={0.1}
      alignment="Horizontal"
      onAnchorFound={() => setPlaced(true)}
    >
      {placed ? (
        <ViroNode position={[0, 0, 0]}>
          <ViroAmbientLight color="#ffffff" intensity={300} />
          <ViroSpotLight
            innerAngle={5}
            outerAngle={90}
            direction={[0, -1, -0.2]}
            position={[0, 3, 1]}
            color="#ffffff"
            castsShadow
          />
          <Viro3DObject
            source={{ uri: spot.AR3DModelURL }}
            type="GLB"
            scale={[0.1, 0.1, 0.1 ]}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            animation={{ name: "fadeIn", run: true }}
            onError={(e) =>
              console.warn(`[AR] Model load error "${spot.name}":`, e)
            }
          />
          <ViroText
            text={spot.name}
            position={[0, 0.65, 0]}
            scale={[0.4, 0.4, 0.4]}
            style={arStyles.label}
          />
        </ViroNode>
      ) : (
        <ViroText
          text={`Scanning surface…\n${spot.name}`}
          position={[0, 0, -1.5]}
          scale={[0.38, 0.38, 0.38]}
          style={arStyles.scanning}
        />
      )}
    </ViroARPlane>
  );
};

const ARScene = ({ sceneNavigator }) => {
  const { spot, isInsideRadius } = sceneNavigator.viroAppProps;

  return (
    <ViroARScene>
      {isInsideRadius ? (
        <ModelOnPlane spot={spot} />
      ) : (
        <ViroText
          text={`Walk closer to\n"${spot.name}"\nto see the AR model`}
          position={[0, 0, -2]}
          scale={[0.38, 0.38, 0.38]}
          style={arStyles.outOfRange}
        />
      )}
    </ViroARScene>
  );
};

const arStyles = {
  label: {
    fontFamily: "Arial",
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
    textAlignVertical: "center",
  },
  scanning: {
    fontFamily: "Arial",
    fontSize: 11,
    color: "#FBBF24",
    textAlign: "center",
    textAlignVertical: "center",
  },
  outOfRange: {
    fontFamily: "Arial",
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    textAlignVertical: "center",
  },
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

/**
 * Registered as screen "ar" in your navigator.
 * Receives: route.params.spot  (one spot object from your API)
 *
 * In ARSpotSelect you already do:
 *   navigation.navigate("ar", { spot: item })
 * — no changes needed there.
 */
export default function ARScreen({ route, navigation }) {
  const { spot } = route.params;

  const [userLocation, setUserLocation] = useState(null);
  const [isInsideRadius, setIsInsideRadius] = useState(false);
  const [distanceToModel, setDistanceToModel] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const watchId = useRef(null);

  useEffect(() => {
    const startWatch = () => {
      watchId.current = Geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          setUserLocation({ latitude, longitude, accuracy });

          const dist = distanceMeters(
            latitude,
            longitude,
            spot.modelsCoordinates.lat,
            spot.modelsCoordinates.lng
          );
          setDistanceToModel(Math.round(dist));
          setIsInsideRadius(dist <= MODEL_RADIUS_METERS);
          setLocationError(null);
        },
        (err) => setLocationError(err.message),
        {
          enableHighAccuracy: true,
          distanceFilter: 2,
          interval: 3000,
          fastestInterval: 1000,
        }
      );
    };

    const init = async () => {
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setLocationError("Location permission denied");
          return;
        }
      }
      startWatch();
    };

    init();
    return () => {
      if (watchId.current != null) Geolocation.clearWatch(watchId.current);
    };
  }, []);

  // ── HUD ─────────────────────────────────────
  const renderHUD = () => {
    if (locationError) {
      return (
        <View style={[styles.hud, styles.hudError]}>
          <Text style={styles.errorText}>⚠ {locationError}</Text>
        </View>
      );
    }

    if (!userLocation) {
      return (
        <View style={styles.hud}>
          <ActivityIndicator size="small" color="#60A5FA" />
          <Text style={styles.hudMuted}>  Acquiring GPS…</Text>
        </View>
      );
    }

    return (
      <View style={styles.hud}>
        <Text style={styles.spotName}>{spot.name}</Text>

        {isInsideRadius ? (
          <Text style={styles.hint}>🔍 Point camera at a flat surface</Text>
        ) : (
          <>
            <Text style={styles.hint}>
              Walk within {MODEL_RADIUS_METERS} m to activate AR
            </Text>
            <Text style={styles.distance}>
              📍 {distanceToModel ?? "…"} m away
            </Text>
          </>
        )}

        <Text style={styles.accuracy}>
          GPS ±{Math.round(userLocation.accuracy ?? 0)} m
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ViroARSceneNavigator
        initialScene={{ scene: ARScene }}
        viroAppProps={{ spot, isInsideRadius }}
        style={{ flex: 1 }}
      />

      {/* Back button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Feather name="arrow-left" size={20} color="#fff" />
      </TouchableOpacity>

      {renderHUD()}
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  hud: {
    position: "absolute",
    top: 44,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.60)",
    borderRadius: 14,
    padding: 14,
    gap: 5,
  },
  hudError: {
    backgroundColor: "rgba(185,28,28,0.80)",
  },
  errorText: {
    color: "#FEE2E2",
    fontSize: 13,
    fontWeight: "600",
  },
  hudMuted: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  spotName: {
    color: "#4ADE80",
    fontSize: 15,
    fontWeight: "700",
  },
  hint: {
    color: "#FCD34D",
    fontSize: 12,
    marginTop: 2,
  },
  distance: {
    color: "#93C5FD",
    fontSize: 13,
    fontWeight: "600",
  },
  accuracy: {
    color: "#4B5563",
    fontSize: 10,
    textAlign: "right",
    marginTop: 4,
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? 44 : 56,
    left: 16,
    zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    padding: 10,
  },
});