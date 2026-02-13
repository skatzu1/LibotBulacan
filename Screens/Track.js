import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";

const { width, height } = Dimensions.get("window");

export default function Track({ route, navigation }) {
  const { spot } = route.params;

  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spotData, setSpotData] = useState(null);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    fetchSpotData();
  }, [spot._id]);

  const fetchSpotData = async () => {
    try {
      setLoading(true);
      const response = await fetch("https://libotbackend.onrender.com/api/spots");
      const data = await response.json();
      
      if (data.success) {
        const foundSpot = data.spots.find(s => s._id === spot._id);
        if (foundSpot) {
          console.log("Found spot:", foundSpot);
          setSpotData(foundSpot);
        } else {
          Alert.alert("Error", "Spot not found");
          setSpotData(spot);
        }
      }
    } catch (error) {
      console.error("Error fetching spot data:", error);
      Alert.alert("Error", "Could not load spot details");
      setSpotData(spot);
    }
  };

  useEffect(() => {
    if (spotData) {
      getLocation();
    }
  }, [spotData]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow location access to use navigation."
        );
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setMapKey(prev => prev + 1);
      setLoading(false);
    } catch (error) {
      console.error("Location error:", error);
      Alert.alert("Error", "Unable to get your location. Please try again.");
      setLoading(false);
    }
  };

  if (loading || !spotData || !userLocation) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#8b4440" />
        <Text style={styles.loadingText}>
          {!spotData ? "Loading spot data..." : "Getting your location..."}
        </Text>
      </View>
    );
  }
  
//optional lang to ===================
  if (!spotData.coordinates || !spotData.coordinates.lat || !spotData.coordinates.lng) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Location coordinates not available for this spot</Text>
        <TouchableOpacity 
          style={styles.backButtonError}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const destLat = spotData.coordinates.lat;
  const destLng = spotData.coordinates.lng;
  const userLat = userLocation.latitude;
  const userLng = userLocation.longitude;

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, sans-serif;
        }
        #map {
          width: 100%;
          height: 100vh;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
      <script>
        const map = L.map('map').setView([${(userLat + destLat) / 2}, ${(userLng + destLng) / 2}], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        // User location marker (blue)
        const userIcon = L.divIcon({
          html: '<div style="background: #4285F4; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
          className: '',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        L.marker([${userLat}, ${userLng}], { icon: userIcon })
          .addTo(map)
          .bindPopup('Your Location');

        // Destination marker (red)
        const destIcon = L.divIcon({
          html: '<div style="background: #8b4440; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
          className: '',
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        });

        L.marker([${destLat}, ${destLng}], { icon: destIcon })
          .addTo(map)
          .bindPopup('${spotData.name.replace(/'/g, "\\'")}');

        // Add routing
        L.Routing.control({
          waypoints: [
            L.latLng(${userLat}, ${userLng}),
            L.latLng(${destLat}, ${destLng})
          ],
          router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
          }),
          lineOptions: {
            styles: [{ color: '#8b4440', weight: 5, opacity: 0.7 }]
          },
          createMarker: function() { return null; },
          addWaypoints: false,
          routeWhileDragging: false,
          show: false,
          fitSelectedRoutes: true
        }).addTo(map);

        const bounds = L.latLngBounds(
          [${userLat}, ${userLng}],
          [${destLat}, ${destLng}]
        );
        map.fitBounds(bounds, { padding: [80, 80] });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        key={mapKey}
        originWhitelist={["*"]}
        source={{ html: mapHTML }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {spotData.name}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  map: {
    flex: 1,
    width: width,
    height: height,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7cfc9",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#4a4a4a",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
    color: "#8b4440",
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  backButtonError: {
    marginTop: 20,
    backgroundColor: "#8b4440",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "rgba(139, 68, 64, 0.95)",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 20,
  },
  headerContent: {
    flex: 1,
    marginHorizontal: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  placeholder: {
    width: 40,
  },
});