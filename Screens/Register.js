import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Text,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Linking,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import CheckBox from "expo-checkbox";
import { useSignUp, useOAuth, useUser } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { authAPI } from "../api";

WebBrowser.maybeCompleteAuthSession();

// ── TODO: replace with your real Termly-hosted URLs ──────────────────
const TERMS_OF_SERVICE_URL = "https://app.termly.io/policy-viewer/policy.html?policyUUID=REPLACE_WITH_YOUR_TOS_UUID";
const PRIVACY_POLICY_URL   = "https://app.termly.io/policy-viewer/policy.html?policyUUID=REPLACE_WITH_YOUR_PRIVACY_UUID";

// ── Password strength helpers ──────────────────────────────────────
const PASSWORD_RULES = [
  { id: "length",  label: "At least 8 characters",          test: (p) => p.length >= 8 },
  { id: "upper",   label: "One uppercase letter",            test: (p) => /[A-Z]/.test(p) },
  { id: "number",  label: "One number",                      test: (p) => /\d/.test(p) },
  { id: "special", label: "One special character (!@#$…)",   test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(password) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  if (passed <= 1) return { level: 0, label: "Weak",   color: "#e05252" };
  if (passed === 2) return { level: 1, label: "Fair",   color: "#e09b52" };
  if (passed === 3) return { level: 2, label: "Good",   color: "#d4b84a" };
  return              { level: 3, label: "Strong", color: "#4caf78" };
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
      Alert.alert("Unable to Open Link", "Please check your internet connection and try again.");
    }
  } catch (err) {
    console.error("openLink error:", err);
    Alert.alert("Unable to Open Link", "Something went wrong opening that page.");
  }
}

