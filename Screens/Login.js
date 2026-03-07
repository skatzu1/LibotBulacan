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
} from "react-native";
import { useState, useEffect } from "react";
import { useSignIn, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export default function Login({ navigation }) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [isLoading, setIsLoading]           = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS !== "android") WebBrowser.coolDownAsync();
    };
  }, []);

  // ── Email login ──
  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert("Error", "Please enter email and password");
    }
    if (!isLoaded) {
      return Alert.alert("Error", "Authentication system is loading. Please wait.");
    }

    setIsLoading(true);
    try {
      const signInResult = await signIn.create({ identifier: email, password });

      if (signInResult.status === "needs_first_factor") {
        const emailFactor = signInResult.supportedFirstFactors?.find(
          (f) => f.strategy === "email_code"
        );
        if (emailFactor) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailFactor.emailAddressId,
          });
          navigation.navigate("EmailVerification", { email, fromLogin: true });
          Alert.alert("Verification Required", "Please check your email for the verification code.");
          return;
        }
      }

      if (signInResult.status !== "complete") {
        Alert.alert("Login Failed", "Could not complete login. Please check your credentials.");
        return;
      }

      await setActive({ session: signInResult.createdSessionId });
    } catch (err) {
      console.error("Email Login Error:", err);
      Alert.alert("Login Failed", err.message || "Unable to login. Please try again.");
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
      Alert.alert("Login Failed", err.message || "Unable to login with Google. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        {/* Google login */}
        <TouchableOpacity
          style={[styles.googleButton, (isGoogleLoading || isLoading || !isLoaded) && styles.disabled]}
          onPress={handleGoogleLogin}
          disabled={isGoogleLoading || isLoading || !isLoaded}
          activeOpacity={0.85}
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
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            placeholderTextColor="#b0908c"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!isLoading && !isGoogleLoading && isLoaded}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#b0908c"
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
            editable={!isLoading && !isGoogleLoading && isLoaded}
          />
          <TouchableOpacity
            onPress={() => setPasswordVisible(!passwordVisible)}
            style={styles.eyeButton}
          >
            <Text style={styles.eyeButtonText}>
              {passwordVisible ? "Hide" : "Show"} Password
            </Text>
          </TouchableOpacity>
        </View>

        {/* Login button */}
        <TouchableOpacity
          style={[styles.button, (isLoading || isGoogleLoading || !isLoaded) && styles.disabled]}
          onPress={handleLogin}
          disabled={isLoading || isGoogleLoading || !isLoaded}
          activeOpacity={0.85}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Login</Text>
          }
        </TouchableOpacity>

        {/* Register link */}
        <View style={styles.linkRow}>
          <Text style={styles.linkText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.link}>Sign Up</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
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
    marginBottom: 20,
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
  eyeButton: {
    alignSelf: "flex-end",
  },
  eyeButtonText: {
    color: "#6b4b45",
    fontWeight: "600",
    fontSize: 14,
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

  // ── Link row ──
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
});