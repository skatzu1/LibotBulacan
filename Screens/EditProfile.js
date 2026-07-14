import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useUser, useAuth } from "@clerk/clerk-expo";
import ImageCropPicker from "react-native-image-crop-picker";
import { useProfileImage } from "../context/ProfileImageContext";
import { useTheme } from "../context/ThemeContext";

const BASE_URL = "https://libotbackend.onrender.com";

function toCloudinarySquare(url, size = 400) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  const transform = `c_fill,ar_1:1,g_face,w_${size}`;
  return url.replace("/upload/", `/upload/${transform}/`);
}

const Field = ({ label, icon, value, onChangeText, placeholder, keyboardType,
  editable = true, colors }) => (
  <View style={styles.fieldWrapper}>
    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
    <View style={[
      styles.fieldRow,
      { backgroundColor: colors.card, borderColor: colors.cardBorder },
      !editable && styles.fieldRowDisabled,
    ]}>
      <View style={[styles.fieldIcon, { backgroundColor: colors.brandLight }]}>
        <Feather name={icon} size={16} color={colors.brand} />
      </View>
      <TextInput
        style={[styles.fieldInput, { color: colors.textPrimary }]}
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType || "default"}
        editable={editable} autoCapitalize="none" autoCorrect={false}
      />
    </View>
  </View>
);

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
    setAvatar(toCloudinarySquare(profileImage || clerkUser.imageUrl) || null);
  }, [isLoaded, clerkUser]);

  useEffect(() => {
    if (profileImage) setAvatar(toCloudinarySquare(profileImage));
  }, [profileImage]);

  const hasChanges = useMemo(() => {
    const nameChanged   = firstName.trim() !== originalFirstName.trim() ||
                          lastName.trim()  !== originalLastName.trim();
    const avatarChanged = !!newLocalAvatar;
    return nameChanged || avatarChanged;
  }, [firstName, lastName, originalFirstName, originalLastName, newLocalAvatar]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!hasChanges) return;
      e.preventDefault();
      Alert.alert(
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
    Alert.alert("Change Photo", "Choose a source", [
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
        Alert.alert("Error", "Could not select image. Please try again.");
      }
    } finally {
      setPickingImage(false);
    }
  };

  const validate = () => {
    if (!firstName.trim()) {
      Alert.alert("Validation", "First name cannot be empty.");
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
      const dbData = await dbRes.json();
      console.log("[EditProfile] DB response:", dbData);

      if (finalImageUrl) await setProfileImage(finalImageUrl);

      await clerkUser.reload();

      if (newLocalAvatar) {
        ImageCropPicker.cleanSingle(newLocalAvatar).catch(() => {});
      }
      setNewLocalAvatar(null);

      Alert.alert("Success", "Profile updated successfully.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error("[EditProfile] Save error:", err);
      Alert.alert("Error", err?.errors?.[0]?.longMessage || err?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert("Delete Account", "This is permanent and cannot be undone. All your data will be erased.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try { await clerkUser.delete(); }
          catch (err) { Alert.alert("Error", err?.errors?.[0]?.message || "Could not delete account."); }
        },
      },
    ]);
  };

  const fullName = `${firstName} ${lastName}`.trim() || "User";
  const initials = fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const email    = clerkUser?.primaryEmailAddress?.emailAddress || "";

  if (!isLoaded) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const saveDisabled = saving || !hasChanges;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-left" size={24} color={colors.brandDark} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.brandDark }]}>Edit Profile</Text>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.brand },
              saveDisabled && { backgroundColor: colors.cardBorder },
            ]}
            onPress={handleSave}
            disabled={saveDisabled}
          >
            {saving
              ? <ActivityIndicator color={colors.textInverse} size="small" />
              : <Text style={[
                  styles.saveButtonText,
                  { color: colors.textInverse },
                  saveDisabled && { color: colors.textMuted },
                ]}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickAvatar} disabled={pickingImage} activeOpacity={0.8}>
              <View style={[styles.profilePhotoWrapper, { backgroundColor: colors.brand }]}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.profilePhoto} />
                ) : (
                  <View style={[styles.profilePhotoPlaceholder, { backgroundColor: colors.brand }]}>
                    <Text style={[styles.avatarInitials, { color: colors.textInverse }]}>{initials}</Text>
                  </View>
                )}
                <View style={[styles.avatarBadge, { backgroundColor: colors.brandDark, borderColor: colors.background }]}>
                  {pickingImage
                    ? <ActivityIndicator size="small" color={colors.textInverse} />
                    : <Feather name="camera" size={14} color={colors.textInverse} />
                  }
                </View>
              </View>
            </TouchableOpacity>
            <Text style={[styles.fullNameLabel, { color: colors.brandDark }]}>{fullName}</Text>
            <Text style={[styles.emailLabel, { color: colors.textSecondary }]}>{email}</Text>
            <Text style={[styles.avatarHint, { color: colors.textMuted }]}>Tap photo to change</Text>
            {isGoogleUser && (
              <View style={[styles.googleBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Feather name="globe" size={12} color={colors.brand} />
                <Text style={[styles.googleBadgeText, { color: colors.brand }]}>Signed in with Google</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Personal Info</Text>
            <Field label="First Name"       icon="user" value={firstName} onChangeText={setFirstName} placeholder="First name" colors={colors} />
            <Field label="Last Name"         icon="user" value={lastName}  onChangeText={setLastName}  placeholder="Last name"  colors={colors} />
            <Field label="Email (read-only)" icon="mail" value={email}     placeholder="—"             editable={false} colors={colors} />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Danger Zone</Text>
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.dangerBg }]}>
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </View>
                <Text style={[styles.menuText, { color: colors.danger }]}>Delete Account</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50 },
  centered:  { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, marginBottom: 8,
  },
  backButton:  { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  saveButton:  { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 60, alignItems: "center" },
  saveButtonText: { fontWeight: "700", fontSize: 14 },

  scrollContent: { paddingHorizontal: 20 },

  avatarSection:           { alignItems: "center", paddingVertical: 24 },
  profilePhotoWrapper:     { width: 100, height: 100, borderRadius: 50, overflow: "hidden", justifyContent: "center", alignItems: "center", position: "relative" },
  profilePhoto:            { width: "100%", height: "100%", resizeMode: "cover" },
  profilePhotoPlaceholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  avatarInitials:          { fontSize: 32, fontWeight: "700" },
  avatarBadge:             { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 2 },
  fullNameLabel:           { fontSize: 18, fontWeight: "700", marginTop: 12, marginBottom: 2 },
  emailLabel:              { fontSize: 13, marginBottom: 4 },
  avatarHint:              { fontSize: 12, marginBottom: 8 },
  googleBadge:             { flexDirection: "row", alignItems: "center", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, gap: 5, marginTop: 4 },
  googleBadgeText:         { fontSize: 12, fontWeight: "600" },

  section:      { marginBottom: 28 },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 },

  fieldWrapper: { marginBottom: 10 },
  fieldLabel:   { fontSize: 12, fontWeight: "600", marginBottom: 5, marginLeft: 4 },
  fieldRow:     { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  fieldRowDisabled: { opacity: 0.5 },
  fieldIcon:    { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 10 },
  fieldInput:   { flex: 1, fontSize: 15, fontWeight: "500", padding: 0 },

  menuItem:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1 },
  menuLeft:      { flexDirection: "row", alignItems: "center" },
  iconContainer: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 12 },
  menuText:      { fontSize: 15, fontWeight: "500" },
});