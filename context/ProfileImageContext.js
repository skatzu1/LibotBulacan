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

  const STORAGE_KEY = userId ? `profileImage_${userId}` : null;

  const loadFromStorage = useCallback(async () => {
    if (!STORAGE_KEY) return;
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setProfileImageState(saved);
    } catch (e) {
      console.log("[ProfileImage] Storage load error:", e);
    }
  }, [STORAGE_KEY]);

  const fetchProfileImage = useCallback(async () => {
    if (!isSignedIn || !STORAGE_KEY) return;
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
        await AsyncStorage.setItem(STORAGE_KEY, backendImage);
      }
    } catch (e) {
      console.log("[ProfileImage] Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, getToken, STORAGE_KEY]);

  // Called after upload — updates state + storage + DB
  const setProfileImage = useCallback(async (imageUrl) => {
    if (!imageUrl) return;
    try {
      setProfileImageState(imageUrl);
      if (STORAGE_KEY) {
        await AsyncStorage.setItem(STORAGE_KEY, imageUrl);
      }
      const token = await getToken();
      await fetch(`${BASE_URL}/api/users/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileImage: imageUrl }),
      });
    } catch (e) {
      console.log("[ProfileImage] Save error:", e);
    }
  }, [getToken, STORAGE_KEY]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      await loadFromStorage();
      await fetchProfileImage();
    })();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSignedIn) {
      setProfileImageState(null);
      setLoading(false);
    }
  }, [isSignedIn]);

  return (
    <ProfileImageContext.Provider
      value={{ profileImage, setProfileImage, fetchProfileImage, loading }}
    >
      {children}
    </ProfileImageContext.Provider>
  );
}

export function useProfileImage() {
  return useContext(ProfileImageContext);
}