import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
// Every foreground/background pair used in the app is verified at >= 4.5:1
// (WCAG AA body text). Do not lighten a text token without re-checking it
// against `background`, `card` AND `brandLight`.
const lightColors = {
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
  warning:          "#8A5610",   //  5.79 on page
  warningBg:        "#FBF0DD",
  star:             "#E8B31E",   // decorative FILL only, never text
  starEmpty:        "#E0D8C8",
  success:          "#16764F",   //  5.62 on card
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
  textMuted:        "#87A1A3",   // bumped: #7C9698 was 4.35 on brandLight
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
  tabInactive:      "#87A1A3",

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

// ── Auth & onboarding surface ─────────────────────────────────────────────────
// The pre-login screens (Welcome, Login, Register, Forgot Password) are a fixed
// BRAND SURFACE built from the approved mockups: a duotone Bulacan photo under a
// cyan→yellow wash, then a panel with one oversized corner. They deliberately do
// NOT follow light/dark — this is the product's front door and it should look the
// same to everyone, the way a splash screen does. The interior of the app keeps
// the calmer warm-paper palette so a long browsing session isn't shouting.
//
// Contrast note: the mockup's own greys don't survive scrutiny — its placeholder
// grey measures 3.5:1 on the tinted fields. `ink` and `muted` below are the
// corrected values (5.5–8.1:1) at visually the same weight.
export const auth = {
  // Panels
  cyanPanel:   "#A8E9F2",
  cyanField:   "#BDEFF5",
  yellowPanel: "#F8E27E",
  yellowField: "#FBEC9F",

  // Duotone wash over the hero photograph
  washTop:     "#6FE0EC",
  washMid:     "#E8E84A",
  washBottom:  "#7FE3EC",

  // Text
  ink:         "#384142",   //  7.79 on cyanPanel · 8.07 on yellowPanel
  muted:       "#4F5D5F",   //  5.49 on cyanField · 5.75 on yellowField
  onPhoto:     "#FFFFFF",

  // The onboarding CTA yellow is a touch more lemon than the in-app `accent`,
  // which is what the mockups use.
  cta:         "#F5E81C",
  onCta:       "#2C2810",   // 11.59 on cta

  // One oversized corner is the signature of this surface. 64 is large enough to
  // read as a deliberate shape rather than a rounding mistake.
  panelCorner: 64,
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

// ── Fonts ─────────────────────────────────────────────────────────────────────
// IMPORTANT: React Native does NOT synthesize weights for custom fonts. Setting
// `fontWeight` alongside a custom `fontFamily` is a no-op on Android and
// unpredictable on iOS. Every weight is therefore a SEPARATE FAMILY NAME, and
// styles must set `fontFamily` instead of `fontWeight`.
//
// Newsreader: editorial serif with an `opsz` axis. Display only.
// Schibsted Grotesk: workhorse for UI and body copy.
//
// `displayBlack` is ExtraBold, not Black. Newsreader's heaviest weight is 800;
// there is no 900 to load. The key keeps its name because Home.js and ui.js
// both reference it, and the two call sites set it at 60 and 64pt where the
// difference between 800 and 900 is not what carries the headline.
export const fonts = {
  display:     'Newsreader_700Bold',
  displaySemi: 'Newsreader_600SemiBold',
  displayBlack:'Newsreader_800ExtraBold',
  sans:        'SchibstedGrotesk_400Regular',
  sansMedium:  'SchibstedGrotesk_500Medium',
  sansSemi:    'SchibstedGrotesk_600SemiBold',
  sansBold:    'SchibstedGrotesk_700Bold',
};

// Maps a legacy numeric fontWeight onto the correct family. Schibsted Grotesk
// does publish 800 and 900, but only 400/500/600/700 are loaded in App.js, so
// both still resolve to Bold. Add the faces there first if you want them.
export const weightFamily = {
  '400': fonts.sans,       '500': fonts.sansMedium,
  '600': fonts.sansSemi,   '700': fonts.sansBold,
  '800': fonts.sansBold,   '900': fonts.sansBold,
  normal: fonts.sans,      bold:  fonts.sansBold,
};

// Type scale. Display sizes use Newsreader; everything from h3 down is
// Schibsted Grotesk, so headings carry character and UI text stays quiet.
export const typography = {
  h1:         { fontFamily: fonts.display,     fontSize: 32,   letterSpacing: -0.4, lineHeight: 38 },
  h2:         { fontFamily: fonts.display,     fontSize: 25,   letterSpacing: -0.3, lineHeight: 31 },
  h3:         { fontFamily: fonts.sansSemi,    fontSize: 19,   letterSpacing: -0.1, lineHeight: 25 },
  // `display` is the editorial variant of h2 for hero moments (screen intros,
  // rank numerals, badge names) where the serif should be unmistakable.
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