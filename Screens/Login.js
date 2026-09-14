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
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  StatusBar,
} from "react-native";
import { showAlert } from "../components/AppAlert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { useSignIn, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { useTheme, spacing, radius, typography, shadow } from "../context/ThemeContext";
import Logo from "../components/Logo";

WebBrowser.maybeCompleteAuthSession();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── Forgot Password Modal ────────────────────────────────────────
function ForgotPasswordModal({ visible, onClose, signIn }) {
  const { colors } = useTheme();
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
    } catch (err) {
      showAlert("Error", "Invalid or expired code. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [
    styles.modalInput,
    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={[styles.modalOverlayInner, { backgroundColor: colors.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={[typography.h2, { color: colors.textPrimary }]}>
                    {step === "email" ? "Reset Password" : "Enter Code"}
                  </Text>
                  <TouchableOpacity onPress={handleClose} hitSlop={8}>
                    <Feather name="x" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {step === "email" ? (
                  <>
                    <Text style={[typography.body, styles.modalSubtitle, { color: colors.textSecondary }]}>
                      Enter the email linked to your account and we'll send you a reset code.
                    </Text>
                    <TextInput
                      style={[inputStyle, emailError ? { borderColor: colors.danger, backgroundColor: colors.dangerBg } : null]}
                      placeholder="Email address"
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={email}
                      onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(""); }}
                      editable={!loading}
                      accessibilityLabel="Email address for password reset"
                    />
                    {emailError ? (
                      <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
                        {emailError}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.accent }, loading && styles.disabled]}
                      onPress={handleSendCode}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading
                        ? <ActivityIndicator color={colors.onAccent} />
                        : <Text style={[typography.title, { color: colors.onAccent }]}>Send Reset Code</Text>
                      }
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={[typography.body, styles.modalSubtitle, { color: colors.textSecondary }]}>
                      We sent a 6-digit code to{" "}
                      <Text style={{ fontWeight: "700", color: colors.textPrimary }}>{email}</Text>.
                      Enter it below with your new password.
                    </Text>

                    <TextInput
                      style={inputStyle}
                      placeholder="6-digit code"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={code}
                      onChangeText={setCode}
                      editable={!loading}
                      accessibilityLabel="6-digit reset code"
                    />

                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[inputStyle, styles.flex]}
                        placeholder="New password"
                        placeholderTextColor={colors.placeholder}
                        secureTextEntry={!showNew}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        editable={!loading}
                        accessibilityLabel="New password"
                      />
                      <TouchableOpacity onPress={() => setShowNew((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
                        <Feather name={showNew ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[inputStyle, styles.flex]}
                        placeholder="Confirm new password"
                        placeholderTextColor={colors.placeholder}
                        secureTextEntry={!showConfirm}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        editable={!loading}
                        accessibilityLabel="Confirm new password"
                      />
                      <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
                        <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.accent }, loading && styles.disabled]}
                      onPress={handleResetPassword}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading
                        ? <ActivityIndicator color={colors.onAccent} />
                        : <Text style={[typography.title, { color: colors.onAccent }]}>Reset Password</Text>
                      }
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setStep("email")} style={styles.backLink}>
                      <Feather name="arrow-left" size={14} color={colors.textSecondary} />
                      <Text style={[typography.bodyStrong, { color: colors.textPrimary }]}>Use a different email</Text>
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
  const { colors, isDark } = useTheme();
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
      showAlert("Sign-in failed", "Unable to sign in with Google. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading;
  const disabled   = anyLoading || !isLoaded;

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary },
  ];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }, shadow.md]}>

            <View style={styles.titleContainer}>
              <Logo size={64} style={styles.logo} />
              <Text style={[typography.h1, { color: colors.textPrimary }]}>Welcome Back</Text>
              <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
                Sign in to continue
              </Text>
            </View>

            {/* Google login */}
            <TouchableOpacity
              style={[
                styles.googleButton,
                { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                disabled && styles.disabled,
              ]}
              onPress={handleGoogleLogin}
              disabled={disabled}
              activeOpacity={0.85}
              accessibilityLabel="Sign in with Google"
            >
              {isGoogleLoading ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : (
                <>
                  <Image source={require("../assets/googlelogo.png")} style={styles.googleLogo} />
                  <Text style={[typography.bodyStrong, { color: colors.textPrimary }]}>
                    Sign in with Google
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

            {/* Email / Password */}
            <View style={styles.inputContainer}>
              <View>
                <TextInput
                  style={[inputStyle, emailError ? { borderColor: colors.danger, backgroundColor: colors.dangerBg } : null]}
                  placeholder="Email"
                  autoCapitalize="none"
                  placeholderTextColor={colors.placeholder}
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
                />
                {emailError ? (
                  <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
                    {emailError}
                  </Text>
                ) : null}
              </View>

              {/* Password with eye icon */}
              <View style={styles.passwordInputRow}>
                <TextInput
                  style={[inputStyle, styles.passwordInput]}
                  placeholder="Password"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={(v) => { setPassword(v); if (authError) setAuthError(""); }}
                  editable={!disabled}
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
            </View>

            {/* Auth error (generic, shown below inputs) */}
            {authError ? (
              <View style={[styles.authErrorBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Feather name="alert-circle" size={14} color={colors.danger} />
                <Text style={[typography.body, styles.authErrorText, { color: colors.danger }]}>{authError}</Text>
              </View>
            ) : null}

            {/* Login button */}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accent }, disabled && styles.disabled]}
              onPress={handleLogin}
              disabled={disabled}
              activeOpacity={0.85}
              accessibilityLabel="Login"
            >
              {isLoading
                ? <ActivityIndicator color={colors.onAccent} />
                : <Text style={[typography.title, { color: colors.onAccent }]}>Login</Text>
              }
            </TouchableOpacity>

            {/* Forgot password */}
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => setShowForgot(true)}
              accessibilityLabel="Forgot password"
            >
              <Text style={[typography.bodyStrong, { color: colors.textPrimary }]}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Register link */}
            <View style={styles.linkRow}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Register")} accessibilityLabel="Sign up">
                <Text style={[typography.bodyStrong, { color: colors.textPrimary, fontWeight: "700" }]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      {isLoaded && (
        <ForgotPasswordModal
          visible={showForgot}
          onClose={() => setShowForgot(false)}
          signIn={signIn}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },

  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
  },

  titleContainer: { alignItems: "center", marginBottom: spacing.xl },
  logo: { marginBottom: spacing.md },
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

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: spacing.md },

  inputContainer: { gap: spacing.md, marginBottom: spacing.lg },
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

  authErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  authErrorText: { flex: 1, fontWeight: "500" },

  primaryBtn: {
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  disabled: { opacity: 0.55 },

  forgotRow: { alignItems: "center", marginBottom: spacing.lg },
  linkRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },

  // ── Forgot Password Modal ──
  modalOverlayInner: { flex: 1, justifyContent: "flex-end" },
  modalCard: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: Platform.OS === "ios" ? spacing.xxl : spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalSubtitle: { marginBottom: spacing.lg },
  modalInput: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    fontSize: 15,
    borderWidth: 1.5,
    marginBottom: spacing.md,
  },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  eyeBtn: { paddingHorizontal: spacing.sm, paddingBottom: spacing.md },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
});
