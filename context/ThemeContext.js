import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";

const STORAGE_KEY = "libot_theme_pref";   // "light" | "dark" | "system"

// ── Color palette ─────────────────────────────────────────────────────────────
// Light mode is built on a WARM PAPER page, not sterile white. The reference is
// capiz shell and old plaza signage — Bulacan is the cradle of the Republic, not
// a beach resort, and a pure-white + pastel page read as the latter.
//
//   background  — capiz cream. The page.
//   card        — WHITE. Cards now LIFT off the warm page instead of tinting it,
//                 which is where depth comes from. (Previously both were cyan-ish,
//                 so every surface sat flat at the same level.)
//   brand       — deep teal for ICONS / small accents / non-CTA fills. AA on both
//                 the page and on cards. NOT for headings.
//   brandDark   — near-neutral dark; the HEADING / high-emphasis text colour.
//   brandLight  — the cyan, DEMOTED to punctuation: pills, badges, icon wells.
//                 It is no longer a surface colour.
//   accent      — the yellow CTA. FILLS & HIGHLIGHTS ONLY, never raw text on a
//                 light surface. `onAccent` is the dark text on a yellow fill.
//   accentDark  — the readable amber for TEXT on accentSoft (the raw accent is
//                 1.5:1 on white and can never be text).
//   onBrand     — text/icon colour that sits on a `brand` (teal) fill.
//
// The admin panel (libot-admin-1/src/index.css) and the website
// (LibotWeb/libot-download-site/styles.css) carry the same values as CSS
// variables, light and dark, so the three read as one product. Change a
// colour here and change it there too.
//
// Every foreground/background pair used in the app is verified at >= 4.5:1
// (WCAG AA body text). Do not lighten a text token without re-checking it
// against `background`, `card` AND `brandLight`.
export const lightColors = {
  // Backgrounds — warm paper page, white cards
  background:       "#FBF8F2",   // capiz cream
  backgroundSoft:   "#F4EFE4",
  backgroundHero:   "#8FE1E9",   // bold cyan — reserved for feature panels
  card:             "#FFFFFF",
  cardBorder:       "#E8E0D0",

  // Text — verified on background, card and brandLight
  textPrimary:      "#1C2426",   // 14.90 on page / 15.79 on card
  textSecondary:    "#455254",   //  7.65 / 8.11
  textMuted:        "#56686A",   //  5.53 / 5.86 / 4.82 on brandLight
  textInverse:      "#FFFFFF",

  // Brand teal — icons, small accents, fills (NOT headings).
  brand:            "#0A6F78",   //  5.57 / 5.90 / 4.85 on brandLight
  brandDark:        "#1C2426",
  brandLight:       "#D3EEF1",   // cyan tint — pills & icon wells only
  brandSoft:        "#E6F6F8",
  onBrand:          "#FFFFFF",

  // Accent (yellow CTA — fills & highlights only)
  accent:           "#F2CE1B",
  accentDark:       "#7A6000",   //  5.28 on accentSoft — safe as text
  accentSoft:       "#FBF1C4",
  onAccent:         "#2C2810",   //  9.60 on accent

  // Achievement tiers: spots iron, towns bronze, districts silver (gold is the
  // accent). The *Ink colours are for text on the *Soft ones.
  iron:             "#5E5A57",
  ironInk:          "#3D3A38",   //  9.0 on ironSoft
  ironSoft:         "#E8E5E2",
  bronze:           "#B4703A",
  bronzeInk:        "#7A4A22",   //  6.06 on bronzeSoft
  bronzeSoft:       "#F6E6D8",
  silver:           "#8E9AA3",
  silverInk:        "#4A555D",   //  6.48 on silverSoft
  silverSoft:       "#E9EDF0",

  // Drawer (retained so any stray reference still resolves; the drawer
  // navigator itself was removed in favour of tabs + quick actions.)
  drawer:           "#FBF8F2",
  drawerText:       "#1C2426",

  // Tab bar
  tabBar:           "#FFFFFF",
  tabActive:        "#0A6F78",
  tabInactive:      "#5F7173",   //  5.13 on the white bar

  // Hero header
  heroHeader:       "#8FE1E9",
  heroHeaderShadow: "#000000",

  // Inputs
  inputBg:          "#FFFFFF",
  inputBorder:      "#E8E0D0",
  inputBorderFocus: "#0A6F78",
  placeholder:      "#5F7173",   //  5.13 on the white input

  // Misc
  divider:          "#EAE3D6",
  danger:           "#B3352C",   //  6.07 on card
  dangerBg:         "#FBEDEB",
  onDanger:         "#FFFFFF",   //  6.07 on a danger fill (destructive buttons)
  warning:          "#8A5610",   //  5.79 on page
  warningBg:        "#FBF0DD",
  star:             "#E8B31E",   // decorative FILL only, never text
  starEmpty:        "#E0D8C8",
  success:          "#16764F",   //  5.62 on card
  successBg:        "#E3F4EC",
  overlay:          "rgba(0,0,0,0.45)",

  // Screens drawn over a photograph (welcome, sign-in, sign-up). The veil tints
  // the whole photo toward the page; the panel is the page colour, slightly
  // see-through. Measured against the DARKEST pixel of assets/bg.png: every
  // text token on the panel stays >= 4.5:1 (lowest: success 4.86).
  photoVeil:        "rgba(251,248,242,0.25)",
  panelOverPhoto:   "rgba(251,248,242,0.90)",
  // Band behind white headline text sitting directly on the photo.
  photoScrim:       "rgba(12,34,36,0.68)",
};

