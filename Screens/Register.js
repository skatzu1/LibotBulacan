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
import { useSignUp, useSignIn, useClerk } from "@clerk/clerk-expo";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { authAPI } from "../api";
import { captureError } from "../utils/crashReporter";
import { useTheme, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import { TERMS_URL as TERMS_OF_SERVICE_URL, PRIVACY_URL as PRIVACY_POLICY_URL } from "../utils/legalLinks";
import AuthScaffold, { useAuthStyles, FieldError, FormError } from "../components/AuthScaffold";
import {
  nameError, emailError, dobError, strongPasswordError, confirmPasswordError,
  clerkErrorToField, DISPOSABLE_EMAIL_ERROR,
  cleanName, cleanEmail, NAME_MAX, EMAIL_MAX,
  GOOGLE_BUSY, googleWindowBusy, googleWindowClosed, googleErrorMessage,
} from "../utils/authValidation";
import Icon from "../components/Icon";
import MunicipalityPicker from "../components/MunicipalityPicker";
import PasswordStrength from "../components/PasswordStrength";
import DobField from "../components/DobField";
import { municipalityError } from "../utils/municipalities";

// Same full-screen background as sign-in; it carries its own cyan→yellow wash.
const REGISTER_BG = require("../assets/bg.png");

WebBrowser.maybeCompleteAuthSession();

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
// (utils/authValidation). The password has to reach "Good" on the strength
// meter, i.e. meet 3 of the 4 rules.
function validateRegister({ firstName, lastName, municipality, email, password, confirm, dob }) {
  const e = {};
  const f = nameError(firstName, "your first name"); if (f) e.firstName = f;
  const l = nameError(lastName, "your last name");   if (l) e.lastName = l;
  const h = municipalityError(municipality);        if (h) e.municipality = h;
  const m = emailError(email);                      if (m) e.email = m;
  const p = strongPasswordError(password);          if (p) e.password = p;
  const c = confirmPasswordError(password, confirm); if (c) e.confirm = c;
  const d = dobError(dob);                          if (d) e.dob = d;
  return e;
}

// The QA's order (2026-10-16): first and last name, municipality, email; then
// the password and date of birth.
const FIELD_ORDER = ["firstName", "lastName", "municipality", "email", "password", "confirm", "dob"];
// Google fills in the name and email, but not where the traveler lives or
// how old they are, so those two are checked before it opens.
const GOOGLE_FIELDS = ["municipality", "dob"];

// ── Main Component ────────────────────────────────────────────────
export default function Register({ navigation }) {
  const a = useAuthStyles();
  const { colors } = useTheme();
  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: signInLoaded, signIn }            = useSignIn();
  const clerk = useClerk();
  const isLoaded = signUpLoaded && signInLoaded;

  const [firstName, setFirstName]         = useState("");
  const [lastName, setLastName]           = useState("");
  const [municipality, setMunicipality]   = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirm, setConfirm]             = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [dob, setDob]                     = useState("");
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
    firstName: useRef(null), lastName: useRef(null),
    municipality: useRef(null), email: useRef(null), password: useRef(null), confirm: useRef(null), dob: useRef(null),
  };

  const clientErrors = useMemo(
    () => validateRegister({ firstName, lastName, municipality, email, password, confirm, dob }),
    [firstName, lastName, municipality, email, password, confirm, dob]
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

  // Puts a Clerk error under the field it's about, or in the form-level box.
  // Clerk calls both name fields "name"; first_name/last_name say which.
  const showServerError = (err) => {
    const { field: mapped, message } = clerkErrorToField(err);
    const param = err?.errors?.[0]?.meta?.paramName;
    const field = mapped === "name" ? (param === "last_name" ? "lastName" : "firstName") : mapped;
    if (field && FIELD_ORDER.includes(field)) {
      setServerErrors((prev) => ({ ...prev, [field]: message }));
      inputRefs[field].current?.focus();
    } else {
      setFormError(message);
    }
  };

  // What the server copies onto the account (Clerk unsafe metadata → the
  // backend's utils/signUpDetails.js). Not the date of birth: it is only for
  // the age check here on the phone, and the Privacy Policy says it is not
  // sent to us or stored.
  const signUpDetails = () => ({ municipality });

  // The Google account picked here already has a Libot account, and Google
  // has just signed it in (`sessionId`). Signing up again would only make a
  // second account or fail, so ask to log in instead. Log in uses that sign-in
  // (no second Google window); Cancel throws it away, so nobody is left
  // signed in by a screen they backed out of. Back and taps outside don't
  // close it — one of the two has to be chosen.
  const promptToLogIn = (sessionId) => {
    showAlert(
      "You already have an account",
      "This Google account is already registered with Libot Bulacan. Log in with it instead.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => { clerk.signOut({ sessionId }).catch(() => {}); },
        },
        {
          text: "Log in",
          onPress: async () => {
            try {
              await setActive({ session: sessionId });
            } catch (err) {
              captureError(err, { where: "Register.promptToLogIn" });
              setFormError(googleErrorMessage(err, "sign in"));
            }
          },
        },
      ],
      { tone: "info", icon: "user", cancelable: false },
    );
  };

  // ── Google signup ──
  // Clerk's OAuth steps run by hand rather than through useOAuth's
  // startOAuthFlow(): that helper always starts as a sign-in, so a Google
  // account that already had a Libot account was quietly signed in here and
  // told "Account created with Google!". Now that case asks to log in
  // (promptToLogIn), and only a Google account with no Libot account goes on
  // to sign up — the same steps the helper took (Login.js runs them by hand
  // too, for the opposite case).
  const handleGoogleSignUp = async () => {
    if (isGoogleLoading || !isLoaded) return;
    setFormError("");
    const missing = GOOGLE_FIELDS.find((f) => clientErrors[f]);
    if (missing) {
      setTouched((prev) => ({ ...prev, municipality: true, dob: true }));
      showToast("Choose your municipality and enter your date of birth first.", { type: "info" });
      inputRefs[missing].current?.focus();
      return;
    }
    setIsGoogleLoading(true);
    try {
      // Same callback path useOAuth uses, so the redirect Clerk allows is unchanged.
      const redirectUrl = AuthSession.makeRedirectUri({ path: "oauth-native-callback" });
      const attempt = await signIn.create({ strategy: "oauth_google", redirectUrl });
      const authUrl = attempt.firstFactorVerification.externalVerificationRedirectURL;
      if (!authUrl) throw new Error("No Google sign-up URL returned");

      const result = await WebBrowser.openAuthSessionAsync(authUrl.toString(), redirectUrl);
      if (googleWindowBusy(result)) {
        setFormError(GOOGLE_BUSY);
        return;
      }
      // Back button, the window's X, or a swipe away — the user's choice, so a
      // note rather than an error.
      if (googleWindowClosed(result)) {
        showToast("Google sign-up cancelled. No account was created.", { type: "info" });
        return;
      }

      const nonce = new URL(result.url).searchParams.get("rotating_token_nonce") || "";
      const done = await attempt.reload({ rotatingTokenNonce: nonce });

      // Google signed in an account that already exists.
      if (done.status === "complete") {
        promptToLogIn(done.createdSessionId);
        return;
      }
      if (done.firstFactorVerification?.status !== "transferable") {
        throw new Error(`Google sign-up ended as "${done.status}"`);
      }

      // A new account. unsafeMetadata rides on it; the backend copies it
      // (webhook and /register).
      const created = await signUp.create({ transfer: true, unsafeMetadata: signUpDetails() });
      const createdSessionId = created?.createdSessionId;
      if (!createdSessionId) throw new Error("No session returned from Google sign-up");
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
    setTouched(Object.fromEntries(FIELD_ORDER.map((f) => [f, true])));

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

      const first = firstName.trim();
      const last = lastName.trim();
      const signUpResult = await signUp.create({
        emailAddress: email.trim(), password, firstName: first, lastName: last,
        unsafeMetadata: signUpDetails(),
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      navigation.navigate("EmailVerification", {
        email: email.trim(), firstName: first, lastName: last, fromLogin: false, signUpId: signUpResult.id,
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

  // A plain one-line text field: first and last name, email.
  const textField = (key, { value, onChange, placeholder, label, next, ...props }) => (
    <View>
      <View style={a.fieldRow}>
        <TextInput
          ref={inputRefs[key]}
          style={field(key)}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          value={value}
          onChangeText={edit(key, onChange)}
          onBlur={() => touch(key)}
          returnKeyType="next"
          onSubmitEditing={next}
          editable={!anyLoading}
          accessibilityLabel={label}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          {...props}
        />
      </View>
      <FieldError>{errorFor(key)}</FieldError>
    </View>
  );

  const nameField = (key, value, setter, placeholder, label, next, autoComplete) =>
    textField(key, {
      value, onChange: (v) => setter(cleanName(v)), placeholder, label, next,
      maxLength: NAME_MAX, autoCapitalize: "words", autoComplete,
    });

  return (
    <AuthScaffold
      background={REGISTER_BG}
      showLogo={false}
      onBack={() => navigation.navigate("Login")}
      title="Create an Account"
      subtitle="Fill in the form to continue"
    >
      {nameField("firstName", firstName, setFirstName, "FIRST NAME", "First name",
        () => inputRefs.lastName.current?.focus(), "name-given")}
      {nameField("lastName", lastName, setLastName, "LAST NAME", "Last name",
        () => inputRefs.municipality.current?.focus(), "name-family")}

      {/* Home municipality: asked here and only here (no longer on a welcome
          screen), so every traveler answers it, Google sign-ups included. */}
      <View>
        <MunicipalityPicker
          ref={inputRefs.municipality}
          value={municipality}
          onChange={edit("municipality", setMunicipality)}
          onClose={() => touch("municipality")}
          invalid={!!errorFor("municipality")}
          disabled={anyLoading}
        />
        <FieldError>{errorFor("municipality")}</FieldError>
      </View>

      {textField("email", {
        value: email, onChange: (v) => setEmail(cleanEmail(v)), placeholder: "EMAIL", label: "Email address",
        next: () => inputRefs.password.current?.focus(),
        maxLength: EMAIL_MAX, keyboardType: "email-address", autoCapitalize: "none", autoCorrect: false,
        autoComplete: "email", textContentType: "emailAddress",
      })}

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
        <PasswordStrength password={password} />
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

      {/* Date of birth: typed, or picked from the calendar. 13 and older. */}
      <View>
        <Text style={a.label}>DATE OF BIRTH</Text>
        <DobField
          ref={inputRefs.dob}
          value={dob}
          onChange={edit("dob", setDob)}
          onBlur={() => touch("dob")}
          invalid={!!errorFor("dob")}
          editable={!anyLoading}
        />
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

      {/* Divider */}
      <View style={a.dividerRow}>
        <View style={a.dividerLine} />
        <Text style={a.dividerText}>OR</Text>
        <View style={a.dividerLine} />
      </View>

      {/* Google: uses the municipality and date of birth from the form above. */}
      <TouchableOpacity
        style={[a.googleBtn, disabled && styles.disabled]}
        onPress={handleGoogleSignUp}
        disabled={disabled}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityHint="Uses the municipality and date of birth you entered above"
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
      <Text style={[styles.googleNote, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Fill in your municipality and date of birth above first. Google gives us your name and email.
      </Text>
      <TermsNotice action="continuing with Google" />

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

  // Tucked closer to its button than the body's 16px gap, so it reads as
  // that button's fine print.
  notice:     { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: -6, paddingHorizontal: 8 },
  noticeLink: { fontFamily: fonts.sansSemi, textDecorationLine: "underline" },
  googleNote: { fontFamily: fonts.sansMedium, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: -6, paddingHorizontal: 8 },

  signupSpace: { marginTop: 4 },
});
