import React, { useState } from "react";
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Dimensions 
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useBookmark } from "../context/BookmarkContext";
import { FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get("window");

export default function InformationScreen({ route, navigation }) {
  const { spot } = route.params;
  const [activeTab, setActiveTab] = useState("Information");
  const { isBookmarked, toggleBookmark } = useBookmark();

  console.log('InformationScreen - Spot data:', {
    name: spot.name,
    id: spot.id,
    _id: spot._id,
    allKeys: Object.keys(spot)
  });

  const spotIsBookmarked = isBookmarked(spot._id || spot.id);

  const handleBookmarkPress = () => {
    console.log('=== BOOKMARK BUTTON PRESSED ===');
    console.log('Spot being bookmarked:', {
      name: spot.name,
      id: spot.id,
      _id: spot._id,
      spotIsBookmarked: spotIsBookmarked
    });
    toggleBookmark(spot);
  };

  const handleTrackPress = () => {
    console.log('Track pressed - Navigating to MapScreen with:', spot.name);
    navigation.navigate("MapScreen", { spot });
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={28} color="#4a4a4a" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.bookmarkButton}
          onPress={handleBookmarkPress}
        >
          <FontAwesome5
            name="bookmark"
            size={24}
            solid={spotIsBookmarked}
            color={spotIsBookmarked ? "#f4c542" : "#f7cfc9"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* TITLE */}
        <Text style={styles.title}>{spot.name}</Text>

        {/* IMAGE */}
        <View style={styles.imageContainer}>
          <Image
            source={{ 
              uri: spot.image,
              cache: 'force-cache'
            }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>

        {/* TABS */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "History" && styles.activeTab]}
            onPress={() => setActiveTab("History")}
          >
            <Text style={[styles.tabText, activeTab === "History" && styles.activeTabText]}>
              History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "Information" && styles.activeTab]}
            onPress={() => setActiveTab("Information")}
          >
            <Text style={[styles.tabText, activeTab === "Information" && styles.activeTabText]}>
              Information
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "Recommendations" && styles.activeTab]}
            onPress={() => setActiveTab("Recommendations")}
          >
            <Text style={[styles.tabText, activeTab === "Recommendations" && styles.activeTabText]}>
              Find recommendations
            </Text>
          </TouchableOpacity>
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
                <Text style={styles.descriptionText}>{spot.description}</Text>
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

        {/* BOTTOM BUTTONS ROW */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.arButton}
            onPress={() => navigation.navigate("ar", { spot })}
          >
            <Text style={styles.buttonText}>AR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => navigation.navigate("Track", { spot })}
          >
            <Feather name="map-pin" size={18} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.buttonText}>Track</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reviewsButton}
            onPress={() => navigation.navigate("Reviews", { spot })}
          >
            <Text style={styles.buttonText}>Reviews</Text>
          </TouchableOpacity>
        </View>

        {/* MISSION BUTTON - full width */}
        <TouchableOpacity
          style={styles.missionButton}
          onPress={() => navigation.navigate("Mission", { spot })}
        >
          <FontAwesome5 name="bullseye" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>🎯 Start Mission</Text>
        </TouchableOpacity>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingTop: 50,
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },

  bookmarkButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 20,
    textAlign: "center",
  },

  imageContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 25,
  },

  image: {
    width: width * 0.85,
    height: 250,
    borderRadius: 20,
    resizeMode: "cover",
    backgroundColor: "#e0e0e0",
  },

  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 8,
  },

  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: "#d4a5a5",
    alignItems: "center",
    justifyContent: "center",
  },

  activeTab: {
    backgroundColor: "#f7cfc9",
  },

  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4a4a4a",
    textAlign: "center",
  },

  activeTabText: {
    color: "#1a1a1a",
  },

  infoCard: {
    backgroundColor: "#f7cfc9",
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    minHeight: 150,
  },

  infoText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 10,
    lineHeight: 22,
  },

  descriptionText: {
    fontSize: 14,
    color: "#2a2a2a",
    marginTop: 10,
    lineHeight: 20,
  },

  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },

  arButton: {
    flex: 1,
    backgroundColor: "#4a3a3a",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },

  trackButton: {
    flex: 1,
    backgroundColor: "#4a3a3a",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  reviewsButton: {
    flex: 1,
    backgroundColor: "#4a3a3a",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },

  // NEW - Mission full width button
  missionButton: {
    backgroundColor: "#6b4b45",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginBottom: 15,
    width: "100%",
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});