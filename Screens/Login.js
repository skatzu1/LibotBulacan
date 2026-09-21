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
import { auth as A, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import AuthScaffold, { authStyles as a } from "../components/AuthScaffold";
import Icon from "../components/Icon";

WebBrowser.maybeCompleteAuthSession();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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

      if (signInResult.status !== "complete") {
        // Generic — don't specify which credential was wrong
        setAuthError("Incorrect email or password. Please try again.");
        return;
      }

      await setActive({ session: signInResult.createdSessionId });
    } catch (err) {
      console.error("Email Login Error:", err);

      // Lockout is the one case worth naming. The generic message below would
      // send someone into an endless retry loop against an account that cannot
      // accept a password right now, however correct it is. Clerk's longMessage
      // already carries the remaining wait, so prefer it when present.
      const lockout = err?.errors?.find((e) => e.code === "user_locked");
      if (lockout) {
        setAuthError(
          lockout.longMessage ||
            "Too many failed attempts. This account is temporarily locked — please try again later."
        );
        return;
      }

      // Always show a generic message — avoids email enumeration
      setAuthError("Incorrect email or password. Please try again.");
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
