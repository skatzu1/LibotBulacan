// Validation for the sign-in / sign-up / reset / verify screens. One place for
// the rules and the wording, so the four screens can't drift apart.
//
// Each check returns an error string, or null when the value is fine.

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

export const emailError = (email) => {
  if (!String(email || "").trim()) return "Enter your email address.";
  if (!isValidEmail(email)) return "Enter a valid email, like name@example.com.";
  return null;
};

export const requiredPasswordError = (password) => (password ? null : "Enter your password.");

export const MIN_PASSWORD = 8;

export const newPasswordError = (password) => {
  if (!password) return "Enter a new password.";
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  return null;
};

export const confirmPasswordError = (password, confirm) => {
  if (!confirm) return "Enter the password again.";
  if (confirm !== password) return "Passwords don't match.";
  return null;
};

export const codeError = (code) =>
  /^\d{6}$/.test(String(code || "").trim()) ? null : "Enter the 6-digit code from your email.";

export const nameError = (name) => (String(name || "").trim() ? null : "Enter your full name.");

// Date of birth typed as MM/DD/YYYY (Register masks the input as you type).
export const dobError = (dob) => {
  const digits = String(dob || "").replace(/\D/g, "");
  if (!digits) return "Enter your date of birth.";
  if (digits.length < 8) return "Finish the date as MM/DD/YYYY.";
  const m = parseInt(digits.slice(0, 2), 10);
  const d = parseInt(digits.slice(2, 4), 10);
  const y = parseInt(digits.slice(4, 8), 10);
  const parsed = new Date(y, m - 1, d);
  const real = m >= 1 && m <= 12 && d >= 1 && y >= 1900
    && parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
  if (!real) return "That date doesn't exist. Check the month and day.";
  if (parsed > new Date()) return "Date of birth can't be in the future.";
  return null;
};

export const TERMS_ERROR = "Agree to the Terms and Privacy Policy to continue.";

export const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

/**
 * Sorts a Clerk error into the field it belongs to.
 *
 * Clerk tags field problems with `meta.paramName`, so "that email is taken"
 * can sit under the email box instead of in a popup. Returns
 * { field, message } where field is "email" | "password" | "name" | "code" |
 * null (a form-level problem).
 */
export function clerkErrorToField(err) {
  const e = err?.errors?.[0];
  if (!e) return { field: null, message: NETWORK_ERROR };

  const param = e.meta?.paramName || "";
  const field =
    param === "email_address" || param === "identifier" ? "email"
    : param === "password" ? "password"
    : param === "first_name" || param === "last_name" ? "name"
    : param === "code" ? "code"
    : null;

  switch (e.code) {
    case "form_identifier_exists":
      return { field: "email", message: "An account with this email already exists. Log in instead." };
    case "form_param_format_invalid":
      if (field === "email") return { field, message: "Enter a valid email, like name@example.com." };
      break;
    case "form_password_pwned":
      return { field: "password", message: "This password was found in a data breach. Choose a different one." };
    case "form_password_length_too_short":
      return { field: "password", message: `Use at least ${MIN_PASSWORD} characters.` };
    case "form_code_incorrect":
      return { field: "code", message: "That code isn't right. Check the email and try again." };
    case "verification_expired":
      return { field: "code", message: "This code has expired. Tap Resend for a new one." };
    case "too_many_requests":
      return { field: null, message: "Too many attempts. Wait a moment and try again." };
    default:
      break;
  }
  return { field, message: e.longMessage || e.message || "Something went wrong. Please try again." };
}
