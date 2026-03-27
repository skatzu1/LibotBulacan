import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";

const BASE_URL = "https://libotbackend.onrender.com";
const ProfileImageContext = createContext(null);

export function ProfileImageProvider({ children }) {
  const [profileImage, setProfileImageState] = useState(null);
  const [loading, setLoading] = useState(true);

  const { getToken, isSignedIn, userId } = useAuth();

  // 🔥 Unique key per user (IMPORTANT for multi-account)
  const STORAGE_KEY = `profileImage_${userId}`;

  // ✅ Load from AsyncStorage FIRST (instant UI, no flicker)
  const loadFromStorage = useCallback(async () => {
    if (!userId) return;

    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setProfileImageState(saved);
      }
    } catch (e) {
      console.log("Storage load error:", e);
    }
  }, [STORAGE_KEY, userId]);

  // ✅ Fetch from backend (source of truth)
  const fetchProfileImage = useCallback(async () => {
    if (!isSignedIn) return;

    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();
      const backendImage = data?.user?.profileImage;

      if (backendImage) {
        setProfileImageState(backendImage);

        // 🔥 Sync to storage
        await AsyncStorage.setItem(STORAGE_KEY, backendImage);
      }
    } catch (e) {
      console.log("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, getToken, STORAGE_KEY]);

  // ✅ Set image (used after upload)
  const setProfileImage = async (imageUrl) => {
    try {
      setProfileImageState(imageUrl);
      await AsyncStorage.setItem(STORAGE_KEY, imageUrl);
    } catch (e) {
      console.log("Save error:", e);
    }
  };

  // 🔄 Load + Fetch flow
  useEffect(() => {
    if (!userId) return;

    (async () => {
      await loadFromStorage();  // ⚡ instant
      await fetchProfileImage(); // 🔄 sync with backend
    })();
  }, [userId, loadFromStorage, fetchProfileImage]);

  // 🔥 Clear on logout (VERY IMPORTANT)
  useEffect(() => {
    if (!isSignedIn) {
      setProfileImageState(null);
      setLoading(false);
    }
  }, [isSignedIn]);

  return (
    <ProfileImageContext.Provider
      value={{ profileImage, setProfileImage, loading }}
    >
      {children}
    </ProfileImageContext.Provider>
  );
}

export function useProfileImage() {
  return useContext(ProfileImageContext);
}