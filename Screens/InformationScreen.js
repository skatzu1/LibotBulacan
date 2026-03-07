import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useBookmark } from "../context/BookmarkContext";
import ModelViewer from "../utils/ModelViewer";

const { width } = Dimensions.get("window");

export default function InformationScreen({ route, navigation }) {
  const { spot } = route.params;
  const [activeTab, setActiveTab] = useState("Information");
  const [show3D, setShow3D]       = useState(false);
  const { isBookmarked, toggleBookmark } = useBookmark();

  const spotIsBookmarked = isBookmarked(spot._id || spot.id);

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Feather name="chevron-left" size={26} color="#4a2e2c" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => toggleBookmark(spot)} style={styles.headerButton}>
          <FontAwesome5
            name="bookmark"
            size={22}
            solid={spotIsBookmarked}
            color={spotIsBookmarked ? "#f4c542" : "#d9b8b5"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Title */}
        <Text style={styles.title}>{spot.name}</Text>

        {/* Image / 3D view */}
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
              activeOpacity={0.85}
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

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {["History", "Information", "Recommendations"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab === "Recommendations" ? "Tips" : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          {activeTab === "Information" && (
            <>
              <View style={styles.infoRow}>
                <Feather name="clock" size={15} color="#6b4b45" />
                <Text style={styles.infoText}>
                  {spot.visitingHours || "6am to 10pm"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Feather name="tag" size={15} color="#6b4b45" />
                <Text style={styles.infoText}>
                  {spot.entranceFee || "Free"}
                </Text>
              </View>
              {spot.description && (
                <Text style={styles.descriptionText}>{spot.description}</Text>
              )}
            </>
          )}

          {activeTab === "History" && (
            <Text style={styles.descriptionText}>
              {spot.history || "Historical information coming soon..."}
            </Text>
          )}

          {activeTab === "Recommendations" && (
            <Text style={styles.descriptionText}>
              {spot.recommendations || "Recommendations coming soon..."}
            </Text>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed bottom buttons */}
      <View style={styles.bottomBar}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => navigation.navigate("ar", { spot })}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="camera" size={15} color="#fff" />
              <Text style={[styles.buttonText, { marginLeft: 6 }]}>AR</Text>
              </View>

          </TouchableOpacity>

          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => navigation.navigate("Track", { spot })}
            activeOpacity={0.85}
          >
            <Feather name="map-pin" size={15} color="#fff" />
            <Text style={styles.buttonText}> Track</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => navigation.navigate("Reviews", { spot })}
            activeOpacity={0.85}
          >
            <Feather name="star" size={15} color="#fff" />
            <Text style={styles.buttonText}> Reviews</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.missionButton}
          onPress={() => navigation.navigate("Missions", { spot })}
          activeOpacity={0.85}
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
    paddingTop: 50,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  scrollContent: { paddingHorizontal: 20 },

  // ── Title ──
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
    color: "#4a2e2c",
  },

  // ── Image ──
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  image: {
    width: width * 0.9,
    height: 230,
    borderRadius: 20,
    backgroundColor: "#e8d0ce",
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6b4b45",
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

  // ── Tabs ──
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#faf5f4",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0e0de",
  },
  activeTab: {
    backgroundColor: "#6b4b45",
    borderColor: "#6b4b45",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7a5a58",
  },
  activeTabText: {
    color: "#fff",
  },

  // ── Info card ──
  infoCard: {
    backgroundColor: "#faf5f4",
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#f0e0de",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4a2e2c",
  },
  descriptionText: {
    fontSize: 14,
    color: "#7a5a58",
    lineHeight: 21,
    marginTop: 8,
  },

  // ── Bottom bar ──
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f0e0de",
  },
  buttonRow: {
    flexDirection: "row",
    marginBottom: 10,
    gap: 8,
  },
  smallButton: {
    flex: 1,
    backgroundColor: "#6b4b45",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  missionButton: {
    backgroundColor: "#4a2e2c",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});