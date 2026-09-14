import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Text,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import { showAlert, showToast } from "../components/AppAlert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef } from "react";
import { useSignUp, useSignIn } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";
import { useTheme, spacing, radius, typography } from "../context/ThemeContext";

const EMPTY_CODE = ["", "", "", "", "", ""];

export default function EmailVerification({ navigation, route }) {
  const { colors, isDark } = useTheme();
  const { email, fromLogin } = route.params || {};
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();

  const [code, setCode] = useState(EMPTY_CODE);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef([]);

  const resetCode = () => {
    setCode(EMPTY_CODE);
    inputRefs.current[0]?.focus();
  };

  const handleCodeChange = (text, index) => {
    if (text && !/^\d+$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join("");

    if (verificationCode.length !== 6) {
      showAlert("Error", "Please enter the complete 6-digit code");
      return;
    }

    if (!signUpLoaded && !signInLoaded) {
      showAlert("Error", "Please wait, loading...");
      return;
    }

    setIsLoading(true);

    try {
      // Try signUp verification first (for new registrations)
      if (signUp && signUpLoaded && !fromLogin) {
        try {
          const result = await signUp.attemptEmailAddressVerification({ code: verificationCode });

          if (result.status === "complete") {
            await setActiveSignUp({ session: result.createdSessionId });
            showToast("Email verified — welcome to Libot!", { type: "success" });
            setIsLoading(false);
            return;
          }
        } catch (signUpError) {
          console.error("SignUp verification error:", signUpError);
          const errorCode = signUpError.errors?.[0]?.code;
          const errorMessage = signUpError.errors?.[0]?.message;

          if (errorCode === "form_code_incorrect") {
            showAlert("Invalid Code", "The verification code is incorrect. Please try again.");
          } else if (errorCode === "verification_expired") {
            showAlert("Code Expired", "This verification code has expired. Please request a new one.");
          } else {
            showAlert("Verification Failed", errorMessage || "Unable to verify code. Please try again.");
          }
          resetCode();
          setIsLoading(false);
          return;
        }
      }

      // Try signIn verification (for login flow)
      if (signIn && signInLoaded && fromLogin) {
        try {
          const result = await signIn.attemptFirstFactor({
            strategy: "email_code",
            code: verificationCode,
          });

          if (result.status === "complete") {
            await setActiveSignIn({ session: result.createdSessionId });
            showToast("Email verified — welcome back!", { type: "success" });
            setIsLoading(false);
            return;
          }
        } catch (signInError) {
          console.error("SignIn verification error:", signInError);
          const errorCode = signInError.errors?.[0]?.code;
          const errorMessage = signInError.errors?.[0]?.message;

          if (errorCode === "form_code_incorrect") {
            showAlert("Invalid Code", "The verification code is incorrect. Please try again.");
          } else {
            showAlert("Verification Failed", errorMessage || "Unable to verify code.");
          }
          resetCode();
          setIsLoading(false);
          return;
        }
      }

      // If we get here, verification failed
      showAlert("Verification Failed", "Unable to verify the code. Please try again.");
      resetCode();
    } catch (error) {
      console.error("Unexpected verification error:", error);
      showAlert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!signUpLoaded && !signInLoaded) {
      showAlert("Error", "Please wait, loading...");
      return;
    }

    setIsResending(true);

    try {
      if (signUp && signUpLoaded && !fromLogin) {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        showToast("New code sent — check your email.", { type: "success" });
        resetCode();
      }

      if (signIn && signInLoaded && fromLogin) {
        const emailFactor = signIn.supportedFirstFactors?.find(
          (factor) => factor.strategy === "email_code"
        );
        if (emailFactor) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailFactor.emailAddressId,
          });
          showToast("New code sent to your email.", { type: "success" });
          resetCode();
        }
      }
    } catch (error) {
      console.error("Resend error:", error);
      showAlert("Error", "Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const busy = isLoading || isResending;

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
          <View style={[styles.iconCircle, { backgroundColor: colors.card }]}>
            <Feather name="mail" size={30} color={colors.brand} />
          </View>

          <View style={styles.titleContainer}>
            <Text style={[typography.h1, styles.center, { color: colors.textPrimary }]}>Verify Your Email</Text>
            <Text style={[typography.body, styles.center, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              We've sent a 6-digit code to
            </Text>
            <Text style={[typography.bodyStrong, styles.center, { color: colors.brand, marginTop: spacing.xs }]}>
              {email}
            </Text>
            <Text style={[typography.caption, styles.center, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Please check your inbox and spam folder
            </Text>
          </View>

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.textPrimary,
                    borderColor: digit ? colors.brand : colors.inputBorder,
                  },
                ]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!busy}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.verifyButton, { backgroundColor: colors.accent }, busy && styles.disabled]}
            onPress={handleVerify}
            disabled={busy}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color={colors.onAccent} />
              : <Text style={[typography.title, { color: colors.onAccent }]}>Verify Email</Text>
            }
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>Didn't receive the code? </Text>
            <TouchableOpacity onPress={handleResendCode} disabled={busy}>
              {isResending
                ? <ActivityIndicator size="small" color={colors.brand} />
                : <Text style={[typography.bodyStrong, { color: colors.textPrimary, fontWeight: "700" }]}>Resend</Text>
              }
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.backContainer}
            onPress={() => navigation.goBack()}
            disabled={busy}
          >
            <Feather name="arrow-left" size={14} color={colors.textSecondary} />
            <Text style={[typography.bodyStrong, { color: colors.textPrimary }]}>
              Back to {fromLogin ? "Login" : "Register"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  center: { textAlign: "center" },

  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.lg,
  },

  titleContainer: { alignItems: "center", marginBottom: spacing.xxl },

  codeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  codeInput: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    borderWidth: 2,
  },

  verifyButton: {
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    width: "100%",
  },
  disabled: { opacity: 0.55 },

  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xl,
  },
  backContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
});
