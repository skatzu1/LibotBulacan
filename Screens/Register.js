import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Text,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Linking,
  StatusBar,
} from "react-native";
import { showAlert, showToast } from "../components/AppAlert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import CheckBox from "expo-checkbox";
import { useSignUp, useOAuth, useUser } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { authAPI } from "../api";
import { useTheme, spacing, radius, typography, shadow } from "../context/ThemeContext";
import { TERMS_URL as TERMS_OF_SERVICE_URL, PRIVACY_URL as PRIVACY_POLICY_URL } from "../utils/legalLinks";

WebBrowser.maybeCompleteAuthSession();

// ── Password strength helpers ──────────────────────────────────────
const PASSWORD_RULES = [
  { id: "length",  label: "At least 8 characters",          test: (p) => p.length >= 8 },
  { id: "upper",   label: "One uppercase letter",            test: (p) => /[A-Z]/.test(p) },
  { id: "number",  label: "One number",                      test: (p) => /\d/.test(p) },
  { id: "special", label: "One special character (!@#$…)",   test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// Returns { level, label, colorKey } — colorKey resolves against theme colors.
function getStrength(password) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  if (passed <= 1)  return { level: 0, label: "Weak",   colorKey: "danger" };
  if (passed === 2) return { level: 1, label: "Fair",   colorKey: "warning" };
  if (passed === 3) return { level: 2, label: "Good",   colorKey: "star" };
  return               { level: 3, label: "Strong", colorKey: "success" };
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
  const { colors } = useTheme();
  if (!password) return null;
  const strength = getStrength(password);
  const strengthColor = colors[strength.colorKey];
  return (
    <View style={styles.strengthPanel}>
      <View style={styles.strengthBarTrack}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.strengthBarSegment,
              { backgroundColor: i <= strength.level ? strengthColor : colors.inputBorder },
            ]}
          />
        ))}
      </View>
      <Text style={[typography.caption, styles.strengthLabel, { color: strengthColor }]}>
        {strength.label}
      </Text>
      <View style={styles.criteriaList}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <View key={rule.id} style={styles.criteriaRow}>
              <Feather
                name={ok ? "check-circle" : "circle"}
                size={13}
                color={ok ? colors.success : colors.textMuted}
              />
              <Text style={[typography.caption, { color: ok ? colors.success : colors.textMuted }]}>
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
  const { colors, isDark } = useTheme();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { startOAuthFlow }              = useOAuth({ strategy: "oauth_google" });
  const { user }                        = useUser();

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

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary },
  ];
  const errStyle = { borderColor: colors.danger, backgroundColor: colors.dangerBg };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }, shadow.md]}>

              <View style={styles.titleContainer}>
                <Text style={[typography.h1, { color: colors.textPrimary }]}>Create Account</Text>
                <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
                  Fill in the form to continue
                </Text>
              </View>

              {/* Google signup */}
              <TouchableOpacity
                style={[
                  styles.googleButton,
                  { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                  disabled && styles.disabled,
                ]}
                onPress={handleGoogleSignUp}
                disabled={disabled}
                activeOpacity={0.85}
                accessibilityLabel="Sign up with Google"
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color={colors.textSecondary} />
                ) : (
                  <>
                    <Image source={require("../assets/googlelogo.png")} style={styles.googleLogo} />
                    <Text style={[typography.bodyStrong, { color: colors.textPrimary }]}>
                      Sign up with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
                <Text style={[typography.label, styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
              </View>

              {/* ── Input fields ── */}
              <View style={styles.inputContainer}>

                {/* Full Name */}
                <View>
                  <TextInput
                    style={[inputStyle, fieldError("name") && errStyle]}
                    placeholder="Full Name"
                    placeholderTextColor={colors.placeholder}
                    value={name}
                    onChangeText={setName}
                    onBlur={() => handleBlur("name")}
                    editable={!anyLoading}
                    accessibilityLabel="Full name"
                  />
                  {fieldError("name") ? (
                    <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
                      {fieldError("name")}
                    </Text>
                  ) : null}
                </View>

                {/* Email */}
                <View>
                  <TextInput
                    style={[inputStyle, fieldError("email") && errStyle]}
                    placeholder="Email"
                    placeholderTextColor={colors.placeholder}
                    value={email}
                    onChangeText={setEmail}
                    onBlur={() => handleBlur("email")}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!anyLoading}
                    accessibilityLabel="Email address"
                  />
                  {fieldError("email") ? (
                    <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
                      {fieldError("email")}
                    </Text>
                  ) : null}
                </View>

                {/* Password with eye icon */}
                <View>
                  <View style={styles.passwordInputRow}>
                    <TextInput
                      style={[inputStyle, styles.passwordInput, fieldError("password") && errStyle]}
                      placeholder="Password"
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry={!passwordVisible}
                      value={password}
                      onChangeText={setPassword}
                      onBlur={() => handleBlur("password")}
                      editable={!anyLoading}
                      accessibilityLabel="Password"
                    />
                    <TouchableOpacity
                      onPress={() => setPasswordVisible((v) => !v)}
                      style={styles.eyeIconBtn}
                      hitSlop={8}
                      accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                    >
                      <Feather name={passwordVisible ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {fieldError("password") ? (
                    <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
                      {fieldError("password")}
                    </Text>
                  ) : null}
                  <PasswordStrengthPanel password={password} />
                </View>

                {/* Date of Birth */}
                <View>
                  <Text style={[typography.label, styles.fieldLabel, { color: colors.textSecondary }]}>
                    Date of Birth
                  </Text>
                  <TextInput
                    style={[inputStyle, fieldError("dob") && errStyle]}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={colors.placeholder}
                    value={dob}
                    onChangeText={handleDobChange}
                    onBlur={handleDobBlur}
                    keyboardType="number-pad"
                    maxLength={10}
                    editable={!anyLoading}
                    accessibilityLabel="Date of birth"
                  />
                  {fieldError("dob") ? (
                    <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
                      {fieldError("dob")}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Terms */}
              <View style={styles.termsContainer}>
                <CheckBox
                  value={agreeToTerms}
                  onValueChange={setAgreeToTerms}
                  color={agreeToTerms ? colors.success : undefined}
                />
                <Text style={[typography.body, styles.termsText, { color: colors.textSecondary }]}>
                  I hereby confirm that I have read and agree with the{" "}
                  <Text style={[styles.termsLink, { color: colors.brand }]} onPress={() => openLink(TERMS_OF_SERVICE_URL)}>
                    Terms of Service
                  </Text>{" "}
                  and{" "}
                  <Text style={[styles.termsLink, { color: colors.brand }]} onPress={() => openLink(PRIVACY_POLICY_URL)}>
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>

              {/* Register button */}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.accent }, disabled && styles.disabled]}
                onPress={handleRegister}
                disabled={disabled}
                activeOpacity={0.85}
                accessibilityLabel="Create account"
              >
                {isLoading
                  ? <ActivityIndicator color={colors.onAccent} />
                  : <Text style={[typography.title, { color: colors.onAccent }]}>Create Account</Text>
                }
              </TouchableOpacity>

              {/* Login link */}
              <View style={styles.linkRow}>
                <Text style={[typography.body, { color: colors.textSecondary }]}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                  <Text style={[typography.bodyStrong, { color: colors.textPrimary, fontWeight: "700" }]}>Sign In</Text>
                </TouchableOpacity>
              </View>

            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  scrollContent: {
    padding: spacing.xl,
    justifyContent: "center",
    flexGrow: 1,
  },

  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
  },

  titleContainer: { alignItems: "center", marginBottom: spacing.xl },
  subtitle: { marginTop: spacing.xs },

  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  googleLogo: { width: 22, height: 22, resizeMode: "contain" },

  dividerContainer: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: spacing.md },

  inputContainer: { gap: spacing.md, marginBottom: spacing.xl },
  input: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    fontSize: 15,
    borderWidth: 1.5,
  },
  errorText: { marginTop: spacing.xs, marginLeft: spacing.xs, fontWeight: "500" },
  passwordInputRow: { flexDirection: "row", alignItems: "center" },
  passwordInput: { flex: 1, paddingRight: 48 },
  eyeIconBtn: { position: "absolute", right: spacing.md, padding: spacing.xs },

  strengthPanel: { marginTop: spacing.sm },
  strengthBarTrack: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  strengthBarSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontWeight: "700", marginBottom: spacing.sm, textAlign: "right" },
  criteriaList: { gap: spacing.xs },
  criteriaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },

  fieldLabel: { marginBottom: spacing.xs, marginLeft: 2 },

  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  termsText: { flex: 1, lineHeight: 18 },
  termsLink: { fontWeight: "700", textDecorationLine: "underline" },

  button: {
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  disabled: { opacity: 0.55 },

  linkRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
});
