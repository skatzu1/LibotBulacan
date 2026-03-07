import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

const Settings = ({ navigation }) => {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              await logout();
            } catch (error) {
              Alert.alert("Error", "Failed to log out. Please try again.");
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const MenuItem = ({ icon, title, onPress }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuLeft}>
        <View style={styles.iconContainer}>
          <Feather name={icon} size={18} color="#6b4b45" />
        </View>
        <Text style={styles.menuText}>{title}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#b0908c" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color="#4a2e2c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <MenuItem icon="user"  title="Edit profile"   onPress={() => console.log("Edit profile")} />
          <MenuItem icon="shield" title="Security"      onPress={() => console.log("Security")} />
          <MenuItem icon="bell"   title="Notifications" onPress={() => console.log("Notifications")} />
          <MenuItem icon="lock"   title="Privacy"       onPress={() => console.log("Privacy")} />
        </View>

        {/* Support & About section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & About</Text>
          <MenuItem icon="help-circle" title="Help & Support"    onPress={() => console.log("Help & Support")} />
          <MenuItem icon="info"        title="About us"          onPress={() => console.log("About us")} />
          <MenuItem icon="file-text"   title="Terms and Policies" onPress={() => console.log("Terms and Policies")} />
        </View>

        {/* Actions section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <MenuItem icon="flag"     title="Report a problem" onPress={() => console.log("Report a problem")} />
          <MenuItem icon="user-plus" title="Add account"     onPress={() => console.log("Add account")} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleLogout}
            disabled={isLoggingOut}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconContainer, styles.iconContainerDanger]}>
                <Feather name="log-out" size={18} color="#c0392b" />
              </View>
              <Text style={[styles.menuText, styles.menuTextDanger]}>Log out</Text>
            </View>
            {isLoggingOut
              ? <ActivityIndicator color="#c0392b" />
              : <Feather name="chevron-right" size={18} color="#c0392b" />
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
};

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
    marginBottom: 24,
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

  // ── Sections ──
  scrollContent: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b0908c",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },

  // ── Menu items ──
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#faf5f4",
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f0e0de",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f0e0de",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconContainerDanger: {
    backgroundColor: "#fde8e6",
  },
  menuText: {
    fontSize: 15,
    color: "#4a2e2c",
    fontWeight: "500",
  },
  menuTextDanger: {
    color: "#c0392b",
  },
});

export default Settings;