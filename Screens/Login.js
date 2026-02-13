import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Text,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useState, useEffect } from "react";
import { useSignIn, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { color } from "three/tsl";

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
      console.log('🔵 Attempting email login for:', email);
      
      // Sign in with Clerk
      const signInResult = await signIn.create({ 
        identifier: email, 
        password 
      });

      console.log('🔵 Sign-in status:', signInResult.status);

      // Handle verification needed
      if (signInResult.status === 'needs_first_factor') {
        console.log('📧 Email verification needed');
        
        const emailFactor = signInResult.supportedFirstFactors?.find(
          f => f.strategy === 'email_code'
        );
        
        if (emailFactor) {
          await signIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: emailFactor.emailAddressId,
          });
          
          navigation.navigate("EmailVerification", { 
            email, 
            fromLogin: true 
          });
          
          Alert.alert(
            "Verification Required", 
            "Please check your email for the verification code."
          );
          return;
        }
      }

      // Check if login is complete
      if (signInResult.status !== "complete") {
        Alert.alert(
          "Login Failed",
          "Could not complete login. Please check your credentials."
        );
        return;
      }

      // Set active Clerk session
      await setActive({ session: signInResult.createdSessionId });
      console.log('✅ Login successful!');

      navigation.replace("Home");

    } catch (err) {
      console.error("❌ Email Login Error:", err);
      
      // Handle specific Clerk errors
      if (err.errors && err.errors[0]) {
        const errorCode = err.errors[0].code;
        const errorMessage = err.errors[0].message;
        
        if (errorCode === 'form_identifier_not_found') {
          Alert.alert("Login Failed", "No account found with this email address");
        } else if (errorCode === 'form_password_incorrect') {
          Alert.alert("Login Failed", "Incorrect password");
        } else if (errorCode === 'not_allowed_access') {
          Alert.alert("Login Failed", "Please verify your email before signing in");
        } else {
          Alert.alert("Login Failed", errorMessage || "Unable to login. Please try again.");
        }
      } else {
        Alert.alert("Login Failed", err.message || "Unable to login. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- GOOGLE LOGIN (SIMPLIFIED - NO BACKEND SYNC) ---
  const handleGoogleLogin = async () => {
    if (isGoogleLoading || !isLoaded) return;

    setIsGoogleLoading(true);

    try {
      console.log('🔵 Starting Google OAuth login...');
      
      // Start OAuth flow
      const { createdSessionId, signIn: oauthSignIn, signUp: oauthSignUp } = await startOAuthFlow();
      
      console.log('🔵 OAuth result:', {
        createdSessionId: !!createdSessionId,
        hasSignIn: !!oauthSignIn,
        hasSignUp: !!oauthSignUp
      });

      // Check if we got a session
      if (!createdSessionId) {
        throw new Error("No session returned from Google OAuth");
      }

      // Set active Clerk session - THIS IS ALL WE NEED!
      await setActive({ session: createdSessionId });
      console.log('✅ Google login successful!');

      // Navigate to Home
      navigation.replace("Home");

    } catch (err) {
      console.error("❌ Google Login Error:", err);
      
      // Don't show error if user cancelled
      if (err.code === 'user-cancelled' || err.code === 'browser-closed') {
        console.log('User cancelled OAuth');
        return;
      }
      
      Alert.alert(
        "Login Failed", 
        err.message || "Unable to login with Google. Please try again."
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>

      {/* GOOGLE LOGIN */}
      <View style={styles.googleButtonContainer}>
        <TouchableOpacity
          style={[
            styles.googleButton, 
            (isGoogleLoading || isLoading || !isLoaded) && styles.disabled
          ]}
          onPress={handleGoogleLogin}
          disabled={isGoogleLoading || isLoading || !isLoaded}
        >
          {isGoogleLoading ? (
            <ActivityIndicator color="#444" />
          ) : (
            <>
              <Text style={styles.googleIcon}>🔍</Text>
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
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!isLoading && !isGoogleLoading && isLoaded}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry={!passwordVisible}
          value={password}
          onChangeText={setPassword}
          editable={!isLoading && !isGoogleLoading && isLoaded}
        />
      </View>

      <View style={styles.passwordToggleContainer}>
        <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
          <Text style={styles.eyeButton}>
            {passwordVisible ? "Hide" : "Show"} Password
          </Text>
        </TouchableOpacity>
      </View>

      {/* LOGIN BUTTON */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.loginButton, 
            (isLoading || isGoogleLoading || !isLoaded) && styles.disabled
          ]}
          onPress={handleLogin}
          disabled={isLoading || isGoogleLoading || !isLoaded}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
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
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
    padding: 20,
    paddingTop: 80,
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    color: "#444",
    marginTop: 8,
  },
  googleButtonContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  googleButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "90%",
    borderWidth: 1,
    borderColor: "#6b4b45",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  googleIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ccc",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#666",
    fontWeight: "500",
  },
  inputContainer: {
    gap: 15,
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
  },
  passwordToggleContainer: {
    marginLeft: 15,
    marginBottom: 20,
  },
  eyeButton: {
    color: "#6b4b45",
    fontWeight: "600",
    fontSize: 14,
  },
  buttonContainer: {
    alignItems: "center",
    marginTop: 10,
  },
  loginButton: {
    backgroundColor: "#6b4b45",
    paddingVertical: 16,
    borderRadius: 12,
    width: "80%",
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
    marginTop: 25,
  },
  registerLink: {
    color: "#6b4b45",
    fontWeight: "700",
  },
});