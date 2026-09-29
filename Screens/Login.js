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
import { showAlert } from "../components/AppAlert";
import { useState, useEffect } from "react";
import { useSignIn, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { captureError } from "../utils/crashReporter";
import { auth as A, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import AuthScaffold, { authStyles as a } from "../components/AuthScaffold";
import Icon from "../components/Icon";

WebBrowser.maybeCompleteAuthSession();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

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
  const [step, setStep]               = useState("email");
  const [email, setEmail]             = useState("");
  const [code, setCode]               = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [emailError, setEmailError]   = useState("");

  const reset = () => {
    setStep("email"); setEmail(""); setCode(""); setNewPassword("");
    setConfirmPassword(""); setShowNew(false); setShowConfirm(false);
    setLoading(false); setEmailError("");
  };
  const handleClose = () => { reset(); onClose(); };

  // Step 1 — send OTP
  const handleSendCode = async () => {
    if (!email.trim()) return setEmailError("Please enter your email address.");
    if (!isValidEmail(email)) return setEmailError("Enter a valid email address.");
    setEmailError("");
    setLoading(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: email.trim() });
      setStep("otp");
    } catch {
      // Generic message — don't reveal whether the email exists
      setEmailError("Could not send reset code. Check your email and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP + set new password
  const handleResetPassword = async () => {
    if (!code.trim())           return showAlert("Error", "Please enter the code sent to your email.");
    if (!newPassword)           return showAlert("Error", "Please enter a new password.");
    if (newPassword.length < 8) return showAlert("Error", "Password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return showAlert("Error", "Passwords do not match.");
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
        showAlert("Password updated", "You can now log in with your new password.", [
          { text: "OK", onPress: handleClose },
        ]);
      } else {
        showAlert("Error", "Could not complete password reset. Please try again.");
      }
    } catch {
      showAlert("Error", "Invalid or expired code. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <AuthScaffold
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
                style={[a.field, { backgroundColor: A.cyanField }]}
                placeholder="EMAIL"
                placeholderTextColor={A.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(""); }}
                editable={!loading}
                accessibilityLabel="Email address for password reset"
                maxFontSizeMultiplier={MAX_FONT_SCALE}
              />
              {!!emailError && <Text style={a.errorText}>{emailError}</Text>}
            </View>

            <TouchableOpacity
              style={[a.cta, loading && styles.disabled]}
              onPress={handleSendCode}
              disabled={loading}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Send reset code"
            >
              {loading ? <ActivityIndicator color={A.onCta} /> : <Text style={a.ctaText}>Send Reset Code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={[a.field, { backgroundColor: A.cyanField, letterSpacing: 6, textAlign: "center" }]}
              placeholder="000000"
              placeholderTextColor={A.muted}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              editable={!loading}
              accessibilityLabel="6-digit reset code"
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            />

            <View style={a.fieldRow}>
              <TextInput
                style={[a.field, { backgroundColor: A.cyanField, paddingRight: 60 }]}
                placeholder="NEW PASSWORD"
                placeholderTextColor={A.muted}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
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
                <Icon name={showNew ? "eye-off" : "eye"} size={20} color={A.muted} />
              </TouchableOpacity>
            </View>

            <View style={a.fieldRow}>
              <TextInput
                style={[a.field, { backgroundColor: A.cyanField, paddingRight: 60 }]}
                placeholder="CONFIRM PASSWORD"
                placeholderTextColor={A.muted}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
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
                <Icon name={showConfirm ? "eye-off" : "eye"} size={20} color={A.muted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[a.cta, loading && styles.disabled]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Reset password"
            >
              {loading ? <ActivityIndicator color={A.onCta} /> : <Text style={a.ctaText}>Reset Password</Text>}
            </TouchableOpacity>
          </>
        )}
      </AuthScaffold>
    </Modal>
  );
}

/* ── Sign in ──────────────────────────────────────────────────────────── */
export default function Login({ navigation }) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

  const [email, setEmail]                     = useState("");
  const [password, setPassword]               = useState("");
  const [isLoading, setIsLoading]             = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [showForgot, setShowForgot]           = useState(false);

  // Inline errors
  const [emailError, setEmailError]       = useState("");
  const [authError, setAuthError]         = useState("");   // shown below login button
  const [, setEmailTouched]               = useState(false);

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS !== "android") WebBrowser.coolDownAsync();
    };
  }, []);

  const handleEmailBlur = () => {
    setEmailTouched(true);
    if (!email.trim()) {
      setEmailError("Email address is required.");
    } else if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
    } else {
      setEmailError("");
    }
  };

  // ── Email login ──
  const handleLogin = async () => {
    // Surface inline errors first
    setEmailTouched(true);
    setAuthError("");
    let hasError = false;
    if (!email.trim()) { setEmailError("Email address is required."); hasError = true; }
    else if (!isValidEmail(email)) { setEmailError("Enter a valid email address."); hasError = true; }
    else setEmailError("");

    if (!password) {
      setAuthError("Please enter your password.");
      hasError = true;
    }
    if (hasError) return;
    if (!isLoaded) return setAuthError("Authentication is loading. Please wait.");

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
          showAlert("Verification Required", "Check your email for a verification code.");
          return;
        }
      }

      if (signInResult.status === "needs_second_factor") {
        // The password was right — not a failed attempt. The app has no MFA
        // screen, so say so rather than calling it a wrong password.
        await clearLock(email);
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
        setAuthError("Couldn't reach the server. Check your connection and try again.");
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
      showAlert("Sign-in failed", "Unable to sign in with Google. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading;
  const disabled   = anyLoading || !isLoaded;

  return (
    <>
      <AuthScaffold title="Welcome" subtitle="Sign in to continue.">
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

        {/* Email */}
        <View>
          <TextInput
            style={[a.field, { backgroundColor: A.cyanField }, !!emailError && styles.fieldError]}
            placeholder="EMAIL"
            placeholderTextColor={A.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (emailError) setEmailError("");
              if (authError) setAuthError("");
            }}
            onBlur={handleEmailBlur}
            editable={!disabled}
            accessibilityLabel="Email address"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          {!!emailError && <Text style={a.errorText}>{emailError}</Text>}
        </View>

        {/* Password */}
        <View style={a.fieldRow}>
          <TextInput
            style={[a.field, { backgroundColor: A.cyanField, paddingRight: 60 }]}
            placeholder="PASSWORD"
            placeholderTextColor={A.muted}
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={(v) => { setPassword(v); if (authError) setAuthError(""); }}
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
            <Icon name={passwordVisible ? "eye-off" : "eye"} size={20} color={A.muted} />
          </TouchableOpacity>
        </View>

        {/* Generic auth error */}
        {!!authError && (
          <View style={a.errorBox}>
            <Icon name="alert-circle" size={15} color="#8E1F16" />
            <Text style={a.errorBoxText}>{authError}</Text>
          </View>
        )}

        {/* Log in */}
        <TouchableOpacity
          style={[a.cta, styles.ctaSpace, disabled && styles.disabled]}
          onPress={handleLogin}
          disabled={disabled}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Log in"
        >
          {isLoading ? <ActivityIndicator color={A.onCta} /> : <Text style={a.ctaText}>Log in</Text>}
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
  fieldError: { borderWidth: 1.5, borderColor: "#8E1F16" },
  ctaSpace:   { marginTop: 8 },
  forgotRow:  { alignSelf: "center", paddingVertical: 4 },
  forgotText: { fontFamily: fonts.sansBold },
});
