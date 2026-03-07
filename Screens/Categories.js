import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { useAuth } from "../context/AuthContext";

const { width } = Dimensions.get("window");

export default function Categories() {
  const navigation = useNavigation();
  const { user: clerkUser } = useUser();
  const { user: authUser }  = useAuth();

  const profilePhoto =
    clerkUser?.imageUrl || clerkUser?.profileImageUrl || authUser?.profilePhoto;

  const categories = [
    { _id: 1, name: "Religious",  backendCategory: "Religious",  image: "https://res.cloudinary.com/dcls9ayhn/image/upload/v1770858981/images_uxnf6s.jpg",      icon: "users"  },
    { _id: 2, name: "Historical", backendCategory: "Historical", image: "https://res.cloudinary.com/dcls9ayhn/image/upload/v1770859026/images_iggbls.jpg",      icon: "book"   },
    { _id: 3, name: "Nature",     backendCategory: "Nature",     image: "https://res.cloudinary.com/dcls9ayhn/image/upload/v1770859084/JdlD3t1A-image_k7g8cd.webp", icon: "globe"  },
    { _id: 4, name: "Festivals",  backendCategory: "Festivals",  image: "https://res.cloudinary.com/dcls9ayhn/image/upload/v1770859149/newest-tanglawan_pwfcve.jpg", icon: "award"  },
  ];

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={26} color="#4a2e2c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Explore</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileIcon}>
              <Feather name="user" size={20} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>Discover Categories</Text>
          <Text style={styles.description}>
            Choose a category to explore amazing destinations
          </Text>
        </View>

        {/* Grid */}
        <View style={styles.gridContainer}>
          {categories.map((category, index) => (
            <TouchableOpacity
              key={category._id}
              style={[styles.categoryCard, { marginTop: index % 2 !== 0 ? 20 : 0 }]}
              onPress={() =>
                navigation.navigate("Lists", {
                  category: category.backendCategory,
                  displayName: category.name,
                })
              }
              activeOpacity={0.85}
            >
              <Image source={{ uri: category.image }} style={styles.categoryImage} resizeMode="cover" />

              <View style={styles.gradientOverlay}>
                <View style={styles.overlayContent}>
                  <View style={styles.iconContainer}>
                    <Feather name={category.icon} size={28} color="#fff" />
                  </View>
                  <Text style={styles.categoryText}>{category.name}</Text>
                  <View style={styles.arrowContainer}>
                    <Feather name="arrow-right" size={18} color="#fff" />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4a2e2c",
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6b4b45",
    justifyContent: "center",
    alignItems: "center",
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6b4b45",
  },

  scrollView:    { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  // ── Subtitle ──
  subtitleContainer: {
    marginBottom: 28,
    alignItems: "center",
  },
  subtitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#4a2e2c",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#7a5a58",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
  },

  // ── Category grid ──
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
  },
  categoryCard: {
    width: "48%",
    height: 220,
    marginBottom: 20,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#faf5f4",
    shadowColor: "#4a2e2c",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  categoryImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    padding: 15,
  },
  overlayContent: { alignItems: "center" },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
});