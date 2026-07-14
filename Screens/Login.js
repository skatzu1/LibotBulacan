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
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useState, useEffect } from "react";
import { useSignIn, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";

WebBrowser.maybeCompleteAuthSession();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── Forgot Password Modal ────────────────────────────────────────
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
    } catch (err) {
      // Generic message — don't reveal whether email exists
      setEmailError("Could not send reset code. Check your email and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP + set new password
  const handleResetPassword = async () => {
    if (!code.trim())           return Alert.alert("Error", "Please enter the code sent to your email.");
    if (!newPassword)           return Alert.alert("Error", "Please enter a new password.");
    if (newPassword.length < 8) return Alert.alert("Error", "Password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return Alert.alert("Error", "Passwords do not match.");
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
        password: newPassword,
      });
      if (result.status === "complete") {
        Alert.alert("Password updated", "You can now log in with your new password.", [
          { text: "OK", onPress: handleClose },
        ]);
      } else {
        Alert.alert("Error", "Could not complete password reset. Please try again.");
      }
    } catch (err) {
      Alert.alert("Error", "Invalid or expired code. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.modalOverlayInner}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {step === "email" ? "Reset Password" : "Enter Code"}
                  </Text>
                  <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={22} color="#4a2e2c" />
                  </TouchableOpacity>
                </View>

                {step === "email" ? (
                  <>
                    <Text style={styles.modalSubtitle}>
                      Enter the email linked to your account and we'll send you a reset code.
                    </Text>
                    <TextInput
                      style={[styles.modalInput, emailError ? styles.modalInputError : null]}
                      placeholder="Email address"
                      placeholderTextColor="#b0908c"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={email}
                      onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(""); }}
                      editable={!loading}
                      accessibilityLabel="Email address for password reset"
                    />
                    {emailError ? (
                      <Text style={styles.errorText}>
                        <Feather name="alert-circle" size={12} /> {emailError}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.modalBtn, loading && styles.disabled]}
                      onPress={handleSendCode}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.modalBtnText}>Send Reset Code</Text>
                      }
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.modalSubtitle}>
                      We sent a 6-digit code to{" "}
                      <Text style={{ fontWeight: "700", color: "#4a2e2c" }}>{email}</Text>.
                      Enter it below with your new password.
                    </Text>

                    <TextInput
                      style={styles.modalInput}
                      placeholder="6-digit code"
                      placeholderTextColor="#b0908c"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={code}
                      onChangeText={setCode}
                      editable={!loading}
                      accessibilityLabel="6-digit reset code"
                    />

                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.modalInput, { flex: 1 }]}
                        placeholder="New password"
                        placeholderTextColor="#b0908c"
                        secureTextEntry={!showNew}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        editable={!loading}
                        accessibilityLabel="New password"
                      />
                      <TouchableOpacity onPress={() => setShowNew((v) => !v)} style={styles.eyeBtn}>
                        <Feather name={showNew ? "eye-off" : "eye"} size={18} color="#6b4b45" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.modalInput, { flex: 1 }]}
                        placeholder="Confirm new password"
                        placeholderTextColor="#b0908c"
                        secureTextEntry={!showConfirm}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        editable={!loading}
                        accessibilityLabel="Confirm new password"
                      />
                      <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn}>
                        <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color="#6b4b45" />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.modalBtn, loading && styles.disabled]}
                      onPress={handleResetPassword}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.modalBtnText}>Reset Password</Text>
                      }
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setStep("email")} style={styles.backLink}>
                      <Feather name="arrow-left" size={14} color="#6b4b45" />
                      <Text style={styles.backLinkText}>Use a different email</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Login Screen ────────────────────────────────────────────
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
  const [emailTouched, setEmailTouched]   = useState(false);

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
          Alert.alert("Verification Required", "Check your email for a verification code.");
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
      Alert.alert("Sign-in failed", "Unable to sign in with Google. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.screen}>
        <View style={styles.card}>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          {/* Google login */}
          <TouchableOpacity
            style={[styles.googleButton, (anyLoading || !isLoaded) && styles.disabled]}
            onPress={handleGoogleLogin}
            disabled={anyLoading || !isLoaded}
            activeOpacity={0.85}
            accessibilityLabel="Sign in with Google"
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#444" />
            ) : (
              <>
                <Image source={require("../assets/googlelogo.png")} style={styles.googleLogo} />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email / Password */}
          <View style={styles.inputContainer}>

            {/* Email with inline validation */}
            <View>
              <TextInput
                style={[styles.input, emailError ? styles.inputError : null]}
                placeholder="Email"
                autoCapitalize="none"
                placeholderTextColor="#b0908c"
                keyboardType="email-address"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  // Clear errors while typing so user gets immediate feedback
                  if (emailError) setEmailError("");
                  if (authError) setAuthError("");
                }}
                onBlur={handleEmailBlur}
                editable={!anyLoading && isLoaded}
                accessibilityLabel="Email address"
              />
              {emailError ? (
                <Text style={styles.errorText}>
                  <Feather name="alert-circle" size={12} /> {emailError}
                </Text>
              ) : null}
            </View>

            {/* Password with eye icon */}
            <View style={styles.passwordInputRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Password"
                placeholderTextColor="#b0908c"
                secureTextEntry={!passwordVisible}
                value={password}
                onChangeText={(v) => { setPassword(v); if (authError) setAuthError(""); }}
                editable={!anyLoading && isLoaded}
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
          </View>

          {/* Auth error (generic, shown below inputs) */}
          {authError ? (
            <View style={styles.authErrorBox}>
              <Feather name="alert-circle" size={14} color="#e05252" />
              <Text style={styles.authErrorText}>{authError}</Text>
            </View>
          ) : null}

          {/* Login button */}
          <TouchableOpacity
            style={[styles.button, (anyLoading || !isLoaded) && styles.disabled]}
            onPress={handleLogin}
            disabled={anyLoading || !isLoaded}
            activeOpacity={0.85}
            accessibilityLabel="Login"
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Login</Text>
            }
          </TouchableOpacity>

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => setShowForgot(true)}
            accessibilityLabel="Forgot password"
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Register link */}
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Register")} accessibilityLabel="Sign up">
              <Text style={styles.link}>Sign Up</Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Forgot Password Modal */}
        {isLoaded && (
          <ForgotPasswordModal
            visible={showForgot}
            onClose={() => setShowForgot(false)}
            signIn={signIn}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
    padding: 20,
    justifyContent: "center",
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
    marginBottom: 16,
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

  // ── Auth error box ──
  authErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff5f5",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#f0c4c4",
  },
  authErrorText: {
    fontSize: 13,
    color: "#e05252",
    fontWeight: "500",
    flex: 1,
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

  // ── Forgot / link row ──
  forgotRow: {
    alignItems: "center",
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 14,
    color: "#6b4b45",
    fontWeight: "600",
  },
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

  // ── Forgot Password Modal ──
  modalOverlay: {
    flex: 1,
  },
  modalOverlayInner: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#f7cfc9",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4a2e2c",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#7a5a58",
    lineHeight: 20,
    marginBottom: 18,
  },
  modalInput: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 15,
    color: "#4a2e2c",
    borderWidth: 1.5,
    borderColor: "#e8d0ce",
    marginBottom: 12,
  },
  modalInputError: {
    borderColor: "#e05252",
    backgroundColor: "#fff5f5",
  },
  modalBtn: {
    backgroundColor: "#6b4b45",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  modalBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyeBtn: {
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
  },
  backLinkText: {
    fontSize: 14,
    color: "#6b4b45",
    fontWeight: "600",
  },
});