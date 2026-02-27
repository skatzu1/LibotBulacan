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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS !== "android") WebBrowser.coolDownAsync();
    };
  }, []);

  // --- EMAIL LOGIN ---
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

          Alert.alert(
            "Verification Required",
            "Please check your email for the verification code."
          );
          return;
        }
      }

      if (signInResult.status !== "complete") {
        Alert.alert(
          "Login Failed",
          "Could not complete login. Please check your credentials."
        );
        return;
      }

      await setActive({ session: signInResult.createdSessionId });
      navigation.replace("Home");
    } catch (err) {
      console.error("Email Login Error:", err);
      Alert.alert("Login Failed", err.message || "Unable to login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- GOOGLE LOGIN ---
  const handleGoogleLogin = async () => {
    if (isGoogleLoading || !isLoaded) return;

    setIsGoogleLoading(true);

    try {
      const { createdSessionId } = await startOAuthFlow();

      if (!createdSessionId) {
        throw new Error("No session returned from Google OAuth");
      }

      await setActive({ session: createdSessionId });
      navigation.replace("Home");
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

        {/* GOOGLE LOGIN */}
        <View style={styles.googleButtonContainer}>
          <TouchableOpacity
            style={[
              styles.googleButton,
              (isGoogleLoading || isLoading || !isLoaded) && styles.disabled,
            ]}
            onPress={handleGoogleLogin}
            disabled={isGoogleLoading || isLoading || !isLoaded}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#444" />
            ) : (
              <>
                <Image
                  source={require("../assets/googlelogo.png")}
                  style={styles.googleLogo}
                />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* DIVIDER */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* EMAIL / PASSWORD */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            placeholderTextColor="#aaaaaa"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!isLoading && !isGoogleLoading && isLoaded}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaaaaa"
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
            editable={!isLoading && !isGoogleLoading && isLoaded}
          />
        </View>

        <View style={styles.passwordToggleContainer}>
          <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
            <Text style={styles.eyeButton}>{passwordVisible ? "Hide" : "Show"} Password</Text>
          </TouchableOpacity>
        </View>

        {/* LOGIN BUTTON */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.loginButton,
              (isLoading || isGoogleLoading || !isLoaded) && styles.disabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading || isGoogleLoading || !isLoaded}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
          </TouchableOpacity>
        </View>

        {/* REGISTER LINK */}
        <View style={styles.registerContainer}>
          <Text>Don't have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Register")}
            disabled={isLoading || isGoogleLoading}
          >
            <Text style={styles.registerLink}>Sign Up</Text>
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
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8, // Android shadow
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 5,
  },
  googleButtonContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  googleButton: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  googleLogo: {
    width: 20,
    height: 20,
    resizeMode: "contain",
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ccc",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#999",
    fontWeight: "500",
  },
  inputContainer: {
    gap: 15,
    marginBottom: 15,
  },
  input: {
    backgroundColor: "#f7f7f7",
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    color: "#000000"
  },
  passwordToggleContainer: {
    alignItems: "flex-end",
    marginBottom: 15,
  },
  eyeButton: {
    color: "#6b4b45",
    fontWeight: "600",
    fontSize: 14,
  },
  buttonContainer: {
    alignItems: "center",
    marginTop: 5,
  },
  loginButton: {
    backgroundColor: "#6b4b45",
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.6,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  registerLink: {
    color: "#6b4b45",
    fontWeight: "700",
  },
});