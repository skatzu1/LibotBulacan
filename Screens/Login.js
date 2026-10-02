import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Text,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
} from "react-native";
import { showToast } from "../components/AppAlert";
import { useState, useEffect, useRef } from "react";
import { useSignIn, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { captureError } from "../utils/crashReporter";
import { useTheme, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import AuthScaffold, { useAuthStyles, FieldError, FormError } from "../components/AuthScaffold";
import {
  emailError as checkEmail, requiredPasswordError, newPasswordError, confirmPasswordError,
  codeError as checkCode, clerkErrorToField, NETWORK_ERROR,
  cleanEmail, digitsOnly, EMAIL_MAX,
} from "../utils/authValidation";
import Icon from "../components/Icon";

// Full-screen background for sign-in and forgot-password. It already carries
// the app's cyan→yellow wash, so nothing is layered over it but the form.
const LOGIN_BG = require("../assets/bg.png");

WebBrowser.maybeCompleteAuthSession();

/* ── Lockout tracking ─────────────────────────────────────────────────────
   Mirrors the Clerk Dashboard lockout policy (5 attempts → 5 minute lock) so
   the user is told they're locked out on every attempt inside the window,
   even when Clerk answers with a plain password error (e.g. an email with no
   password account, which Clerk never locks). Tracked per email, persisted so
   an app restart doesn't reset it. Keep these in sync with the dashboard. */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const lockKey = (email) => `loginLock:${email.trim().toLowerCase()}`;

async function readLock(email) {
  try {
    const raw = await AsyncStorage.getItem(lockKey(email));
    return raw ? JSON.parse(raw) : { fails: 0, lockedUntil: 0 };
  } catch {
    return { fails: 0, lockedUntil: 0 };
  }
}
async function writeLock(email, state) {
  try { await AsyncStorage.setItem(lockKey(email), JSON.stringify(state)); } catch {}
}
async function clearLock(email) {
  try { await AsyncStorage.removeItem(lockKey(email)); } catch {}
}
function lockoutMessage(lockedUntil) {
  const mins = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
  return `Too many failed attempts. Your account is locked — try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}

/* ── Forgot Password ──────────────────────────────────────────────────────
   The mockup draws this as a full screen, not a dialog on top of Login — so it
   presents as a full-screen modal built from the same scaffold, with the back
   chevron returning to sign-in. The two-step Clerk flow (send code → verify
   code + set password) is unchanged. */
function ForgotPasswordModal({ visible, onClose, signIn }) {
  const a = useAuthStyles();
  const { colors } = useTheme();
  const [step, setStep]               = useState("email");
  const [email, setEmail]             = useState("");
  const [code, setCode]               = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  // Field errors: { email, code, password, confirm }, plus one form-level one.
  const [errors, setErrors]           = useState({});
  const [formError, setFormError]     = useState("");
  const codeRef    = useRef(null);
  const newPwRef   = useRef(null);
  const confirmRef = useRef(null);

  const reset = () => {
    setStep("email"); setEmail(""); setCode(""); setNewPassword("");
    setConfirmPassword(""); setShowNew(false); setShowConfirm(false);
    setLoading(false); setErrors({}); setFormError("");
  };
  const handleClose = () => { reset(); onClose(); };

  // Typing in a field clears that field's error (and the form-level one).
  const edit = (field, setter) => (value) => {
    setter(value);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    if (formError) setFormError("");
  };

  // Step 1 — send OTP
  const handleSendCode = async () => {
    const emailErr = checkEmail(email);
    if (emailErr) return setErrors({ email: emailErr });
    setErrors({});
    setLoading(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: email.trim() });
      setStep("otp");
    } catch (err) {
      // Deliberately vague about whether the email exists.
      setErrors({ email: err?.errors ? "Couldn't send a reset code. Check the email and try again." : NETWORK_ERROR });
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP + set new password
  const handleResetPassword = async () => {
    const next = {
      code:     checkCode(code),
      password: newPasswordError(newPassword),
      confirm:  confirmPasswordError(newPassword, confirmPassword),
    };
    setErrors(next);
    setFormError("");
    if (next.code)     return codeRef.current?.focus();
    if (next.password) return newPwRef.current?.focus();
    if (next.confirm)  return confirmRef.current?.focus();

    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
        password: newPassword,
      });
      if (result.status === "complete") {
        // A fresh password starts a fresh attempt count
        await clearLock(email);
        showToast("Password updated. Log in with your new password.", { type: "success" });
        handleClose();
      } else {
        setFormError("Couldn't finish resetting your password. Please try again.");
      }
    } catch (err) {
      const { field, message } = clerkErrorToField(err);
      if (field === "code" || field === "password") {
        setErrors((prev) => ({ ...prev, [field]: message }));
      } else {
        setFormError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <AuthScaffold
        background={LOGIN_BG}
        onBack={step === "otp" ? () => setStep("email") : handleClose}
        title="Forgot Password?"
        subtitle={
          step === "email"
            ? "Enter the email linked to your account and we'll send you a reset code"
            : `We sent a 6-digit code to ${email}. Enter it below with your new password.`
        }
      >
        {step === "email" ? (
          <>
            <View>
              <TextInput
                style={[a.field, !!errors.email && a.fieldInvalid]}
                placeholder="EMAIL"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                autoCorrect={false}
                maxLength={EMAIL_MAX}
                value={email}
                onChangeText={edit("email", (v) => setEmail(cleanEmail(v)))}
                onSubmitEditing={handleSendCode}
                returnKeyType="send"
                editable={!loading}
                accessibilityLabel="Email address for password reset"
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              />
              <FieldError>{errors.email}</FieldError>
            </View>

            <TouchableOpacity
              style={[a.cta, loading && styles.disabled]}
              onPress={handleSendCode}
              disabled={loading}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Send reset code"
            >
              {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={a.ctaText}>Send Reset Code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View>
              <TextInput
                ref={codeRef}
                style={[a.field, { letterSpacing: 6, textAlign: "center" }, !!errors.code && a.fieldInvalid]}
                placeholder="000000"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={edit("code", (v) => setCode(digitsOnly(v)))}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                editable={!loading}
                accessibilityLabel="6-digit reset code"
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              />
              <FieldError>{errors.code}</FieldError>
            </View>

            <View>
              <View style={a.fieldRow}>
                <TextInput
                  ref={newPwRef}
                  style={[a.field, { paddingRight: 60 }, !!errors.password && a.fieldInvalid]}
                  placeholder="NEW PASSWORD"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={edit("password", setNewPassword)}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  editable={!loading}
                  accessibilityLabel="New password"
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                />
                <TouchableOpacity
                  onPress={() => setShowNew((v) => !v)}
                  style={a.eyeBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showNew ? "Hide password" : "Show password"}
                >
                  <Icon name={showNew ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <FieldError>{errors.password}</FieldError>
            </View>

            <View>
              <View style={a.fieldRow}>
                <TextInput
                  ref={confirmRef}
                  style={[a.field, { paddingRight: 60 }, !!errors.confirm && a.fieldInvalid]}
                  placeholder="CONFIRM PASSWORD"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={edit("confirm", setConfirmPassword)}
                  onSubmitEditing={handleResetPassword}
                  returnKeyType="done"
                  editable={!loading}
                  accessibilityLabel="Confirm new password"
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm((v) => !v)}
                  style={a.eyeBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirm ? "Hide password" : "Show password"}
                >
                  <Icon name={showConfirm ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <FieldError>{errors.confirm}</FieldError>
            </View>

            <FormError>{formError}</FormError>

            <TouchableOpacity
              style={[a.cta, loading && styles.disabled]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Reset password"
            >
              {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={a.ctaText}>Reset Password</Text>}
            </TouchableOpacity>
          </>
        )}
      </AuthScaffold>
    </Modal>
  );
}

/* ── Sign in ──────────────────────────────────────────────────────────── */
export default function Login({ navigation }) {
  const a = useAuthStyles();
  const { colors } = useTheme();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

  const [email, setEmail]                     = useState("");
  const [password, setPassword]               = useState("");
  const [isLoading, setIsLoading]             = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [showForgot, setShowForgot]           = useState(false);

  // Field errors show once a field has been left (or Log in pressed), then
  // track the value live so they clear the moment it's fixed. `authError` is
  // the form-level box for what the server says (wrong password, lockout…).
  const [touched, setTouched]   = useState({});
  const [authError, setAuthError] = useState("");
  const emailRef    = useRef(null);
  const passwordRef = useRef(null);

  const fieldErrors = { email: checkEmail(email), password: requiredPasswordError(password) };
  const errorFor = (field) => (touched[field] ? fieldErrors[field] : null);
  const touch = (field) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS !== "android") WebBrowser.coolDownAsync();
    };
  }, []);

  // ── Email login ──
  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    setAuthError("");
    if (fieldErrors.email)    return emailRef.current?.focus();
    if (fieldErrors.password) return passwordRef.current?.focus();
    if (!isLoaded) return setAuthError("Still getting ready. Try again in a moment.");

    setIsLoading(true);

    // Every failed attempt funnels through here: inside an active lockout it
    // always reports the lock; otherwise it counts toward MAX_ATTEMPTS.
    const registerFailure = async (lockedUntilFromClerk) => {
      const lock = await readLock(email);
      const now = Date.now();
      // A lock that has run out starts a fresh count
      if (lock.lockedUntil && lock.lockedUntil <= now) {
        lock.lockedUntil = 0;
        lock.fails = 0;
      }
      if (lockedUntilFromClerk) {
        lock.lockedUntil = Math.max(lock.lockedUntil, lockedUntilFromClerk);
      } else if (!lock.lockedUntil) {
        lock.fails += 1;
        if (lock.fails >= MAX_ATTEMPTS) lock.lockedUntil = now + LOCKOUT_MS;
      }
      if (lock.lockedUntil > now) {
        lock.fails = 0;
        await writeLock(email, lock);
        setAuthError(lockoutMessage(lock.lockedUntil));
      } else {
        await writeLock(email, lock);
        // Generic — don't specify which credential was wrong (avoids email enumeration)
        setAuthError("Incorrect email or password. Please try again.");
      }
    };

    try {
      const signInResult = await signIn.create({ identifier: email.trim(), password });

      if (signInResult.status === "needs_first_factor") {
        const emailFactor = signInResult.supportedFirstFactors?.find(
          (f) => f.strategy === "email_code"
        );
        if (emailFactor) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailFactor.emailAddressId,
          });
          navigation.navigate("EmailVerification", { email: email.trim(), fromLogin: true });
          showToast("Check your email for a verification code.", { type: "info" });
          return;
        }
      }

      if (signInResult.status === "needs_second_factor") {
        // The password was right — not a failed attempt. The Clerk instance has
        // no MFA turned on; this is its new-device check (Client Trust), which
        // emails a code the first time a device signs in with a password.
        await clearLock(email);
        const emailFactor = signInResult.supportedSecondFactors?.find(
          (f) => f.strategy === "email_code"
        );
        if (emailFactor) {
          try {
            await signIn.prepareSecondFactor({
              strategy: "email_code",
              emailAddressId: emailFactor.emailAddressId,
            });
          } catch (sendErr) {
            setAuthError(sendErr?.errors ? "Couldn't send a verification code. Please try again." : NETWORK_ERROR);
            return;
          }
          navigation.navigate("EmailVerification", { email: email.trim(), fromLogin: true, secondFactor: true });
          showToast("Check your email for a verification code.", { type: "info" });
          return;
        }
        // An authenticator app or backup code — the app has no screen for those.
        setAuthError("This account uses two-step verification, which isn't supported in the app yet.");
        return;
      }

      if (signInResult.status !== "complete") {
        await registerFailure();
        return;
      }

      await clearLock(email);
      await setActive({ session: signInResult.createdSessionId });
    } catch (err) {
      // Log Clerk's error codes explicitly; the raw error object prints as "e:"
      // in LogBox, which hides whether this was a bad password or a lockout.
      if (__DEV__) {
        console.error(
          "Email Login Error:",
          err?.errors?.map((e) => `${e.code}: ${e.longMessage || e.message}`).join(" | ") ||
            err?.message ||
            String(err)
        );
      }

      // No Clerk API response (offline, timeout, or a bug on our side) isn't a
      // wrong password and shouldn't count toward the lockout.
      if (!err?.errors) {
        captureError(err, { where: "Login.handleLogin" });
        setAuthError(NETWORK_ERROR);
        return;
      }

      const codes = err.errors.map((e) => e.code);

      // Rate limited by Clerk — a throttle, not a credential failure.
      if (codes.includes("too_many_requests")) {
        setAuthError("Too many requests. Please wait a moment and try again.");
        return;
      }

      // Correct password, but it appears in a known breach; Clerk refuses it
      // until it's changed. Counting it as a failure would lock them out for
      // knowing their own password.
      if (codes.includes("form_password_pwned")) {
        setAuthError("This password was found in a data breach. Use \"Forgot password\" to set a new one.");
        return;
      }

      // Clerk's own lock wins when present; its meta carries the remaining wait.
      const lockout = err.errors.find((e) => e.code === "user_locked");
      const secs = Number(lockout?.meta?.lockoutExpiresInSeconds ?? lockout?.meta?.lockout_expires_in_seconds);
      await registerFailure(
        lockout ? Date.now() + (secs > 0 ? secs * 1000 : LOCKOUT_MS) : undefined
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google login ──
  const handleGoogleLogin = async () => {
    if (isGoogleLoading || !isLoaded) return;
    setAuthError("");
    setIsGoogleLoading(true);
    try {
      const { createdSessionId } = await startOAuthFlow();
      if (!createdSessionId) throw new Error("No session returned from Google OAuth");
      await setActive({ session: createdSessionId });
    } catch (err) {
      if (err.code === "user-cancelled" || err.code === "browser-closed") return;
      if (__DEV__) {
        console.error("[google-oauth] failed:", {
          message: err?.message,
          code:    err?.code,
          status:  err?.status,
          clerk:   err?.errors,
        });
      }
      // Same place as every other sign-in problem, not a popup.
      setAuthError("Couldn't sign in with Google. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading;
  const disabled   = anyLoading || !isLoaded;

  return (
    <>
      <AuthScaffold title="Welcome" subtitle="Sign in to continue." background={LOGIN_BG}>
        {/* Google */}
        <TouchableOpacity
          style={[a.googleBtn, disabled && styles.disabled]}
          onPress={handleGoogleLogin}
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

        {/* Divider */}
        <View style={a.dividerRow}>
          <View style={a.dividerLine} />
          <Text style={a.dividerText}>OR</Text>
          <View style={a.dividerLine} />
        </View>

        {/* Email */}
        <View>
          <TextInput
            ref={emailRef}
            style={[a.field, !!errorFor("email") && a.fieldInvalid]}
            placeholder="EMAIL"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            autoCorrect={false}
            maxLength={EMAIL_MAX}
            value={email}
            onChangeText={(v) => { setEmail(cleanEmail(v)); if (authError) setAuthError(""); }}
            onBlur={() => touch("email")}
            editable={!disabled}
            accessibilityLabel="Email address"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <FieldError>{errorFor("email")}</FieldError>
        </View>

        {/* Password */}
        <View>
          <View style={a.fieldRow}>
            <TextInput
              ref={passwordRef}
              style={[a.field, { paddingRight: 60 }, !!errorFor("password") && a.fieldInvalid]}
              placeholder="PASSWORD"
              placeholderTextColor={colors.placeholder}
              secureTextEntry={!passwordVisible}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              value={password}
              onChangeText={(v) => { setPassword(v); if (authError) setAuthError(""); }}
              onBlur={() => touch("password")}
              editable={!disabled}
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
        </View>

        {/* What the server said: wrong password, lockout, offline… */}
        <FormError>{authError}</FormError>

        {/* Log in */}
        <TouchableOpacity
          style={[a.cta, styles.ctaSpace, disabled && styles.disabled]}
          onPress={handleLogin}
          disabled={disabled}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Log in"
        >
          {isLoading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={a.ctaText}>Log in</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowForgot(true)}
          style={styles.forgotRow}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Forgot password"
        >
          <Text style={[a.linkBold, styles.forgotText]}>Forgot Password?</Text>
        </TouchableOpacity>

        <View style={a.linkRow}>
          <Text style={a.linkMuted}>Don't have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Register")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Sign up for an account"
          >
            <Text style={a.linkBold}>Signup</Text>
          </TouchableOpacity>
        </View>
      </AuthScaffold>

      {isLoaded && (
        <ForgotPasswordModal
          visible={showForgot}
          onClose={() => setShowForgot(false)}
          signIn={signIn}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  disabled:   { opacity: 0.6 },
  ctaSpace:   { marginTop: 8 },
  forgotRow:  { alignSelf: "center", paddingVertical: 4 },
  forgotText: { fontFamily: fonts.sansBold },
});
