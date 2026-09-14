// utils/legalLinks.js
//
// Single source of truth for the app's legal / support URLs. Previously these
// were duplicated in two places that had drifted apart: Register.js had
// literal unfinished placeholders ("REPLACE_WITH_YOUR_TOS_UUID"), and
// Settings.js pointed at the backend API's own domain instead. Both are
// consolidated here so there's exactly one place to update.
//
// TODO: swap TERMS_URL / PRIVACY_URL for the real Termly-hosted policy pages
// (Termly gives you a URL like
// https://app.termly.io/policy-viewer/policy.html?policyUUID=<your-uuid>
// once you publish the policy) once you have the actual policyUUID values —
// the backend routes below are a placeholder, not a real destination, until
// the Express app actually serves HTML at these paths.
export const HELP_URL    = "https://libotbackend.onrender.com/help";
export const ABOUT_URL   = "https://libotbackend.onrender.com/about";
export const TERMS_URL   = "https://libotbackend.onrender.com/terms";
export const PRIVACY_URL = "https://libotbackend.onrender.com/privacy";
