/*
 * The app's UI face (Dongle) for the two Leaflet maps, Screens/Track.js and
 * components/MissionMap.js. Both pages paste MAP_FONT_FACES into their <style>
 * and use MAP_FONT as the font-family.
 *
 * Dongle's letters are small for their size, so the app ships it scaled up
 * 1.72x (assets/fonts, see the note in context/ThemeContext.js). In the
 * WebView the same scale comes from size-adjust, with the line box tightened
 * to match, as the admin panel does. Latin and Latin Extended files from
 * Google Fonts; they load only when text needs them, and offline the map falls
 * back to the system font.
 */
const GSTATIC = 'https://fonts.gstatic.com/s/dongle/v16/';
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF';

const face = (file, weight, range) => `
  @font-face {
    font-family:'Dongle Libot'; font-style:normal; font-weight:${weight}; font-display:swap;
    src:url(${GSTATIC}${file}.woff2) format('woff2');
    size-adjust:172%; ascent-override:55.8%; descent-override:15.1%; line-gap-override:0%;
    unicode-range:${range};
  }`;

// 400 and 500 take the regular file, 600 to 900 the bold, as in the app.
export const MAP_FONT_FACES = [
  face('sJoF3Ltdjt6VPkqWuu5O', '100 500', LATIN),
  face('sJoF3Ltdjt6VPkqWtO5OWh4', '100 500', LATIN_EXT),
  face('sJoG3Ltdjt6VPkqeActbZT-M', '600 900', LATIN),
  face('sJoG3Ltdjt6VPkqeActbaz-M_Xs', '600 900', LATIN_EXT),
].join('');

export const MAP_FONT = "'Dongle Libot',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
