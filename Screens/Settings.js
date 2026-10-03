import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAlert } from "../components/AppAlert";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ScreenHeader, ListRow, GroupLabel, Segmented, H_PAD } from "../components/ui";
import * as Notifications from "expo-notifications";
import { HELP_URL, ABOUT_URL, TERMS_URL, PRIVACY_URL } from "../utils/legalLinks";
import { requestHomeTour } from "../components/HomeTour";

const openURL = async (url) => {
  try {
    if (await Linking.canOpenURL(url)) return await Linking.openURL(url);
  } catch {}
  showAlert("Unavailable", "This page isn't available right now.");
};

const THEME_OPTIONS = [
  { key: "light",  label: "Light",  icon: "sun",        a11y: "Light appearance" },
  { key: "dark",   label: "Dark",   icon: "moon",       a11y: "Dark appearance" },
  { key: "system", label: "System", icon: "smartphone", a11y: "Match the phone's appearance" },
];

const Settings = ({ navigation }) => {
  const { logout } = useAuth();
  const { pref, setThemePref, colors } = useTheme();
  const insets = useSafeAreaInsets();

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
            await logout();
          } catch {
            showAlert("Error", "Failed to log out. Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Settings"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.section}>
          <GroupLabel>Account</GroupLabel>
          <ListRow
            icon="user"
            title="Edit Profile"
            onPress={() => navigation.navigate("EditProfile")}
            accessibilityLabel="Edit your profile"
          />
          <ListRow
            icon="shield"
            title="Login & Security"
            onPress={() => navigation.navigate("LoginSecurity")}
            accessibilityLabel="Login and security settings"
          />
          <ListRow
            icon="bell"
            title="Notifications"
            right={
              notifEnabled === null
                ? <ActivityIndicator size="small" color={colors.brand} />
                : (
                  <Switch
                    value={notifEnabled}
                    onValueChange={handleNotifToggle}
                    trackColor={{ false: colors.cardBorder, true: colors.brand }}
                    thumbColor="#fff"
                    accessibilityLabel="Notifications"
                  />
                )
            }
          />
        </View>

        {/* A two-state switch could not express "follow my phone", so a user
            with the OS in dark mode got a light app with dark native keyboards
            and share sheets. app.json declares userInterfaceStyle:"automatic",
            and this is what actually honours it. */}
        <View style={styles.section}>
          <GroupLabel>Appearance</GroupLabel>
          <Segmented options={THEME_OPTIONS} value={pref} onChange={setThemePref} role="radio" />
        </View>

        <View style={styles.section}>
          <GroupLabel>Support & About</GroupLabel>
          {/* Back to Home, where the first-run tour plays again. */}
          <ListRow
            icon="compass"
            title="Show the app tour"
            subtitle="A quick look around Home"
            onPress={() => {
              navigation.navigate("Home", { screen: "HomeScreen" });
              requestHomeTour();
            }}
          />
          <ListRow icon="help-circle" title="Help & Support"   onPress={() => openURL(HELP_URL)}    accessibilityLabel="Help and support" />
          <ListRow icon="info"        title="About Libot Bulacan" onPress={() => openURL(ABOUT_URL)}   />
          <ListRow icon="file-text"   title="Terms of Service" onPress={() => openURL(TERMS_URL)}   />
          <ListRow icon="lock"        title="Privacy Policy"   onPress={() => openURL(PRIVACY_URL)} />
          {/* A screen, not a bare mailto: link. On a phone with no mail app
              set up, mailto: opened a blank page. See Screens/ReportProblem.js. */}
          <ListRow icon="flag"        title="Report a Problem" subtitle="Email the developers" onPress={() => navigation.navigate("ReportProblem")} />
        </View>

        <View style={styles.section}>
          <ListRow icon="log-out" title="Log Out" onPress={handleLogout} danger right={null} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 12 },
  section:       { marginBottom: 24 },
});

export default Settings;
