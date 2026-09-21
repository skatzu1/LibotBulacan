import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Text,
  ActivityIndicator,
} from "react-native";
import { showAlert, showToast } from "../components/AppAlert";
import { useState, useRef } from "react";
import { useSignUp, useSignIn } from "@clerk/clerk-expo";
import { auth as A, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import AuthScaffold, { authStyles as a } from "../components/AuthScaffold";
import Icon from "../components/Icon";

const EMPTY_CODE = ["", "", "", "", "", ""];

export default function EmailVerification({ navigation, route }) {

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
    // Same cyan surface as Login / Forgot Password. This screen isn't in the
    // mockups, but it sits in the middle of both the sign-up and sign-in flows
    // — leaving it on the in-app palette would break the front door in half.
    <AuthScaffold
      onBack={busy ? undefined : () => navigation.goBack()}
      title="Verify Your Email"
      subtitle={`We've sent a 6-digit code to ${email}`}
    >
      <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Please check your inbox and spam folder
      </Text>

      <View style={styles.codeContainer}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.codeInput,
              { backgroundColor: A.cyanField, color: A.ink },
              !!digit && styles.codeInputFilled,
            ]}
            value={digit}
            onChangeText={(text) => handleCodeChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            editable={!busy}
            accessibilityLabel={`Verification code, digit ${index + 1} of 6`}
            maxFontSizeMultiplier={1}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[a.cta, busy && styles.disabled]}
        onPress={handleVerify}
        disabled={busy}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Verify email"
      >
        {isLoading ? <ActivityIndicator color={A.onCta} /> : <Text style={a.ctaText}>Verify Email</Text>}
      </TouchableOpacity>

      <View style={a.linkRow}>
        <Text style={a.linkMuted}>Didn't receive the code? </Text>
        <TouchableOpacity
          onPress={handleResendCode}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Resend verification code"
        >
          {isResending
            ? <ActivityIndicator size="small" color={A.ink} />
            : <Text style={a.linkBold}>Resend</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.backRow}
        onPress={() => navigation.goBack()}
        disabled={busy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Back to ${fromLogin ? "login" : "register"}`}
      >
        <Icon name="arrow-left" size={15} color={A.muted} />
        <Text style={styles.backText}>Back to {fromLogin ? "Login" : "Register"}</Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.55 },

  hint: {
    fontFamily: fonts.sansMedium, fontSize: 13, color: A.muted,
    textAlign: 'center', marginTop: -10,
  },

  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
    gap: 8,
  },
  codeInput: {
    flex: 1,
    maxWidth: 54,
    height: 62,
    borderRadius: 16,
    fontSize: 24,
    fontFamily: fonts.sansBold,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  codeInputFilled: { borderColor: A.ink },

  backRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: 4, paddingVertical: 4,
  },
  backText: { fontFamily: fonts.sansSemi, fontSize: 14.5, color: A.muted },
});
