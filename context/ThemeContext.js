import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "libot_dark_mode";

// ── Color palette ─────────────────────────────────────────────────────────────
const lightColors = {
  // Backgrounds
  background:       "#ffffff",
  backgroundSoft:   "#faf5f4",
  backgroundHero:   "#c4a49f",
  card:             "#faf5f4",
  cardBorder:       "#f0e0de",

  // Text
  textPrimary:      "#2e1c1a",
  textSecondary:    "#7a5a58",
  textMuted:        "#b0908c",
  textInverse:      "#ffffff",

  // Brand
  brand:            "#6b4b45",
  brandDark:        "#4a2e2c",
  brandLight:       "#f0e0de",
  brandSoft:        "#faf5f4",

  // Drawer
  drawer:           "#dbbcb7",
  drawerText:       "#3a2a28",

  // Tab bar
  tabBar:           "#ffffff",
  tabActive:        "#6b4b45",
  tabInactive:      "#b0a09e",

  // Hero header
  heroHeader:       "#ffffff",
  heroHeaderShadow: "#000000",

  // Misc
  divider:          "#f0e0de",
  danger:           "#c0392b",
  dangerBg:         "#fde8e6",
  star:             "#f4c542",
  starEmpty:        "#e0d0ce",
  success:          "#4a7c59",
  overlay:          "rgba(0,0,0,0.3)",
};

const darkColors = {
  // Backgrounds
  background:       "#121212",
  backgroundSoft:   "#1e1e1e",
  backgroundHero:   "#2a1e1c",
  card:             "#1e1e1e",
  cardBorder:       "#2e2e2e",

  // Text
  textPrimary:      "#f0e0de",
  textSecondary:    "#c4a49f",
  textMuted:        "#7a5a58",
  textInverse:      "#ffffff",

  // Brand
  brand:            "#c4846e",
  brandDark:        "#e8c4b8",
  brandLight:       "#2e1e1c",
  brandSoft:        "#1e1412",

  // Drawer
  drawer:           "#1a1210",
  drawerText:       "#e8d0ce",

  // Tab bar
  tabBar:           "#1e1e1e",
  tabActive:        "#c4846e",
  tabInactive:      "#5a4a48",

  // Hero header
  heroHeader:       "#1a1210",
  heroHeaderShadow: "#000000",

  // Misc
  divider:          "#2e2e2e",
  danger:           "#e05a4a",
  dangerBg:         "#2e1412",
  star:             "#f4c542",
  starEmpty:        "#3a3030",
  success:          "#5a9c70",
  overlay:          "rgba(0,0,0,0.55)",
};

// ── Context ───────────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load persisted preference
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => { if (val !== null) setIsDark(val === "true"); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, String(next)); } catch {}
  };

  const colors = isDark ? darkColors : lightColors;

  if (!loaded) return null; // Don't flash wrong theme on first render

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

export default ThemeContext;