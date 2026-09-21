import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Text,
  ActivityIndicator,
  Platform,
  Image,
  Linking,
} from "react-native";
import { showAlert, showToast } from "../components/AppAlert";
import { useState, useEffect, useCallback } from "react";
import CheckBox from "expo-checkbox";
import { useSignUp, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { authAPI } from "../api";
import { auth as A, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import { TERMS_URL as TERMS_OF_SERVICE_URL, PRIVACY_URL as PRIVACY_POLICY_URL } from "../utils/legalLinks";
import AuthScaffold, { authStyles as a } from "../components/AuthScaffold";
import Icon from "../components/Icon";

WebBrowser.maybeCompleteAuthSession();

// ── Password strength helpers ──────────────────────────────────────
const PASSWORD_RULES = [
  { id: "length",  label: "At least 8 characters",          test: (p) => p.length >= 8 },
  { id: "upper",   label: "One uppercase letter",            test: (p) => /[A-Z]/.test(p) },
  { id: "number",  label: "One number",                      test: (p) => /\d/.test(p) },
  { id: "special", label: "One special character (!@#$…)",   test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// Strength colours are picked to sit on the YELLOW panel, not on the app's
// cards — the in-app `danger`/`warning` tokens wash out against #F8E27E.
const STRENGTH = [
  { label: "Weak",   color: "#8E1F16" },
  { label: "Fair",   color: "#8A4B0A" },
  { label: "Good",   color: "#5C5A10" },
  { label: "Strong", color: "#1C5E3F" },
];

function getStrength(password) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  if (passed <= 1)  return { level: 0, ...STRENGTH[0] };
  if (passed === 2) return { level: 1, ...STRENGTH[1] };
  if (passed === 3) return { level: 2, ...STRENGTH[2] };
  return              { level: 3, ...STRENGTH[3] };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function openLink(url) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      showAlert("Unable to Open Link", "Please check your internet connection and try again.");
    }
  } catch (err) {
    console.error("openLink error:", err);
    showAlert("Unable to Open Link", "Something went wrong opening that page.");
  }
}

// ── Password Strength Widget ───────────────────────────────────────
function PasswordStrengthPanel({ password }) {
  if (!password) return null;
  const strength = getStrength(password);
  return (
    <View style={styles.strengthPanel} accessibilityLiveRegion="polite">
      <View style={styles.strengthTrack}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.strengthSeg,
              { backgroundColor: i <= strength.level ? strength.color : "rgba(56,65,66,0.18)" },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
      <View style={styles.criteriaList}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <View key={rule.id} style={styles.criteriaRow}>
              <Icon
                name={ok ? "check-circle" : "circle"}
                size={13}
                weight={ok ? "fill" : "regular"}
                color={ok ? "#1C5E3F" : A.muted}
              />
              <Text style={[styles.criteriaText, { color: ok ? "#1C5E3F" : A.muted }]}>
                {rule.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function Register({ navigation }) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { startOAuthFlow }              = useOAuth({ strategy: "oauth_google" });

  const [name, setName]                   = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [agreeToTerms, setAgreeToTerms]   = useState(false);
  const [dob, setDob]                     = useState("");
  const [isLoading, setIsLoading]         = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Inline validation errors (shown after field blur)
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS !== "android") WebBrowser.coolDownAsync();
    };
  }, []);

  // ── Validation logic ──
  const validate = useCallback(() => {
    const e = {};
    if (!name.trim())            e.name     = "Full name is required.";
    if (!email.trim())           e.email    = "Email address is required.";
    else if (!isValidEmail(email)) e.email  = "Enter a valid email address.";
    if (!password)               e.password = "Password is required.";
    else if (getStrength(password).level < 2)
                                 e.password = "Password is too weak.";

    // Date of birth (single masked field, MM/DD/YYYY)
    const digits = dob.replace(/\D/g, "");
    if (digits.length < 8) {
      e.dob = "Date of birth is required.";
    } else {
      const m = parseInt(digits.slice(0, 2), 10);
      const d = parseInt(digits.slice(2, 4), 10);
      const y = parseInt(digits.slice(4, 8), 10);
      if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > new Date().getFullYear()) {
        e.dob = "Enter a valid date of birth.";
      } else {
        const parsed = new Date(y, m - 1, d);
        const isRealDate =
          parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
        if (!isRealDate) e.dob = "Enter a valid date of birth.";
        else if (parsed > new Date()) e.dob = "Date of birth can't be in the future.";
      }
    }
    return e;
  }, [name, email, password, dob]);

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate();
    setErrors((prev) => ({ ...prev, [field]: errs[field] }));
  };

  const fieldError = (field) => (touched[field] ? errors[field] : null);

  // ── Date of Birth masked input helper ──
  // Formats raw digit entry into MM/DD/YYYY as the user types.
  const handleDobChange = (text) => {
    const digits = text.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setDob(formatted);
  };

  const handleDobBlur = () => handleBlur("dob");

  // ── Google signup ──
  const handleGoogleSignUp = async () => {
    if (isGoogleLoading || !isLoaded) return;
    if (!agreeToTerms) {
      showAlert("Terms Required", "Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setIsGoogleLoading(true);
    try {
      const { createdSessionId } = await startOAuthFlow();
      if (!createdSessionId) throw new Error("No session returned from Google OAuth");
      await setActive({ session: createdSessionId });
      const saveUserResult = await authAPI.register({ clerkSessionId: createdSessionId, isGoogle: true });
      if (!saveUserResult.success)
        return showAlert("Sign Up Failed", saveUserResult.message || "Could not save user");
      showToast("Account created with Google!", { type: "success" });
      navigation.navigate("Home");
    } catch (err) {
      console.error("Google Sign Up Error:", err);
      showAlert("Sign Up Failed", err.message || "Unable to sign up with Google.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // ── Email signup ──
  const handleRegister = async () => {
    // Mark all fields touched so errors surface
    setTouched({ name: true, email: true, password: true, dob: true });
    const errs = validate();
    setErrors(errs);

    if (Object.keys(errs).length > 0) return;
    if (!agreeToTerms)
      return showAlert("Terms Required", "Please agree to the Terms of Service and Privacy Policy to continue.");
    if (!isLoaded)
      return showAlert("Error", "Authentication system is loading. Please wait.");

    setIsLoading(true);
    try {
      const [firstName, ...lastNameParts] = name.trim().split(" ");
      const lastName = lastNameParts.join(" ") || "";
      const signUpResult = await signUp.create({ emailAddress: email.trim(), password, firstName, lastName });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      navigation.navigate("EmailVerification", {
        email: email.trim(), firstName, lastName, fromLogin: false, signUpId: signUpResult.id,
      });
    } catch (err) {
      console.error("Email Registration Error:", err);
      const errorCode    = err.errors?.[0]?.code;
      const errorMessage = err.errors?.[0]?.message;
      if (errorCode === "form_identifier_exists") {
        setErrors((prev) => ({ ...prev, email: "An account with this email already exists." }));
        setTouched((prev) => ({ ...prev, email: true }));
      } else {
        showAlert("Registration Failed", errorMessage || "Unable to register. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading;
  const disabled   = anyLoading || !isLoaded;

  const field = (hasError) => [
    a.field,
    { backgroundColor: A.yellowField },
    hasError && styles.fieldError,
  ];

  return (
    <AuthScaffold
      variant="yellow"
      hero="bubbles"
      showLogo={false}
      onBack={() => navigation.navigate("Login")}
      title="Create an Account"
      subtitle="Fill in the form to continue"
    >
      {/* Google */}
      <TouchableOpacity
        style={[a.googleBtn, disabled && styles.disabled]}
        onPress={handleGoogleSignUp}
        disabled={disabled}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        {isGoogleLoading ? (
          <ActivityIndicator color={A.muted} />
        ) : (
          <>
            <Image source={require("../assets/googlelogo.png")} style={a.googleLogo} />
            <Text style={a.googleText} maxFontSizeMultiplier={MAX_FONT_SCALE}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={a.dividerRow}>
        <View style={a.dividerLine} />
        <Text style={a.dividerText}>OR</Text>
        <View style={a.dividerLine} />
      </View>

      {/* Full name */}
      <View>
        <TextInput
          style={field(fieldError("name"))}
          placeholder="FULL NAME"
          placeholderTextColor={A.muted}
          value={name}
          onChangeText={setName}
          onBlur={() => handleBlur("name")}
          editable={!anyLoading}
          accessibilityLabel="Full name"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
        {!!fieldError("name") && <Text style={a.errorText}>{fieldError("name")}</Text>}
      </View>

      {/* Email */}
      <View>
        <TextInput
          style={field(fieldError("email"))}
          placeholder="EMAIL"
          placeholderTextColor={A.muted}
          value={email}
          onChangeText={setEmail}
          onBlur={() => handleBlur("email")}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!anyLoading}
          accessibilityLabel="Email address"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
        {!!fieldError("email") && <Text style={a.errorText}>{fieldError("email")}</Text>}
      </View>

      {/* Password */}
      <View>
        <View style={a.fieldRow}>
          <TextInput
            style={[...field(fieldError("password")), { paddingRight: 60 }]}
            placeholder="PASSWORD"
            placeholderTextColor={A.muted}
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
            onBlur={() => handleBlur("password")}
            editable={!anyLoading}
            accessibilityLabel="Password"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <TouchableOpacity
            onPress={() => setPasswordVisible((v) => !v)}
            style={a.eyeBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
          >
            <Icon name={passwordVisible ? "eye-off" : "eye"} size={20} color={A.muted} />
          </TouchableOpacity>
        </View>
        {!!fieldError("password") && <Text style={a.errorText}>{fieldError("password")}</Text>}
        <PasswordStrengthPanel password={password} />
      </View>

      {/* Date of birth */}
      <View>
        <Text style={a.label}>DATE OF BIRTH</Text>
        <TextInput
          style={field(fieldError("dob"))}
          placeholder="MM/DD/YYYY"
          placeholderTextColor={A.muted}
          value={dob}
          onChangeText={handleDobChange}
          onBlur={handleDobBlur}
          keyboardType="number-pad"
          maxLength={10}
          editable={!anyLoading}
          accessibilityLabel="Date of birth, month slash day slash year"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
        {!!fieldError("dob") && <Text style={a.errorText}>{fieldError("dob")}</Text>}
      </View>

      {/* Terms */}
      <View style={styles.termsRow}>
        <CheckBox
          value={agreeToTerms}
          onValueChange={setAgreeToTerms}
          color={agreeToTerms ? A.ink : undefined}
          style={styles.checkbox}
          accessibilityLabel="Agree to the Terms and Conditions"
        />
        <Text style={styles.termsText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Agree to the{" "}
          <Text style={styles.termsLink} onPress={() => openLink(TERMS_OF_SERVICE_URL)}>
            Terms and Conditions
          </Text>
          {" "}and{" "}
          <Text style={styles.termsLink} onPress={() => openLink(PRIVACY_POLICY_URL)}>
            Privacy Policy
          </Text>
        </Text>
      </View>

      {/* Sign up — WHITE, not the CTA yellow: a yellow button on a yellow panel
          has nothing to sit against. The mockup makes the same call. */}
      <TouchableOpacity
        style={[styles.signupBtn, disabled && styles.disabled]}
        onPress={handleRegister}
        disabled={disabled}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Sign up"
      >
        {isLoading ? <ActivityIndicator color={A.ink} /> : <Text style={styles.signupText}>Sign up</Text>}
      </TouchableOpacity>

      <View style={a.linkRow}>
        <Text style={a.linkMuted}>Already Registered? </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Log in to an existing account"
        >
          <Text style={a.linkBold}>Log in here</Text>
        </TouchableOpacity>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  disabled:   { opacity: 0.6 },
  fieldError: { borderWidth: 1.5, borderColor: "#8E1F16" },

  strengthPanel: { marginTop: 12, paddingHorizontal: 8, gap: 8 },
  strengthTrack: { flexDirection: "row", gap: 5 },
  strengthSeg:   { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 0.3 },
  criteriaList:  { gap: 4 },
  criteriaRow:   { flexDirection: "row", alignItems: "center", gap: 7 },
  criteriaText:  { fontFamily: fonts.sansMedium, fontSize: 12.5 },

  termsRow:  { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingHorizontal: 6, marginTop: 4 },
  checkbox:  { width: 20, height: 20, borderRadius: 5, marginTop: 1 },
  termsText: { flex: 1, fontFamily: fonts.sansSemi, fontSize: 14, lineHeight: 20, color: A.ink },
  termsLink: { fontFamily: fonts.sansBold, textDecorationLine: "underline" },

  signupBtn: {
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginTop: 4,
    shadowColor: "#6A5A00",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  signupText: { fontFamily: fonts.sansBold, fontSize: 17, color: A.ink, letterSpacing: 0.2 },
});
