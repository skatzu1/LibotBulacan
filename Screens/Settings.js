import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,  ActivityIndicator,
  Linking,
  Switch,
} from "react-native";
import { showAlert } from "../components/AppAlert";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ScreenHeader } from "../components/ui";
import * as Notifications from "expo-notifications";
import { HELP_URL, ABOUT_URL, TERMS_URL, PRIVACY_URL } from "../utils/legalLinks";

const openURL = async (url) => {
  const supported = await Linking.canOpenURL(url);
  if (supported) await Linking.openURL(url);
  else showAlert("Unavailable", "This page isn't available right now.");
};

const Settings = ({ navigation }) => {
  const { logout } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();

  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [notifEnabled, setNotifEnabled] = React.useState(null);

  const checkNotifPermission = React.useCallback(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifEnabled(status === "granted");
    });
  }, []);

  // Re-check on mount AND every time this screen regains focus — the user
  // may have changed the permission from OS Settings and come back, and a
  // bare mount-only check would keep showing the stale value until the
  // screen is fully remounted.
  React.useEffect(() => {
    checkNotifPermission();
    const unsubscribe = navigation.addListener("focus", checkNotifPermission);
    return unsubscribe;
  }, [navigation, checkNotifPermission]);

  const handleNotifToggle = async (value) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        setNotifEnabled(true);
      } else {
        showAlert(
          "Permission Denied",
          "To enable notifications, please allow them in your device Settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } else {
      showAlert(
        "Disable Notifications",
        "To turn off notifications, please disable them in your device Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleLogout = () => {
    showAlert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            setIsLoggingOut(true);
            await logout();
          } catch {
            showAlert("Error", "Failed to log out. Please try again.");
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleReportProblem = () => {
    showAlert("Report a Problem", "How would you like to report?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send Email",
        onPress: () =>
          Linking.openURL(
            "mailto:support@libot.app?subject=Problem%20Report&body=Describe%20the%20issue%20here..."
          ),
      },
    ]);
  };

  const handlePrivacy = () => {
    showAlert("Privacy", "View our full privacy policy?", [
      { text: "Cancel", style: "cancel" },
      { text: "View Policy", onPress: () => openURL(PRIVACY_URL) },
    ]);
  };

  // ── Reusable row ──────────────────────────────────────────────
  const MenuItem = ({ icon, title, onPress, accessLabel, rightElement, danger }) => (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      onPress={onPress}
      activeOpacity={rightElement ? 1 : 0.7}
      accessibilityLabel={accessLabel || title}
    >
      <View style={styles.menuLeft}>
        <View style={[
          styles.iconContainer,
          { backgroundColor: danger ? colors.dangerBg : colors.brandLight },
        ]}>
          <Feather name={icon} size={18} color={danger ? colors.danger : colors.brand} />
        </View>
        <Text style={[styles.menuText, { color: danger ? colors.danger : colors.textPrimary }]}>
          {title}
        </Text>
      </View>
      {rightElement || (
        <Feather name="chevron-right" size={18} color={danger ? colors.danger : colors.textMuted} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Settings"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Account */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Account</Text>
          <MenuItem
            icon="user"
            title="Edit Profile"
            onPress={() => navigation.navigate("EditProfile")}
            accessLabel="Edit your profile"
          />
          <MenuItem
            icon="shield"
            title="Login & Security"
            onPress={() => navigation.navigate("LoginSecurity")}
            accessLabel="Login and security settings"
          />
          <MenuItem
            icon="bell"
            title="Notifications"
            accessLabel={notifEnabled ? "Notifications on" : "Notifications off"}
            rightElement={
              notifEnabled === null
                ? <ActivityIndicator size="small" color={colors.brand} />
                : (
                  <Switch
                    value={notifEnabled}
                    onValueChange={handleNotifToggle}
                    trackColor={{ false: colors.cardBorder, true: colors.brand }}
                    thumbColor="#fff"
                    accessibilityLabel="Toggle notifications"
                  />
                )
            }
          />
          <MenuItem
            icon="lock"
            title="Privacy"
            onPress={handlePrivacy}
            accessLabel="Privacy settings"
          />
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Appearance</Text>
          <MenuItem
            icon={isDark ? "moon" : "sun"}
            title="Dark Mode"
            accessLabel={isDark ? "Dark mode on" : "Dark mode off"}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.cardBorder, true: colors.brand }}
                thumbColor="#fff"
                accessibilityLabel="Toggle dark mode"
              />
            }
          />
        </View>

        {/* Support & About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Support & About</Text>
          <MenuItem icon="help-circle" title="Help & Support"     onPress={() => openURL(HELP_URL)}  accessLabel="Help and support" />
          <MenuItem icon="info"        title="About Us"           onPress={() => openURL(ABOUT_URL)} accessLabel="About Libot" />
          <MenuItem icon="file-text"   title="Terms and Policies" onPress={() => openURL(TERMS_URL)} accessLabel="Terms and policies" />
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Actions</Text>
          <MenuItem icon="flag"    title="Report a Problem" onPress={handleReportProblem} accessLabel="Report a problem" />
          <MenuItem icon="log-out" title="Log Out"          onPress={handleLogout}         accessLabel="Log out" danger />
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 60 },
  section:       { marginBottom: 28 },
  sectionTitle:  { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 },
  menuItem:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 15, paddingHorizontal: 15, marginBottom: 8, borderRadius: 16, borderWidth: 1 },
  menuLeft:      { flexDirection: "row", alignItems: "center" },
  iconContainer: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 12 },
  menuText:      { fontSize: 15, fontWeight: "600" },
});

export default Settings;