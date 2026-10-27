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
import { useAuth } from "@clerk/clerk-expo";
import { showAlert, showToast } from "../components/AppAlert";
import { useTheme } from "../context/ThemeContext";
import { ScreenHeader, ListRow, GroupLabel, Segmented, H_PAD } from "../components/ui";
import * as Notifications from "expo-notifications";
import { HELP_URL, ABOUT_URL, TERMS_URL, PRIVACY_URL } from "../utils/legalLinks";
import { BASE_URL } from "../api";
import { useLive } from "../utils/live";

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

  // Hide my account (user, 2026-10-28: "option to hide account to other
  // users"): other travelers see "Hidden traveler" on the leaderboard and on
  // reviews, and can't open the profile (LibotBackend utils/hiddenTravelers.js).
  // Read from /api/users/me, and again when another phone of theirs changes it.
  const { getToken } = useAuth();
  const [hidden, setHidden] = React.useState(null);
  const [savingHidden, setSavingHidden] = React.useState(false);

  const loadHidden = React.useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data?.user) setHidden(!!data.user.hidden);
    } catch {}
  }, [getToken]);

  React.useEffect(() => { loadHidden(); }, [loadHidden]);
  useLive(["me"], loadHidden);

  const handleHiddenToggle = async (value) => {
    const before = hidden;
    setHidden(value);
    setSavingHidden(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users/me/visibility`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: value }),
      });
      if (!res.ok) throw new Error(`visibility ${res.status}`);
      showToast(
        value ? "Your account is hidden. Others see you as “Hidden traveler”." : "Your account shows to other travelers again.",
        { type: "success" },
      );
    } catch (e) {
      console.warn("Hide account error:", e);
      setHidden(before);
      showAlert("Couldn't change that", "Check your connection and try again.");
    } finally {
      setSavingHidden(false);
    }
  };

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
          <ListRow
            icon="eye-off"
            title="Hide my account"
            subtitle={hidden ? "Others see “Hidden traveler”" : "Others see your name and photo"}
            right={
              hidden === null
                ? <ActivityIndicator size="small" color={colors.brand} />
                : (
                  <Switch
                    value={hidden}
                    disabled={savingHidden}
                    onValueChange={handleHiddenToggle}
                    trackColor={{ false: colors.cardBorder, true: colors.brand }}
                    thumbColor="#fff"
                    accessibilityLabel="Hide my account from other travelers"
                    accessibilityHint="Other travelers see Hidden traveler instead of your name and photo on the leaderboard and on your reviews"
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

        {/* About comes last (QA 2026-10-16). Log Out moved to the Profile
            screen itself. */}
        <View style={styles.section}>
          <GroupLabel>Support & About</GroupLabel>
          <ListRow icon="help-circle" title="Help & Support"   onPress={() => openURL(HELP_URL)}    accessibilityLabel="Help and support" />
          {/* A screen, not a bare mailto: link. See Screens/ReportProblem.js. */}
          <ListRow icon="flag"        title="Report a Problem" onPress={() => navigation.navigate("ReportProblem")} />
          <ListRow icon="file-text"   title="Terms of Service" onPress={() => openURL(TERMS_URL)}   />
          <ListRow icon="lock"        title="Privacy Policy"   onPress={() => openURL(PRIVACY_URL)} />
          <ListRow icon="info"        title="About LibotBulacan" onPress={() => openURL(ABOUT_URL)}   />
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