// Dark mode is the SAME paper at night, not a second product. It used to be a
// cold teal-black family that shared no hue with the cream light mode (a defense
// panel note, 2026-10-31). Now every surface is the light token's warm hue
// (~38°) turned down: cream page → warm ink page, white card → a lifted warm
// card, beige border → umber, ink text → cream text. Teal and yellow keep the
// same jobs they have in light mode: punctuation, never the surface.
//
// Ratios are against background / card (and brandLight where pills use them).
export const darkColors = {
  // Backgrounds — warm ink page, cards one step lighter (same lift as light)
  background:       "#17140F",   // the cream page at night
  backgroundSoft:   "#1F1B15",
  backgroundHero:   "#113538",   // light's bold cyan panel → deep teal panel
  card:             "#221E18",
  cardBorder:       "#3A3329",

  // Text — the cream page colour becomes the ink. The admin panel and the
  // website use these exact values too.
  textPrimary:      "#F3EEE4",   // 15.88 on page / 14.33 on card
  textSecondary:    "#C9C0B0",   // 10.19 / 9.20
  textMuted:        "#A99F8D",   //  7.02 / 6.34 / 4.89 on brandLight
  textInverse:      "#FFFFFF",

  // Brand teal, lifted for a dark page — icons, small accents, fills.
  brand:            "#5CCFD9",   //  9.95 / 8.98 / 6.93 on brandLight
  brandDark:        "#F3EEE4",   // heading colour = textPrimary, as in light
  brandLight:       "#16373A",   // teal well — pills & icon wells only
  brandSoft:        "#122C2F",
  onBrand:          "#0B1F21",   //  9.24 on brand

  // Accent (yellow CTA — fills & highlights only)
  accent:           "#F2CE1B",
  accentDark:       "#F6DF5C",   // 11.46 on accentSoft
  accentSoft:       "#2B2412",
  onAccent:         "#2C2810",   //  9.60 on accent

  // Achievement tiers (see the light palette).
  iron:             "#9A938D",
  ironInk:          "#D3CCC4",   //  9.58 on ironSoft
  ironSoft:         "#29251F",
  bronze:           "#D08A50",
  bronzeInk:        "#E8B488",   //  8.62 on bronzeSoft
  bronzeSoft:       "#2C1F14",
  silver:           "#B9C3CA",
  silverInk:        "#D6DEE3",   // 11.02 on silverSoft
  silverSoft:       "#24272A",

  // Drawer
  drawer:           "#17140F",
  drawerText:       "#F3EEE4",

  // Tab bar — the card colour, as light mode's bar is the white card
  tabBar:           "#221E18",
  tabActive:        "#5CCFD9",   //  8.98 on the bar
  tabInactive:      "#A99F8D",   //  6.34 on the bar

  // Hero header
  heroHeader:       "#221E18",
  heroHeaderShadow: "#000000",

  // Inputs — a shade below the card, so a field reads as a well
  inputBg:          "#1C1813",
  inputBorder:      "#3A3329",
  inputBorderFocus: "#5CCFD9",
  placeholder:      "#9C927F",   //  5.74 on the input

  // Misc
  divider:          "#2F2A22",
  danger:           "#F29A8E",   //  7.73 on card
  dangerBg:         "#2E1814",
  // Dark text on the light dark-mode red, as the admin panel does: white on
  // it is only 2.4:1.
  onDanger:         "#2A0E0E",   //  8.38 on danger
  warning:          "#F0C264",
  warningBg:        "#2E2412",
  star:             "#F0C93C",
  starEmpty:        "#3A3329",
  success:          "#6FD3A0",   //  9.08 on card
  successBg:        "#15291F",
  overlay:          "rgba(0,0,0,0.6)",

  // A heavy warm veil: the bright cyan/yellow photo becomes a dim backdrop
  // instead of a glare, in the page's own colour (as the light veil is cream).
  photoVeil:        "rgba(23,20,15,0.80)",
  panelOverPhoto:   "rgba(23,20,15,0.92)",
  photoScrim:       "rgba(12,34,36,0.68)",
};

// ── Welcome / sign-in / sign-up ───────────────────────────────────────────────
// These used to be a fixed cyan/yellow surface (the `auth` palette) that ignored
// dark mode, so the app's front door looked like a different product from its
// interior. The user asked for one palette everywhere: they now use the same
// tokens as every other screen, plus photoVeil / panelOverPhoto / photoScrim
// above for sitting on the Bulacan photograph. See components/AuthScaffold.js.

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