// ── Password Strength Widget ───────────────────────────────────────
function PasswordStrengthPanel({ password }) {
  if (!password) return null;
  const strength = getStrength(password);
  return (
    <View style={styles.strengthPanel}>
      {/* Bar */}
      <View style={styles.strengthBarTrack}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.strengthBarSegment,
              { backgroundColor: i <= strength.level ? strength.color : "#e8d0ce" },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
      {/* Criteria checklist */}
      <View style={styles.criteriaList}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <View key={rule.id} style={styles.criteriaRow}>
              <Feather
                name={ok ? "check-circle" : "circle"}
                size={13}
                color={ok ? "#4caf78" : "#b0908c"}
              />
              <Text style={[styles.criteriaText, ok && styles.criteriaTextOk]}>
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
      Alert.alert("Terms Required", "Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setIsGoogleLoading(true);
    try {
      const { createdSessionId } = await startOAuthFlow();
      if (!createdSessionId) throw new Error("No session returned from Google OAuth");
      await setActive({ session: createdSessionId });
      const saveUserResult = await authAPI.register({ clerkSessionId: createdSessionId, isGoogle: true });
      if (!saveUserResult.success)
        return Alert.alert("Sign Up Failed", saveUserResult.message || "Could not save user");
      Alert.alert("Success", "Google account registered successfully!");
      navigation.navigate("Home");
    } catch (err) {
      console.error("Google Sign Up Error:", err);
      Alert.alert("Sign Up Failed", err.message || "Unable to sign up with Google.");
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
      return Alert.alert("Terms Required", "Please agree to the Terms of Service and Privacy Policy to continue.");
    if (!isLoaded)
      return Alert.alert("Error", "Authentication system is loading. Please wait.");

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
        Alert.alert("Registration Failed", errorMessage || "Unable to register. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Fill in the form to continue</Text>
          </View>

          {/* Google signup */}
          <TouchableOpacity
            style={[styles.googleButton, anyLoading && styles.disabled]}
            onPress={handleGoogleSignUp}
            disabled={anyLoading || !isLoaded}
            activeOpacity={0.85}
            accessibilityLabel="Sign up with Google"
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#444" />
            ) : (
              <>
                <Image source={require("../assets/googlelogo.png")} style={styles.googleLogo} />
                <Text style={styles.googleButtonText}>Sign up with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Input fields ── */}
          <View style={styles.inputContainer}>

            {/* Full Name */}
            <View>
              <TextInput
                style={[styles.input, fieldError("name") && styles.inputError]}
                placeholder="Full Name"
                placeholderTextColor="#b0908c"
                value={name}
                onChangeText={setName}
                onBlur={() => handleBlur("name")}
                editable={!anyLoading}
                accessibilityLabel="Full name"
              />
              {fieldError("name") ? (
                <Text style={styles.errorText}>
                  <Feather name="alert-circle" size={12} /> {fieldError("name")}
                </Text>
              ) : null}
            </View>

            {/* Email */}
            <View>
              <TextInput
                style={[styles.input, fieldError("email") && styles.inputError]}
                placeholder="Email"
                placeholderTextColor="#b0908c"
                value={email}
                onChangeText={setEmail}
                onBlur={() => handleBlur("email")}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!anyLoading}
                accessibilityLabel="Email address"
              />
              {fieldError("email") ? (
                <Text style={styles.errorText}>
                  <Feather name="alert-circle" size={12} /> {fieldError("email")}
                </Text>
              ) : null}
            </View>

            {/* Password with eye icon */}
            <View>
              <View style={styles.passwordInputRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput, fieldError("password") && styles.inputError]}
                  placeholder="Password"
                  placeholderTextColor="#b0908c"
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                >
                  <Feather name={passwordVisible ? "eye-off" : "eye"} size={18} color="#6b4b45" />
                </TouchableOpacity>
              </View>
              {fieldError("password") ? (
                <Text style={styles.errorText}>
                  <Feather name="alert-circle" size={12} /> {fieldError("password")}
                </Text>
              ) : null}
              {/* Password strength panel appears as user types */}
              <PasswordStrengthPanel password={password} />
            </View>

            {/* Date of Birth */}
            <View>
              <Text style={styles.fieldLabel}>Date of Birth</Text>
              <TextInput
                style={[styles.input, fieldError("dob") && styles.inputError]}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="#b0908c"
                value={dob}
                onChangeText={handleDobChange}
                onBlur={handleDobBlur}
                keyboardType="number-pad"
                maxLength={10}
                editable={!anyLoading}
                accessibilityLabel="Date of birth"
              />
              {fieldError("dob") ? (
                <Text style={styles.errorText}>
                  <Feather name="alert-circle" size={12} /> {fieldError("dob")}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <CheckBox
              value={agreeToTerms}
              onValueChange={setAgreeToTerms}
              color={agreeToTerms ? "#4caf78" : undefined}
            />
            <Text style={styles.termsText}>
              I hereby confirm that I have read and agree with the{" "}
              <Text style={styles.termsLink} onPress={() => openLink(TERMS_OF_SERVICE_URL)}>
                Terms of Service
              </Text>{" "}
              and{" "}
              <Text style={styles.termsLink} onPress={() => openLink(PRIVACY_POLICY_URL)}>
                Privacy Policy
              </Text>
              .
            </Text>
          </View>

          {/* Register button */}
          <TouchableOpacity
            style={[styles.button, anyLoading && styles.disabled]}
            onPress={handleRegister}
            disabled={anyLoading || !isLoaded}
            activeOpacity={0.85}
            accessibilityLabel="Create account"
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Create Account</Text>
            }
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>

          </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
  },
  scrollContent: {
    padding: 20,
    justifyContent: "center",
    flexGrow: 1,
  },

  // ── Card ──
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#4a2e2c",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },

  // ── Title ──
  titleContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#4a2e2c",
  },
  subtitle: {
    fontSize: 15,
    color: "#7a5a58",
    marginTop: 6,
  },

  // ── Google button ──
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf5f4",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#d9b8b5",
  },
  googleLogo: {
    width: 22,
    height: 22,
    resizeMode: "contain",
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4a2e2c",
  },

  // ── Divider ──
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e8d0ce",
  },
  dividerText: {
    marginHorizontal: 12,
    color: "#7a5a58",
    fontWeight: "600",
    fontSize: 13,
  },

  // ── Inputs ──
  inputContainer: {
    gap: 12,
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#faf5f4",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 15,
    color: "#4a2e2c",
    borderWidth: 1.5,
    borderColor: "#e8d0ce",
  },
  inputError: {
    borderColor: "#e05252",
    backgroundColor: "#fff5f5",
  },
  errorText: {
    fontSize: 12,
    color: "#e05252",
    marginTop: 4,
    marginLeft: 4,
    fontWeight: "500",
  },
  passwordInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    paddingRight: 48,
  },
  eyeIconBtn: {
    position: "absolute",
    right: 14,
    padding: 4,
  },

  // ── Password strength ──
  strengthPanel: {
    marginTop: 10,
  },
  strengthBarTrack: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  strengthBarSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "right",
  },
  criteriaList: {
    gap: 4,
  },
  criteriaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  criteriaText: {
    fontSize: 12,
    color: "#b0908c",
  },
  criteriaTextOk: {
    color: "#4caf78",
  },

  // ── Field label ──
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b4b45",
    marginBottom: 6,
    marginLeft: 2,
  },

  // ── Terms ──
  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 10,
  },
  termsText: {
    fontSize: 13,
    color: "#7a5a58",
    flex: 1,
    lineHeight: 18,
  },
  termsLink: {
    color: "#6b4b45",
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  // ── Primary button ──
  button: {
    backgroundColor: "#6b4b45",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.55,
  },

  // ── Link row ──
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  linkText: {
    fontSize: 14,
    color: "#7a5a58",
  },
  link: {
    fontSize: 14,
    color: "#6b4b45",
    fontWeight: "700",
  },
});