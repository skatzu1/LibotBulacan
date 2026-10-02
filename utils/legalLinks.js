// utils/legalLinks.js
//
// Single source of truth for the app's legal / support URLs. Settings, the
// sign-up form and badge sharing all read from here.
//
// The pages live on the website (the LibotWeb repo, libot-download-site/
// privacy.html, terms.html, help.html). They used to be served by the
// backend at libotbackend.onrender.com/...; those addresses now redirect
// here, so builds made before the move still open the right page.
export const SITE_URL = "https://libotbulacan.com";

export const HELP_URL    = `${SITE_URL}/help`;
export const ABOUT_URL   = SITE_URL;
export const TERMS_URL   = `${SITE_URL}/terms`;
export const PRIVACY_URL = `${SITE_URL}/privacy`;

// A shared badge links to its badge page, which shows the badge and the
// download button: libot-download-site/badge.html, served at /badge/<id> by
// its vercel.json.
export const badgeShareUrl = (badgeId) => `${SITE_URL}/badge/${badgeId}`;
