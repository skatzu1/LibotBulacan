import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";

const BASE_URL = "https://libotbackend.onrender.com";
const ProfileImageContext = createContext(null);

export function ProfileImageProvider({ children }) {
  const [profileImage, setProfileImageState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false); // storage read done, safe to render *something*

  const { getToken, isSignedIn, userId } = useAuth();
  const STORAGE_KEY = userId ? `profileImage_${userId}` : null;
  const retryTimeoutRef = useRef(null);

  const loadFromStorage = useCallback(async () => {
    if (!STORAGE_KEY) return;
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setProfileImageState(saved);
    } catch (e) {
      console.log("[ProfileImage] Storage load error:", e);
    } finally {
      setHydrated(true);
    }
  }, [STORAGE_KEY]);

  const fetchProfileImage = useCallback(async (attempt = 1) => {
    if (!isSignedIn || !STORAGE_KEY) return;
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const backendImage = data?.user?.profileImage;
      if (backendImage) {
        setProfileImageState(backendImage);
        await AsyncStorage.setItem(STORAGE_KEY, backendImage);
      }
    } catch (e) {
      console.log(`[ProfileImage] Fetch error (attempt ${attempt}):`, e.message);
      // Retry a couple times with backoff — covers Render cold-start delays
      // and transient network failures instead of silently giving up.
      if (attempt < 3) {
        retryTimeoutRef.current = setTimeout(
          () => fetchProfileImage(attempt + 1),
          attempt * 3000 // 3s, then 6s
        );
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, getToken, STORAGE_KEY]);

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
    setHydrated(false);
    (async () => {
      await loadFromStorage();   // fast, local — sets a value immediately if cached
      await fetchProfileImage(); // slower, authoritative — corrects/confirms it
    })();
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSignedIn) {
      setProfileImageState(null);
      setLoading(false);
      setHydrated(true);
    }
  }, [isSignedIn]);

  return (
    <ProfileImageContext.Provider
      value={{ profileImage, setProfileImage, fetchProfileImage, loading, hydrated }}
    >
      {children}
    </ProfileImageContext.Provider>
  );
}

export function useProfileImage() {
  return useContext(ProfileImageContext);
}