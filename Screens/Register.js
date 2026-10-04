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
import { useState, useEffect, useRef, useMemo } from "react";
import { useSignUp, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { authAPI } from "../api";
import { captureError } from "../utils/crashReporter";
import { useTheme, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import { TERMS_URL as TERMS_OF_SERVICE_URL, PRIVACY_URL as PRIVACY_POLICY_URL } from "../utils/legalLinks";
import AuthScaffold, { useAuthStyles, FieldError, FormError } from "../components/AuthScaffold";
import {
  nameError, emailError, dobError, confirmPasswordError, clerkErrorToField, DISPOSABLE_EMAIL_ERROR,
  cleanName, cleanEmail, NAME_MAX, EMAIL_MAX,
  GOOGLE_BUSY, googleWindowBusy, googleWindowClosed, googleErrorMessage,
} from "../utils/authValidation";
import Icon from "../components/Icon";

// Same full-screen background as sign-in; it carries its own cyan→yellow wash.
const REGISTER_BG = require("../assets/bg.png");

WebBrowser.maybeCompleteAuthSession();

// ── Password strength helpers ──────────────────────────────────────
const PASSWORD_RULES = [
  { id: "length",  label: "At least 8 characters",          test: (p) => p.length >= 8 },
  { id: "upper",   label: "One uppercase letter",            test: (p) => /[A-Z]/.test(p) },
  { id: "number",  label: "One number",                      test: (p) => /\d/.test(p) },
  { id: "special", label: "One special character (!@#$…)",   test: (p) => /[^A-Za-z0-9]/.test(p) },
];

// Theme tokens, so the meter follows light/dark like the rest of the app.
// Measured on the sign-up panel over bg.png: every one stays >= 4.5:1 in both
// themes (lowest: success, 4.86:1 in light mode).
const STRENGTH = [
  { label: "Weak",   token: "danger" },
  { label: "Fair",   token: "warning" },
  { label: "Good",   token: "accentDark" },
  { label: "Strong", token: "success" },
];

function getStrength(password) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  if (passed <= 1)  return { level: 0, ...STRENGTH[0] };
  if (passed === 2) return { level: 1, ...STRENGTH[1] };
  if (passed === 3) return { level: 2, ...STRENGTH[2] };
  return              { level: 3, ...STRENGTH[3] };
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
  const strengthColor = colors[strength.token];
  return (
    <View style={styles.strengthPanel} accessibilityLiveRegion="polite">
      <View style={styles.strengthTrack}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.strengthSeg,
              { backgroundColor: i <= strength.level ? strengthColor : colors.divider },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strength.label}</Text>
      <View style={styles.criteriaList}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <View key={rule.id} style={styles.criteriaRow}>
              <Icon
                name={ok ? "check-circle" : "circle"}
                size={13}
                weight={ok ? "fill" : "regular"}
                color={ok ? colors.success : colors.textMuted}
              />
              <Text style={[styles.criteriaText, { color: ok ? colors.success : colors.textMuted }]}>
                {rule.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Terms notice ──────────────────────────────────────────────────
// Sits right under each sign-up button: pressing the button is the
// agreement, as on most sign-up screens. This replaced a checkbox at the
// bottom of the form that the Google button at the top silently waited on.
function TermsNotice({ action }) {
  const { colors } = useTheme();
  const link = [styles.noticeLink, { color: colors.brand }];
  return (
    <Text style={[styles.notice, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      By {action}, you agree to the{" "}
      <Text style={link} onPress={() => openLink(TERMS_OF_SERVICE_URL)} accessibilityRole="link">
        Terms and Conditions
      </Text>
      {" "}and{" "}
      <Text style={link} onPress={() => openLink(PRIVACY_POLICY_URL)} accessibilityRole="link">
        Privacy Policy
      </Text>
      .
    </Text>
  );
}

// ── Validation ────────────────────────────────────────────────────
// Rules and wording are shared with the other auth screens
// (utils/authValidation). The password additionally has to reach "Good"
// on the strength meter below, i.e. meet 3 of the 4 rules.
function validateRegister({ name, email, password, confirm, dob }) {
  const e = {};
  const n = nameError(name);   if (n) e.name = n;
  const m = emailError(email); if (m) e.email = m;
  if (!password) e.password = "Enter a password.";
  else if (getStrength(password).level < 2) e.password = "Too weak. Meet at least 3 of the rules below.";
  const c = confirmPasswordError(password, confirm); if (c) e.confirm = c;
  const d = dobError(dob);     if (d) e.dob = d;
  return e;
}

const FIELD_ORDER = ["name", "email", "password", "confirm", "dob"];

// ── Main Component ────────────────────────────────────────────────
export default function Register({ navigation }) {
  const a = useAuthStyles();
  const { colors } = useTheme();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { startOAuthFlow }              = useOAuth({ strategy: "oauth_google" });

  const [name, setName]                   = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirm, setConfirm]             = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [dob, setDob]               = useState("");
  const [isLoading, setIsLoading]         = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // A field's error shows once the user has left it (or pressed Sign up), and
  // from then on it's recomputed on every keystroke — so it disappears the
  // moment the value is fixed, instead of waiting for the next blur.
  const [touched, setTouched]           = useState({});
  // Errors the server gave back for a field (e.g. "email already exists").
  // Cleared as soon as that field is edited.
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError]       = useState("");

  const inputRefs = {
    name: useRef(null), email: useRef(null), password: useRef(null), confirm: useRef(null), dob: useRef(null),
  };

  const clientErrors = useMemo(
    () => validateRegister({ name, email, password, confirm, dob }),
    [name, email, password, confirm, dob]
  );
  const errorFor = (field) => serverErrors[field] || (touched[field] ? clientErrors[field] : null);

  const touch = (field) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  // Every field's onChangeText goes through here.
  const edit = (field, setter) => (value) => {
    setter(value);
    if (serverErrors[field]) setServerErrors((prev) => ({ ...prev, [field]: null }));
    if (formError) setFormError("");
  };

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS !== "android") WebBrowser.coolDownAsync();
    };
  }, []);

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
    edit("dob", setDob)(formatted);
  };

  // Puts a Clerk error under the field it's about, or in the form-level box.
  const showServerError = (err) => {
    const { field, message } = clerkErrorToField(err);
    if (field && FIELD_ORDER.includes(field)) {
      setServerErrors((prev) => ({ ...prev, [field]: message }));
      inputRefs[field].current?.focus();
    } else {
      setFormError(message);
    }
  };

  // ── Google signup ──
  const handleGoogleSignUp = async () => {
    if (isGoogleLoading || !isLoaded) return;
    setFormError("");
    setIsGoogleLoading(true);
    try {
      const { createdSessionId, authSessionResult } = await startOAuthFlow();
      if (googleWindowBusy(authSessionResult)) {
        setFormError(GOOGLE_BUSY);
        return;
      }
      // Back button, the window's X, or a swipe away. startOAuthFlow returns
      // an empty session for that rather than throwing, which used to surface
      // as "Couldn't sign up with Google". Only checked when there IS a window
      // result — without one, Clerk wasn't ready and it's a real failure.
      if (authSessionResult && googleWindowClosed(authSessionResult)) {
        showToast("Google sign-up cancelled. No account was created.", { type: "info" });
        return;
      }
      if (!createdSessionId) throw new Error("No session returned from Google OAuth");
      await setActive({ session: createdSessionId });
      const saveUserResult = await authAPI.register({ clerkSessionId: createdSessionId, isGoogle: true });
      if (!saveUserResult.success) {
        setFormError(saveUserResult.message || "Couldn't finish creating your account. Please try again.");
        return;
      }
      showToast("Account created with Google!", { type: "success" });
      navigation.navigate("Home");
    } catch (err) {
      // Closing the window doesn't land here (see above); anything that does
      // is a real failure.
      if (__DEV__) console.error("Google Sign Up Error:", err);
      captureError(err, { where: "Register.handleGoogleSignUp" });
      setFormError(googleErrorMessage(err, "sign up"));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // ── Email signup ──
  const handleRegister = async () => {
    setFormError("");
    setTouched({ name: true, email: true, password: true, confirm: true, dob: true });

    const firstBad = FIELD_ORDER.find((f) => clientErrors[f] || serverErrors[f]);
    if (firstBad) {
      // Straight to the first thing that needs fixing.
      inputRefs[firstBad].current?.focus();
      return;
    }
    if (!isLoaded) return setFormError("Still getting ready. Try again in a moment.");

    setIsLoading(true);
    try {
      // Temp-mail inboxes vanish within the hour, so they can't hold an
      // account; turned away here, before Clerk sends them a code.
      if (await authAPI.isDisposableEmail(email.trim())) {
        setServerErrors((prev) => ({ ...prev, email: DISPOSABLE_EMAIL_ERROR }));
        inputRefs.email.current?.focus();
        return;
      }

      const [firstName, ...lastNameParts] = name.trim().split(/\s+/);
      const lastName = lastNameParts.join(" ") || "";
      const signUpResult = await signUp.create({ emailAddress: email.trim(), password, firstName, lastName });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      navigation.navigate("EmailVerification", {
        email: email.trim(), firstName, lastName, fromLogin: false, signUpId: signUpResult.id,
      });
    } catch (err) {
      console.error("Email Registration Error:", err);
      showServerError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading;
  const disabled   = anyLoading || !isLoaded;

  const field = (key) => [
    a.field,
    !!errorFor(key) && a.fieldInvalid,
  ];

  return (
    <AuthScaffold
      background={REGISTER_BG}
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
          <ActivityIndicator color={colors.textMuted} />
        ) : (
          <>
            <Image source={require("../assets/googlelogo.png")} style={a.googleLogo} />
            <Text style={a.googleText} maxFontSizeMultiplier={MAX_FONT_SCALE}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
      <TermsNotice action="continuing with Google" />

      {/* Divider */}
      <View style={a.dividerRow}>
        <View style={a.dividerLine} />
        <Text style={a.dividerText}>OR</Text>
        <View style={a.dividerLine} />
      </View>

      {/* Full name */}
      <View>
        <View style={a.fieldRow}>
          <TextInput
            ref={inputRefs.name}
            style={field("name")}
            placeholder="FULL NAME"
            placeholderTextColor={colors.placeholder}
            value={name}
            onChangeText={edit("name", (v) => setName(cleanName(v)))}
            onBlur={() => touch("name")}
            maxLength={NAME_MAX}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => inputRefs.email.current?.focus()}
            editable={!anyLoading}
            accessibilityLabel="Full name"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
        </View>
        <FieldError>{errorFor("name")}</FieldError>
      </View>

      {/* Email */}
      <View>
        <View style={a.fieldRow}>
          <TextInput
            ref={inputRefs.email}
            style={field("email")}
            placeholder="EMAIL"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={edit("email", (v) => setEmail(cleanEmail(v)))}
            onBlur={() => touch("email")}
            maxLength={EMAIL_MAX}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => inputRefs.password.current?.focus()}
            editable={!anyLoading}
            accessibilityLabel="Email address"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
        </View>
        <FieldError>{errorFor("email")}</FieldError>
      </View>

      {/* Password */}
      <View>
        <View style={a.fieldRow}>
          <TextInput
            ref={inputRefs.password}
            style={[...field("password"), { paddingRight: 60 }]}
            placeholder="PASSWORD"
            placeholderTextColor={colors.placeholder}
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={edit("password", setPassword)}
            onBlur={() => touch("password")}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => inputRefs.confirm.current?.focus()}
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
            <Icon name={passwordVisible ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <FieldError>{errorFor("password")}</FieldError>
        <PasswordStrengthPanel password={password} />
      </View>

      {/* Confirm password — catches a typo before it becomes the password. */}
      <View>
        <View style={a.fieldRow}>
          <TextInput
            ref={inputRefs.confirm}
            style={[...field("confirm"), { paddingRight: 60 }]}
            placeholder="CONFIRM PASSWORD"
            placeholderTextColor={colors.placeholder}
            secureTextEntry={!confirmVisible}
            value={confirm}
            onChangeText={edit("confirm", setConfirm)}
            onBlur={() => touch("confirm")}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => inputRefs.dob.current?.focus()}
            editable={!anyLoading}
            accessibilityLabel="Confirm password"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <TouchableOpacity
            onPress={() => setConfirmVisible((v) => !v)}
            style={a.eyeBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={confirmVisible ? "Hide password" : "Show password"}
          >
            <Icon name={confirmVisible ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <FieldError>{errorFor("confirm")}</FieldError>
      </View>

      {/* Date of birth */}
      <View>
        <Text style={a.label}>DATE OF BIRTH</Text>
        <View style={a.fieldRow}>
          <TextInput
            ref={inputRefs.dob}
            style={field("dob")}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={colors.placeholder}
            value={dob}
            onChangeText={handleDobChange}
            onBlur={() => touch("dob")}
            keyboardType="number-pad"
            maxLength={10}
            editable={!anyLoading}
            accessibilityLabel="Date of birth, month slash day slash year"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
        </View>
        <FieldError>{errorFor("dob")}</FieldError>
      </View>

      <FormError>{formError}</FormError>

      {/* The same yellow primary button as every other screen. */}
      <TouchableOpacity
        style={[a.cta, styles.signupSpace, disabled && styles.disabled]}
        onPress={handleRegister}
        disabled={disabled}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Sign up"
      >
        {isLoading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={a.ctaText}>Sign up</Text>}
      </TouchableOpacity>
      <TermsNotice action="signing up" />

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

  strengthPanel: { marginTop: 12, paddingHorizontal: 8, gap: 8 },
  strengthTrack: { flexDirection: "row", gap: 5 },
  strengthSeg:   { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 0.3 },
  criteriaList:  { gap: 4 },
  criteriaRow:   { flexDirection: "row", alignItems: "center", gap: 7 },
  criteriaText:  { fontFamily: fonts.sansMedium, fontSize: 12.5 },

  // Tucked closer to its button than the body's 16px gap, so it reads as
  // that button's fine print.
  notice:     { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: -6, paddingHorizontal: 8 },
  noticeLink: { fontFamily: fonts.sansSemi, textDecorationLine: "underline" },

  signupSpace: { marginTop: 4 },
});
