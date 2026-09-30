import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAlert, showToast } from "../components/AppAlert";
import { useUser, useAuth } from "@clerk/clerk-expo";
import ImageCropPicker from "react-native-image-crop-picker";
import { useProfileImage } from "../context/ProfileImageContext";
import { useTheme, fonts, typography } from "../context/ThemeContext";
import {
  ScreenHeader, HeaderAction, FormField, GroupLabel, ListRow, LoadingState, Avatar, H_PAD,
} from "../components/ui";
import { BASE_URL } from "../api";
import Icon from "../components/Icon";

// Single source of truth for the backend host — see api.js.
// The avatar is shown through <Avatar>, whose avatarImage() already crops to a
// face-centred square. A separate c_fill,w_400 step used to be baked into the
// URL first, which chained a second resize back UP after the crop.

async function uploadImageToCloudinary(localUri, token) {
  const formData = new FormData();
  formData.append("file", {
    uri: localUri,
    type: "image/jpeg",
    name: "profile.jpg",
  });
  const res = await fetch(`${BASE_URL}/api/upload/profile`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Image upload failed: ${errText}`);
  }
  const data = await res.json();
  if (!data.url) throw new Error("No URL returned from upload");
  return data.url;
}

export default function EditProfile({ navigation }) {
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { profileImage, setProfileImage } = useProfileImage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Set just before leaving after a successful save, so the unsaved-changes
  // guard below doesn't fire on the way out.
  const leavingRef = useRef(false);

  const [firstName, setFirstName]           = useState("");
  const [lastName, setLastName]             = useState("");
  const [avatar, setAvatar]                 = useState(null);
  const [newLocalAvatar, setNewLocalAvatar] = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [pickingImage, setPickingImage]     = useState(false);

  const [originalFirstName, setOriginalFirstName] = useState("");
  const [originalLastName, setOriginalLastName]   = useState("");

  const isGoogleUser = !(clerkUser?.passwordEnabled ?? false);

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    const fn = clerkUser.firstName || "";
    const ln = clerkUser.lastName  || "";
    setFirstName(fn);
    setLastName(ln);
    setOriginalFirstName(fn);
    setOriginalLastName(ln);
    setAvatar(profileImage || clerkUser.imageUrl || null);
  }, [isLoaded, clerkUser]);

  useEffect(() => {
    if (profileImage) setAvatar(profileImage);
  }, [profileImage]);

  const hasChanges = useMemo(() => {
    const nameChanged   = firstName.trim() !== originalFirstName.trim() ||
                          lastName.trim()  !== originalLastName.trim();
    const avatarChanged = !!newLocalAvatar;
    return nameChanged || avatarChanged;
  }, [firstName, lastName, originalFirstName, originalLastName, newLocalAvatar]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!hasChanges || leavingRef.current) return;
      e.preventDefault();
      showAlert(
        "Discard changes?",
        "You have unsaved changes. Are you sure you want to leave?",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, hasChanges]);

  const handlePickAvatar = () => {
    showAlert("Change Photo", "Choose a source", [
      { text: "Cancel", style: "cancel" },
      { text: "Camera",  onPress: () => launchPicker("camera")  },
      { text: "Gallery", onPress: () => launchPicker("gallery") },
    ]);
  };

  const cropperOptions = {
    width: 400,
    height: 400,
    cropping: true,
    cropperCircleOverlay: true,
    compressImageQuality: 0.8,
    mediaType: "photo",
    freeStyleCropEnabled: false,
    cropperToolbarTitle: "Adjust Photo",
  };

  const launchPicker = async (source) => {
    setPickingImage(true);
    try {
      const result = source === "camera"
        ? await ImageCropPicker.openCamera(cropperOptions)
        : await ImageCropPicker.openPicker(cropperOptions);

      if (result?.path) {
        setAvatar(result.path);
        setNewLocalAvatar(result.path);
      }
    } catch (err) {
      if (err?.code !== "E_PICKER_CANCELLED") {
        console.error("[EditProfile] Image pick error:", err);
        showAlert("Error", "Could not select image. Please try again.");
      }
    } finally {
      setPickingImage(false);
    }
  };

  const validate = () => {
    if (!firstName.trim()) {
      showAlert("Validation", "First name cannot be empty.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const token = await getToken();

      let finalImageUrl = null;
      if (newLocalAvatar) {
        finalImageUrl = await uploadImageToCloudinary(newLocalAvatar, token);
      }

      await clerkUser.update({ firstName: firstName.trim(), lastName: lastName.trim() });

      const imageToSave = finalImageUrl || profileImage || clerkUser.imageUrl || null;
      const dbRes = await fetch(`${BASE_URL}/api/users/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName:    firstName.trim(),
          lastName:     lastName.trim(),
          profileImage: imageToSave,
        }),
      });
      if (!dbRes.ok) throw new Error("Your name was saved, but the profile didn't sync. Try again.");

      if (finalImageUrl) await setProfileImage(finalImageUrl);

      await clerkUser.reload();

      if (newLocalAvatar) {
        ImageCropPicker.cleanSingle(newLocalAvatar).catch(() => {});
      }
      setNewLocalAvatar(null);

      // The saved values are the new baseline. Without this the name still
      // differed from the ORIGINAL one, so tapping OK on "Success" was met with
      // "Discard changes? You have unsaved changes".
      setOriginalFirstName(firstName.trim());
      setOriginalLastName(lastName.trim());
      leavingRef.current = true;
      showToast("Profile updated", { type: "success" });
      navigation.goBack();
    } catch (err) {
      console.error("[EditProfile] Save error:", err);
      showAlert("Error", err?.errors?.[0]?.longMessage || err?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    showAlert("Delete Account", "This is permanent and cannot be undone. All your data will be erased.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try { await clerkUser.delete(); }
          catch (err) { showAlert("Error", err?.errors?.[0]?.message || "Could not delete account."); }
        },
      },
    ]);
  };

  const fullName = `${firstName} ${lastName}`.trim() || "User";
  const email    = clerkUser?.primaryEmailAddress?.emailAddress || "";

  const header = (
    <ScreenHeader
      title="Edit Profile"
      onBack={() => navigation.goBack()}
      right={isLoaded && (
        <HeaderAction label="Save" onPress={handleSave} disabled={!hasChanges} loading={saving} />
      )}
    />
  );

  if (!isLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <LoadingState />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={handlePickAvatar}
              disabled={pickingImage}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
            >
              <Avatar uri={avatar} name={fullName} size={100} strong />
              <View style={[styles.avatarBadge, { backgroundColor: colors.brandDark, borderColor: colors.background }]}>
                {pickingImage
                  ? <ActivityIndicator size="small" color={colors.background} />
                  : <Icon name="camera" size={14} color={colors.background} />
                }
              </View>
            </TouchableOpacity>
            <Text style={[styles.fullNameLabel, { color: colors.textPrimary }]}>{fullName}</Text>
            <Text style={[styles.avatarHint, { color: colors.textMuted }]}>Tap the photo to change it</Text>
            {isGoogleUser && (
              <View style={[styles.googleBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Icon name="globe" size={12} color={colors.brand} />
                <Text style={[styles.googleBadgeText, { color: colors.brand }]}>Signed in with Google</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <GroupLabel>Personal info</GroupLabel>
            <FormField label="First name" icon="user" value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" />
            <FormField label="Last name"  icon="user" value={lastName}  onChangeText={setLastName}  placeholder="Last name"  autoCapitalize="words" />
            <FormField
              label="Email"
              icon="mail"
              value={email}
              editable={false}
              hint="Your sign-in email can't be changed here."
            />
          </View>

          <View style={styles.section}>
            <GroupLabel>Danger zone</GroupLabel>
            <ListRow icon="trash-2" title="Delete Account" onPress={handleDeleteAccount} danger />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: { paddingHorizontal: H_PAD },

  avatarSection:   { alignItems: "center", paddingTop: 16, paddingBottom: 28 },
  avatarBadge:     { position: "absolute", bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", borderWidth: 2 },
  fullNameLabel:   { ...typography.display, fontSize: 24, lineHeight: 30, marginTop: 14, marginBottom: 2, textAlign: "center" },
  avatarHint:      { ...typography.caption, marginBottom: 8 },
  googleBadge:     { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, gap: 5, marginTop: 4 },
  googleBadgeText: { fontSize: 12, fontFamily: fonts.sansSemi },

  section: { marginBottom: 24 },
});