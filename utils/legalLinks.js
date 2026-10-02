// utils/legalLinks.js
//
// Single source of truth for the app's legal / support URLs. Settings, the
// sign-up form and badge sharing all read from here.
//
// The pages live on the website (the LibotWeb repo, libot-download-site/
// privacy.html, terms.html, delete-account.html, help.html). They used to be served by the
// backend at libotbackend.onrender.com/...; those addresses now redirect
// here, so builds made before the move still open the right page.
export const SITE_URL = "https://libotbulacan.com";

export const HELP_URL    = `${SITE_URL}/help`;
export const ABOUT_URL   = SITE_URL;
export const TERMS_URL   = `${SITE_URL}/terms`;
export const PRIVACY_URL = `${SITE_URL}/privacy`;
// Edit Profile → Request account deletion. The app has no delete button;
// this page explains how to ask (by email) and what is deleted.
export const DELETE_ACCOUNT_URL = `${SITE_URL}/delete-account`;

// Settings → Report a Problem writes an email to this inbox (the developers',
// not the admin panel). See Screens/ReportProblem.js.
export const SUPPORT_EMAIL = "support@libotbulacan.com";

// A shared badge links to its badge page, which shows the badge and the
// download button: libot-download-site/badge.html, served at /badge/<id> by
// its vercel.json.
export const badgeShareUrl = (badgeId) => `${SITE_URL}/badge/${badgeId}`;
