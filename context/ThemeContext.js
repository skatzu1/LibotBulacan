import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "libot_dark_mode";

// ── Color palette ─────────────────────────────────────────────────────────────
// Light mode uses THREE colours: white page, cyan surfaces, yellow accents.
//   background  — the page. WHITE in light mode.
//   card / *Hero — cyan surfaces (the "base" brand colour) that sit on the
//                white page: cards, hero bands, drawer, sticky headers.
//   brand      — deep teal for ICONS / small accents / non-CTA fills. Safe as
//                text on white and on the cyan surfaces. NOT for headings.
//   brandDark  — near-neutral dark; the HEADING / high-emphasis text colour.
//   accent     — the yellow CTA colour. FILLS & HIGHLIGHTS ONLY, never raw text
//                on a light surface. `onAccent` is the dark text on a yellow fill.
//   onBrand    — text/icon colour that sits on a `brand` (teal) fill.
const lightColors = {
  // Backgrounds — white page, cyan "base" surfaces
  background:       "#FFFFFF",
  backgroundSoft:   "#EAF7F9",
  backgroundHero:   "#8FE1E9",   // bold cyan — hero bands / feature panels
  card:             "#D3EEF1",   // cyan-tinted card, clearly visible on white
  cardBorder:       "#BEE4E9",

  // Text (dark — legible on white AND on the cyan surfaces)
  textPrimary:      "#232B2C",
  textSecondary:    "#4C5A5B",
  textMuted:        "#66787A",
  textInverse:      "#FFFFFF",

  // Brand teal — for icons, small accents and fills (NOT headings).
  brand:            "#0C7A84",
  // Heading / high-emphasis text colour — near-neutral dark, never a saturated
  // teal (that reads as a broken blue link).
  brandDark:        "#1E2728",
  brandLight:       "#BEE8ED",   // pill / badge tint, a touch deeper than a card
  brandSoft:        "#E6F6F8",
  onBrand:          "#FFFFFF",

  // Accent (yellow CTA — fills & highlights only)
  accent:           "#F2CE1B",
  accentDark:       "#D4B200",
  accentSoft:       "#FBF1C4",
  onAccent:         "#2C2810",

  // Drawer (cyan base)
  drawer:           "#8FE1E9",
  drawerText:       "#1E2728",

  // Tab bar
  tabBar:           "#FFFFFF",
  tabActive:        "#0C7A84",
  tabInactive:      "#8A9A9C",

  // Hero header (cyan base band)
  heroHeader:       "#8FE1E9",
  heroHeaderShadow: "#000000",

  // Inputs — white, so they pop on the cyan cards
  inputBg:          "#FFFFFF",
  inputBorder:      "#BEE4E9",
  inputBorderFocus: "#0C7A84",
  placeholder:      "#7C8C8D",

  // Misc
  divider:          "#CFE9EC",
  danger:           "#C43D3D",
  dangerBg:         "#FCEBEB",
  warning:          "#A66A12",
  warningBg:        "#FBF0DD",
  star:             "#E8B31E",
  starEmpty:        "#CFE9EC",
  success:          "#1F8A5F",
  successBg:        "#E3F4EC",
  overlay:          "rgba(0,0,0,0.45)",
};

const darkColors = {
  // Backgrounds — dark teal-black, keeps the cyan family
  background:       "#0E1C1E",
  backgroundSoft:   "#16292C",
  backgroundHero:   "#0C3438",
  card:             "#172C2F",
  cardBorder:       "#2A4443",

  // Text (light — for dark cards and the near-black bg)
  textPrimary:      "#EAF6F7",
  textSecondary:    "#A6BEC0",
  textMuted:        "#7C9698",
  textInverse:      "#FFFFFF",

  // Brand cyan — for icons, small accents and fills (NOT headings).
  brand:            "#4FD0DC",
  // Heading / high-emphasis text colour — near-neutral light in dark mode.
  brandDark:        "#E8F4F5",
  brandLight:       "#123236",
  brandSoft:        "#0E282B",
  onBrand:          "#08201F",

  // Accent (yellow CTA — fills & highlights only)
  accent:           "#F2CE1B",
  accentDark:       "#F6DF5C",
  accentSoft:       "#242012",
  onAccent:         "#2C2810",

  // Drawer
  drawer:           "#0C3438",
  drawerText:       "#DCEFEF",

  // Tab bar
  tabBar:           "#172C2F",
  tabActive:        "#4FD0DC",
  tabInactive:      "#7C9698",

  // Hero header
  heroHeader:       "#172C2F",
  heroHeaderShadow: "#000000",

  // Inputs
  inputBg:          "#122629",
  inputBorder:      "#2A4443",
  inputBorderFocus: "#4FD0DC",
  placeholder:      "#7C9698",

  // Misc
  divider:          "#233C3C",
  danger:           "#E97A7A",
  dangerBg:         "#2C1414",
  warning:          "#E7B45C",
  warningBg:        "#2E2412",
  star:             "#F0C93C",
  starEmpty:        "#2A4443",
  success:          "#57C795",
  successBg:        "#123024",
  overlay:          "rgba(0,0,0,0.6)",
};

// ── Static design tokens ──────────────────────────────────────────────────────
// These do not change with the theme, so they're plain exports usable directly
// inside module-level StyleSheet.create(...). Colors stay dynamic (useTheme).

// 4-point spacing scale. "Soft & airy" — mid values run a little roomier so
// screens get more breathing room without every layout being retuned.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 36,
  xxxl: 56,
};

// Corner radii — generous and rounded for a soft, modern feel.
// `card` and `button` are semantic aliases: use them so a global tweak is
// a one-line change here.
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
  card: 22,
  button: 16,
};

// Type scale — larger, tighter display headings; roomier line-heights on body.
export const typography = {
  h1:         { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, lineHeight: 36 },
  h2:         { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, lineHeight: 30 },
  h3:         { fontSize: 19, fontWeight: '700', letterSpacing: -0.2, lineHeight: 25 },
  title:      { fontSize: 16, fontWeight: '700', letterSpacing: -0.1 },
  body:       { fontSize: 14, fontWeight: '400', lineHeight: 21 },
  bodyStrong: { fontSize: 14.5, fontWeight: '600', lineHeight: 21 },
  label:      { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  caption:    { fontSize: 11.5, fontWeight: '500', lineHeight: 16 },
};

// Elevation presets — soft, wide, low-opacity diffuse shadows (not hard drops).
// iOS reads shadow*, Android reads elevation — both set.
export const shadow = {
  none: {},
  sm: {
    shadowColor: '#0B2E31', shadowOpacity: 0.04, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  md: {
    shadowColor: '#0B2E31', shadowOpacity: 0.06, shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 }, elevation: 3,
  },
  lg: {
    shadowColor: '#0B2E31', shadowOpacity: 0.10, shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 }, elevation: 6,
  },
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
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors, spacing, radius, type: typography, shadow }}>
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