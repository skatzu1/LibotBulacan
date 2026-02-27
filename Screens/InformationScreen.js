import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useBookmark } from "../context/BookmarkContext";
import ModelViewer from "../utils/ModelViewer";

const { width } = Dimensions.get("window");

export default function InformationScreen({ route, navigation }) {
  const { spot } = route.params;
  const [activeTab, setActiveTab] = useState("Information");
  const [show3D, setShow3D] = useState(false);
  const { isBookmarked, toggleBookmark } = useBookmark();

  const spotIsBookmarked = isBookmarked(spot._id || spot.id);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={28} color="#4a4a4a" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => toggleBookmark(spot)}>
          <FontAwesome5
            name="bookmark"
            size={24}
            solid={spotIsBookmarked}
            color={spotIsBookmarked ? "#f4c542" : "#f7cfc9"}
          />
        </TouchableOpacity>
      </View>

      {/* MAIN CONTENT */}
      <View style={styles.content}>
        {/* TITLE */}
        <Text style={styles.title}>{spot.name}</Text>

        {/* IMAGE / 3D VIEW */}
        <View style={styles.imageContainer}>
          {show3D && spot.modelUrl ? (
            <ModelViewer url={spot.modelUrl} style={styles.image} />
          ) : (
            <Image source={{ uri: spot.image }} style={styles.image} />
          )}

          {spot.modelUrl && (
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setShow3D(!show3D)}
            >
              <MaterialCommunityIcons
                name={show3D ? "image" : "cube-scan"}
                size={18}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.toggleButtonText}>
                {show3D ? "View Photo" : "View 3D Model"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* TABS */}
        <View style={styles.tabsContainer}>
          {["History", "Information", "Recommendations"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText,
                ]}
              >
                {tab === "Recommendations" ? "Find recommendations" : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* INFO CARD */}
        <View style={styles.infoCard}>
          {activeTab === "Information" && (
            <>
              <Text style={styles.infoText}>
                Visiting Hours: {spot.visitingHours || "6am to 10pm"}
              </Text>
              <Text style={styles.infoText}>
                Entrance fee: {spot.entranceFee || "Free"}
              </Text>
              {spot.description && (
                <Text style={styles.descriptionText}>
                  {spot.description}
                </Text>
              )}
            </>
          )}

          {activeTab === "History" && (
            <Text style={styles.infoText}>
              {spot.history || "Historical information coming soon..."}
            </Text>
          )}

          {activeTab === "Recommendations" && (
            <Text style={styles.infoText}>
              {spot.recommendations || "Recommendations coming soon..."}
            </Text>
          )}
        </View>
      </View>

      {/* FIXED BOTTOM BUTTONS */}
      <View style={styles.bottomBar}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => navigation.navigate("ar", { spot })}
          >
            <Text style={styles.buttonText}>AR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => navigation.navigate("Track", { spot })}
          >
            <Feather name="map-pin" size={16} color="#fff" />
            <Text style={styles.buttonText}> Track</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => navigation.navigate("Reviews", { spot })}
          >
            <Text style={styles.buttonText}>Reviews</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.missionButton}
          onPress={() => navigation.navigate("Missions", { spot })}
        >
          <FontAwesome5 name="bullseye" size={16} color="#fff" />
          <Text style={styles.buttonText}> Start Mission</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 60,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },

  content: {
  flex: 1,
  paddingHorizontal: 20,
  paddingBottom: 1, // reduces gap before buttons
},

  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 15,
    color: "#1a1a1a",
  },

  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },

  image: {
    width: width * 0.85,
    height: 230,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
  },

  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4a3a3a",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 10,
  },

  toggleButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: "#d4a5a5",
    alignItems: "center",
  },

  activeTab: {
    backgroundColor: "#f7cfc9",
  },

  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4a4a4a",
  },

  activeTabText: {
    color: "#1a1a1a",
  },

  infoCard: {
    backgroundColor: "#f7cfc9",
    borderRadius: 20,
    padding: 18,
    minHeight: 130,
  },

  infoText: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    color: "#1a1a1a",
  },

  descriptionText: {
    fontSize: 14,
    marginTop: 8,
    color: "#2a2a2a",
    lineHeight: 20,
  },

  bottomBar: {
  paddingHorizontal: 20,
  paddingTop: 6,   // was 10–12
  paddingBottom: 50, // was 20
  backgroundColor: "#fff",
},

  buttonRow: {
    flexDirection: "row",
    marginBottom: 10,
  },

  smallButton: {
    flex: 1,
    backgroundColor: "#4a3a3a",
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    flexDirection: "row",
  },

  missionButton: {
    backgroundColor: "#6b4b45",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});