// ── Fonts ─────────────────────────────────────────────────────────────────────
// IMPORTANT: React Native does NOT synthesize weights for custom fonts. Setting
// `fontWeight` alongside a custom `fontFamily` is a no-op on Android and
// unpredictable on iOS. Every weight is therefore a SEPARATE FAMILY NAME, and
// styles must set `fontFamily` instead of `fontWeight`.
//
// Momo Trust Display: every heading and every bold (700+) — titles, buttons,
// labels, names, numbers. It ships one weight only, and that weight is
// already heavy, so the three display keys all point at it.
// Dongle: everything else, UI and body copy. It has no 500 or 600: medium
// takes the regular face (quiet text, as in the admin panel) and semibold the
// bold one. The files in assets/fonts are Dongle cut to its Latin letters
// (the Korean ones made each file 4.4 MB) and scaled up 1.72x through
// unitsPerEm, because Dongle's letters are small for their size: 14px of it
// now reads like 14px of any other sans, as the admin panel's size-adjust
// does. Line box 0.96 em up, 0.26 em down, also as in the panel.
export const fonts = {
  display:     'MomoTrustDisplay_400Regular',
  displaySemi: 'MomoTrustDisplay_400Regular',
  displayBlack:'MomoTrustDisplay_400Regular',
  sans:        'Dongle_400Regular',
  sansMedium:  'Dongle_400Regular',
  sansSemi:    'Dongle_700Bold',
  sansBold:    'MomoTrustDisplay_400Regular',
};

// Maps a legacy numeric fontWeight onto the correct family. 700, 800 and 900
// all resolve to Momo Trust Display, which has no heavier weight.
export const weightFamily = {
  '400': fonts.sans,       '500': fonts.sansMedium,
  '600': fonts.sansSemi,   '700': fonts.sansBold,
  '800': fonts.sansBold,   '900': fonts.sansBold,
  normal: fonts.sans,      bold:  fonts.sansBold,
};

// Type scale. Display sizes use Momo Trust Display; everything from h3 down is
// Dongle, so headings carry character and UI text stays quiet.
export const typography = {
  h1:         { fontFamily: fonts.display,     fontSize: 32,   letterSpacing: -0.4, lineHeight: 38 },
  h2:         { fontFamily: fonts.display,     fontSize: 25,   letterSpacing: -0.3, lineHeight: 31 },
  h3:         { fontFamily: fonts.sansSemi,    fontSize: 19,   letterSpacing: -0.1, lineHeight: 25 },
  // `display` is the editorial variant of h2 for hero moments (screen intros,
  // rank numerals, badge names).
  display:    { fontFamily: fonts.display,     fontSize: 28,   letterSpacing: -0.3, lineHeight: 34 },
  title:      { fontFamily: fonts.sansSemi,    fontSize: 16,   letterSpacing: -0.1 },
  body:       { fontFamily: fonts.sans,        fontSize: 14.5, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansMedium,  fontSize: 14.5, lineHeight: 22 },
  label:      { fontFamily: fonts.sansSemi,    fontSize: 12,   letterSpacing: 0.3 },
  caption:    { fontFamily: fonts.sansMedium,  fontSize: 11.5, lineHeight: 16 },
};

// ── Layout constants ──────────────────────────────────────────────────────────
// The bottom tab bar floats above the content, so every scrolling screen inside
// the tabs needs to reserve room for it. Derive from this instead of repeating
// a magic `paddingBottom: 150`.
export const TAB_BAR_HEIGHT    = 66;
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + 56;

// Caps runaway system font scaling on text inside fixed-height containers
// (grid cards, the tab bar, pills). Body copy that can reflow should NOT use
// this — it should be allowed to grow.
export const MAX_FONT_SCALE = 1.35;

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
  // app.json declares `userInterfaceStyle: "automatic"`, which means the OS will
  // render native surfaces (keyboard, action sheets, share sheet) to match the
  // system setting. Previously this provider ignored the system entirely and
  // defaulted to light, so a user in OS dark mode got a light app with dark
  // native chrome. "system" is now the default and is honoured.
  const systemScheme = useColorScheme();
  const [pref, setPref]     = useState("system");   // "light" | "dark" | "system"
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (val === "light" || val === "dark" || val === "system") setPref(val);
        // Migrate the old boolean key ("true"/"false") written by earlier builds.
        else if (val === "true")  setPref("dark");
        else if (val === "false") setPref("light");
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const isDark = pref === "system" ? systemScheme === "dark" : pref === "dark";

  const setThemePref = async (next) => {
    setPref(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, next); } catch {}
  };

  // Kept for existing callers (Settings' switch). Toggling picks an explicit
  // mode, which deliberately opts out of following the system from then on.
  const toggleTheme = () => setThemePref(isDark ? "light" : "dark");

  const colors = isDark ? darkColors : lightColors;

  // The native root view shows through during screen transitions, behind the
  // keyboard and on overscroll. It defaults to white, so dark mode flashed
  // white there; keep it the page colour of whichever theme is on.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  if (!loaded) return null; // Don't flash wrong theme on first render

  return (
    <ThemeContext.Provider
      value={{
        isDark, pref, toggleTheme, setThemePref,
        colors, spacing, radius, type: typography, fonts, shadow,
      }}
    >
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