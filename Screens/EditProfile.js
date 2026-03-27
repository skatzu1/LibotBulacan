import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useUser, useAuth } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import { useProfileImage } from "../context/ProfileImageContext";

const BASE_URL = "https://libotbackend.onrender.com";

const Field = ({ label, icon, value, onChangeText, placeholder, keyboardType,
  secureTextEntry, editable = true, showToggle = false, toggleVisible, onToggle }) => (
  <View style={styles.fieldWrapper}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.fieldRow, !editable && styles.fieldRowDisabled]}>
      <View style={styles.fieldIcon}>
        <Feather name={icon} size={16} color="#6b4b45" />
      </View>
      <TextInput
        style={styles.fieldInput} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor="#c4a09c"
        keyboardType={keyboardType || "default"}
        secureTextEntry={showToggle ? !toggleVisible : secureTextEntry}
        editable={editable} autoCapitalize="none" autoCorrect={false}
      />
      {showToggle && (
        <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
          <Feather name={toggleVisible ? "eye-off" : "eye"} size={16} color="#b0908c" />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

// Upload image to Cloudinary via your backend
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

  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.url; // Cloudinary URL
}

export default function EditProfile({ navigation }) {
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken } = useAuth();
 const { profileImage, setProfileImage } = useProfileImage();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [newLocalAvatar, setNewLocalAvatar] = useState(null);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  const hasPassword = clerkUser?.passwordEnabled ?? false;
  const isGoogleUser = !hasPassword;

  useEffect(() => {
    if (isLoaded && clerkUser) {
      setFirstName(clerkUser.firstName || "");
      setLastName(clerkUser.lastName || "");
      setAvatar(
  profileImage ||
  clerkUser.imageUrl ||
  clerkUser.profileImageUrl ||
  null
);
    }
  }, [isLoaded, clerkUser]);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    setPickingImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatar(result.assets[0].uri);
        setNewLocalAvatar(result.assets[0].uri);
      }
    } finally {
      setPickingImage(false);
    }
  };

  const validate = () => {
    if (!firstName.trim()) { Alert.alert("Validation", "First name cannot be empty."); return false; }
    const wantsPassword = pwNew || pwConfirm || pwCurrent;
    if (wantsPassword) {
      if (!isGoogleUser && !pwCurrent) { Alert.alert("Validation", "Please enter your current password."); return false; }
      if (pwNew.length < 8) { Alert.alert("Validation", "Password must be at least 8 characters."); return false; }
      if (pwNew !== pwConfirm) { Alert.alert("Validation", "Passwords do not match."); return false; }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const token = await getToken();

      // 1. Upload image to Cloudinary first (real persistent URL)
      let finalImageUrl = null;
      if (newLocalAvatar) {
        finalImageUrl = await uploadImageToCloudinary(newLocalAvatar, token);
        console.log("[EditProfile] Cloudinary URL:", finalImageUrl);
      }

      // 2. Update name on Clerk
      await clerkUser.update({ firstName: firstName.trim(), lastName: lastName.trim() });

      // 3. Update password if provided
      if (pwNew) {
        if (isGoogleUser) {
          await clerkUser.updatePassword({ newPassword: pwNew });
        } else {
          await clerkUser.updatePassword({ currentPassword: pwCurrent, newPassword: pwNew });
        }
      }

      // 4. Save everything to DB (Cloudinary URL, not Clerk URL)
      const body = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(finalImageUrl ? { profileImage: finalImageUrl } : {}),
      };

      const dbRes = await fetch(`${BASE_URL}/api/users/me`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const dbData = await dbRes.json();
      console.log("[EditProfile] DB response:", dbData);

      // 5. Update context so Home + Profile show new image instantly
      if (finalImageUrl) {
        setProfileImage(finalImageUrl);
      }

      Alert.alert(
        "Success",
        isGoogleUser && pwNew
          ? "Profile updated! You can now also log in with your email and password."
          : "Profile updated successfully.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
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
  const email = clerkUser?.primaryEmailAddress?.emailAddress || "";

  if (!isLoaded) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6b4b45" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="chevron-left" size={24} color="#4a2e2c" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave} disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveButtonText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handlePickAvatar} disabled={pickingImage} activeOpacity={0.8}>
              <View style={styles.profilePhotoWrapper}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.profilePhotoPlaceholder}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  {pickingImage ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="camera" size={14} color="#fff" />}
                </View>
              </View>
            </TouchableOpacity>
            <Text style={styles.fullNameLabel}>{fullName}</Text>
            <Text style={styles.emailLabel}>{email}</Text>
            <Text style={styles.avatarHint}>Tap photo to change</Text>
            {isGoogleUser && (
              <View style={styles.googleBadge}>
                <Feather name="globe" size={12} color="#6b4b45" />
                <Text style={styles.googleBadgeText}>Signed in with Google</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Info</Text>
            <Field label="First Name" icon="user" value={firstName} onChangeText={setFirstName} placeholder="First name" />
            <Field label="Last Name" icon="user" value={lastName} onChangeText={setLastName} placeholder="Last name" />
            <Field label="Email (read-only)" icon="mail" value={email} placeholder="—" editable={false} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{isGoogleUser ? "Set a Password" : "Change Password"}</Text>
            {isGoogleUser ? (
              <>
                <View style={styles.infoBanner}>
                  <Feather name="info" size={15} color="#6b4b45" style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={styles.infoBannerText}>You registered with Google. Set a password to also log in with your email and password.</Text>
                </View>
                <Field label="New Password" icon="lock" value={pwNew} onChangeText={setPwNew} placeholder="At least 8 characters" showToggle toggleVisible={showNew} onToggle={() => setShowNew(!showNew)} />
                <Field label="Confirm Password" icon="check-circle" value={pwConfirm} onChangeText={setPwConfirm} placeholder="Repeat password" showToggle toggleVisible={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
              </>
            ) : (
              <>
                <Text style={styles.sectionNote}>Leave blank to keep your current password.</Text>
                <Field label="Current Password" icon="lock" value={pwCurrent} onChangeText={setPwCurrent} placeholder="Enter current password" showToggle toggleVisible={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} />
                <Field label="New Password" icon="key" value={pwNew} onChangeText={setPwNew} placeholder="At least 8 characters" showToggle toggleVisible={showNew} onToggle={() => setShowNew(!showNew)} />
                <Field label="Confirm New Password" icon="check-circle" value={pwConfirm} onChangeText={setPwConfirm} placeholder="Repeat new password" showToggle toggleVisible={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount} activeOpacity={0.7}>
              <View style={styles.menuLeft}>
                <View style={[styles.iconContainer, styles.iconContainerDanger]}>
                  <Feather name="trash-2" size={18} color="#c0392b" />
                </View>
                <Text style={[styles.menuText, styles.menuTextDanger]}>Delete Account</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#c0392b" />
            </TouchableOpacity>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#fff", paddingTop: 50 },
  centered:   { justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 8 },
  backButton:         { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle:        { fontSize: 20, fontWeight: "700", color: "#4a2e2c" },
  saveButton:         { backgroundColor: "#6b4b45", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 60, alignItems: "center" },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText:     { color: "#fff", fontWeight: "700", fontSize: 14 },
  scrollContent: { paddingHorizontal: 20 },
  avatarSection:           { alignItems: "center", paddingVertical: 24 },
  profilePhotoWrapper:     { width: 100, height: 100, borderRadius: 50, overflow: "hidden", backgroundColor: "#6b4b45", justifyContent: "center", alignItems: "center", position: "relative" },
  profilePhoto:            { width: "100%", height: "100%", resizeMode: "cover" },
  profilePhotoPlaceholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center", backgroundColor: "#6b4b45" },
  avatarInitials: { fontSize: 32, fontWeight: "700", color: "#fff" },
  avatarBadge:    { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: "#4a2e2c", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  fullNameLabel: { fontSize: 18, fontWeight: "700", color: "#4a2e2c", marginTop: 12, marginBottom: 2 },
  emailLabel:    { fontSize: 13, color: "#7a5a58", marginBottom: 4 },
  avatarHint:    { fontSize: 12, color: "#b0908c", marginBottom: 8 },
  googleBadge:     { flexDirection: "row", alignItems: "center", backgroundColor: "#faf5f4", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#f0e0de", gap: 5, marginTop: 4 },
  googleBadgeText: { fontSize: 12, color: "#6b4b45", fontWeight: "600" },
  infoBanner:     { flexDirection: "row", backgroundColor: "#faf5f4", borderRadius: 12, borderWidth: 1, borderColor: "#f0e0de", padding: 12, marginBottom: 12 },
  infoBannerText: { flex: 1, fontSize: 13, color: "#6b4b45", lineHeight: 18 },
  section:      { marginBottom: 28 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#b0908c", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 },
  sectionNote:  { fontSize: 12, color: "#c4a09c", marginBottom: 10, marginLeft: 4 },
  fieldWrapper: { marginBottom: 10 },
  fieldLabel:   { fontSize: 12, fontWeight: "600", color: "#8a5e58", marginBottom: 5, marginLeft: 4 },
  fieldRow:     { flexDirection: "row", alignItems: "center", backgroundColor: "#faf5f4", borderRadius: 12, borderWidth: 1, borderColor: "#f0e0de", paddingHorizontal: 12, paddingVertical: 11 },
  fieldRowDisabled: { opacity: 0.5 },
  fieldIcon:  { width: 28, height: 28, borderRadius: 8, backgroundColor: "#f0e0de", justifyContent: "center", alignItems: "center", marginRight: 10 },
  fieldInput: { flex: 1, fontSize: 15, color: "#4a2e2c", fontWeight: "500", padding: 0 },
  eyeBtn:     { padding: 4 },
  menuItem:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#faf5f4", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: "#f0e0de" },
  menuLeft:            { flexDirection: "row", alignItems: "center" },
  iconContainer:       { width: 36, height: 36, borderRadius: 10, backgroundColor: "#f0e0de", justifyContent: "center", alignItems: "center", marginRight: 12 },
  iconContainerDanger: { backgroundColor: "#fde8e6" },
  menuText:            { fontSize: 15, color: "#4a2e2c", fontWeight: "500" },
  menuTextDanger:      { color: "#c0392b" },
});