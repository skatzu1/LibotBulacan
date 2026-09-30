import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Text,
  ActivityIndicator,
} from "react-native";
import { showToast } from "../components/AppAlert";
import { useState, useRef } from "react";
import { useSignUp, useSignIn } from "@clerk/clerk-expo";
import { useTheme, fonts, MAX_FONT_SCALE } from "../context/ThemeContext";
import AuthScaffold, { useAuthStyles, FieldError, FormError } from "../components/AuthScaffold";
import { codeError as checkCode, clerkErrorToField, NETWORK_ERROR } from "../utils/authValidation";
import Icon from "../components/Icon";

const EMPTY_CODE = ["", "", "", "", "", ""];

export default function EmailVerification({ navigation, route }) {
  const a = useAuthStyles();
  const { colors } = useTheme();

  const { email, fromLogin } = route.params || {};
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();

  const [code, setCode] = useState(EMPTY_CODE);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  // Code problems sit under the boxes; anything else in the form-level box.
  const [codeErr, setCodeErr]   = useState("");
  const [formErr, setFormErr]   = useState("");

  const inputRefs = useRef([]);

  const resetCode = () => {
    setCode(EMPTY_CODE);
    inputRefs.current[0]?.focus();
  };

  // A rejected code clears the boxes and says why, under them.
  const rejectCode = (err) => {
    const { field, message } = clerkErrorToField(err);
    if (field === "code" || field === null) setCodeErr(message);
    else setFormErr(message);
    resetCode();
  };

  const handleCodeChange = (text, index) => {
    if (text && !/^\d+$/.test(text)) return;
    if (codeErr) setCodeErr("");
    if (formErr) setFormErr("");

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

    const incomplete = checkCode(verificationCode);
    if (incomplete) {
      setCodeErr(incomplete);
      inputRefs.current[code.findIndex((d) => !d)]?.focus();
      return;
    }

    if (!signUpLoaded && !signInLoaded) {
      setFormErr("Still getting ready. Try again in a moment.");
      return;
    }

    setCodeErr("");
    setFormErr("");
    setIsLoading(true);

    try {
      // Try signUp verification first (for new registrations)
      if (signUp && signUpLoaded && !fromLogin) {
        try {
          const result = await signUp.attemptEmailAddressVerification({ code: verificationCode });

          if (result.status === "complete") {
            await setActiveSignUp({ session: result.createdSessionId });
            showToast("Email verified. Welcome to Libot!", { type: "success" });
            setIsLoading(false);
            return;
          }
        } catch (signUpError) {
          console.error("SignUp verification error:", signUpError);
          rejectCode(signUpError);
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
            showToast("Email verified. Welcome back!", { type: "success" });
            setIsLoading(false);
            return;
          }
        } catch (signInError) {
          console.error("SignIn verification error:", signInError);
          rejectCode(signInError);
          setIsLoading(false);
          return;
        }
      }

      // If we get here, verification failed
      setCodeErr("Couldn't verify that code. Try again, or tap Resend.");
      resetCode();
    } catch (error) {
      console.error("Unexpected verification error:", error);
      setFormErr("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!signUpLoaded && !signInLoaded) {
      setFormErr("Still getting ready. Try again in a moment.");
      return;
    }

    setCodeErr("");
    setFormErr("");
    setIsResending(true);

    try {
      if (signUp && signUpLoaded && !fromLogin) {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        showToast("New code sent. Check your email.", { type: "success" });
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
      setFormErr(error?.errors ? "Couldn't send a new code. Please try again." : NETWORK_ERROR);
    } finally {
      setIsResending(false);
    }
  };

  const busy = isLoading || isResending;

  return (
    // Same photo-and-panel surface as Login and Register, in the app colours.
    <AuthScaffold
      onBack={busy ? undefined : () => navigation.goBack()}
      title="Verify Your Email"
      subtitle={`We've sent a 6-digit code to ${email}`}
    >
      <Text style={[styles.hint, { color: colors.textMuted }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Please check your inbox and spam folder
      </Text>

      <View style={styles.codeContainer}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.codeInput,
              { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.inputBorder },
              !!digit && { borderColor: colors.brand },
              !!codeErr && { borderColor: colors.danger },
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
      <FieldError style={styles.codeErrorRow}>{codeErr}</FieldError>
      <FormError>{formErr}</FormError>

      <TouchableOpacity
        style={[a.cta, busy && styles.disabled]}
        onPress={handleVerify}
        disabled={busy}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Verify email"
      >
        {isLoading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={a.ctaText}>Verify Email</Text>}
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
            ? <ActivityIndicator size="small" color={colors.brand} />
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
        <Icon name="arrow-left" size={15} color={colors.textSecondary} />
        <Text style={[styles.backText, { color: colors.textSecondary }]}>Back to {fromLogin ? "Login" : "Register"}</Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.55 },

  hint: {
    fontFamily: fonts.sansMedium, fontSize: 13,
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
  codeErrorRow:    { marginTop: -6, marginLeft: 4 },

  backRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: 4, paddingVertical: 4,
  },
  backText: { fontFamily: fonts.sansSemi, fontSize: 14.5 },
});
