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
  ScrollView,
} from "react-native";
import { useState, useEffect } from "react";
import CheckBox from "expo-checkbox";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSignUp, useOAuth, useUser } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { authAPI } from "../api";

WebBrowser.maybeCompleteAuthSession();

export default function Register({ navigation }) {
  const { isLoaded, signUp, setActive }     = useSignUp();
  const { startOAuthFlow }                  = useOAuth({ strategy: "oauth_google" });
  const { user }                            = useUser();

  const [name, setName]                             = useState("");
  const [email, setEmail]                           = useState("");
  const [password, setPassword]                     = useState("");
  const [confirmPassword, setConfirmPassword]       = useState("");
  const [passwordVisible, setPasswordVisible]       = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [agreeToTerms, setAgreeToTerms]             = useState(false);
  const [birthdate, setBirthdate]                   = useState(new Date());
  const [showDatePicker, setShowDatePicker]         = useState(false);
  const [isLoading, setIsLoading]                   = useState(false);
  const [isGoogleLoading, setIsGoogleLoading]       = useState(false);

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS !== "android") WebBrowser.coolDownAsync();
    };
  }, []);

  // ── Google signup ──
  const handleGoogleSignUp = async () => {
    if (isGoogleLoading || !isLoaded) return;
    setIsGoogleLoading(true);
    try {
      const { createdSessionId } = await startOAuthFlow();
      if (!createdSessionId) throw new Error("No session returned from Google OAuth");
      await setActive({ session: createdSessionId });
      const saveUserResult = await authAPI.register({ clerkSessionId: createdSessionId, isGoogle: true });
      if (!saveUserResult.success) return Alert.alert("Sign Up Failed", saveUserResult.message || "Could not save user");
      Alert.alert("Success", "Google account registered successfully!");
      navigation.navigate("Home");
    } catch (err) {
      console.error("Google Sign Up Error:", err);
      Alert.alert("Sign Up Failed", err.message || "Unable to sign up with Google.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // ── Email signup ──
  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword || !birthdate)
      return Alert.alert("Error", "Please fill in all fields");
    if (password !== confirmPassword)
      return Alert.alert("Error", "Passwords do not match");
    if (!agreeToTerms)
      return Alert.alert("Error", "Please agree to the Terms and Conditions");
    if (!isLoaded)
      return Alert.alert("Error", "Authentication system is loading. Please wait.");

    setIsLoading(true);
    try {
      const [firstName, ...lastNameParts] = name.trim().split(" ");
      const lastName = lastNameParts.join(" ") || "";
      const signUpResult = await signUp.create({ emailAddress: email, password, firstName, lastName });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      navigation.navigate("EmailVerification", {
        email, firstName, lastName, fromLogin: false, signUpId: signUpResult.id,
      });
    } catch (err) {
      console.error("Email Registration Error:", err);
      const errorCode    = err.errors?.[0]?.code;
      const errorMessage = err.errors?.[0]?.message;
      if (errorCode === "form_identifier_exists")
        Alert.alert("Registration Failed", "An account with this email already exists.");
      else
        Alert.alert("Registration Failed", errorMessage || "Unable to register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Fill in the form to continue</Text>
          </View>

          {/* Google signup */}
          <TouchableOpacity
            style={[styles.googleButton, (isGoogleLoading || isLoading) && styles.disabled]}
            onPress={handleGoogleSignUp}
            disabled={isGoogleLoading || isLoading || !isLoaded}
            activeOpacity={0.85}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#444" />
            ) : (
              <>
                <Image source={require("../assets/googlelogo.png")} style={styles.googleLogo} />
                <Text style={styles.googleButtonText}>Sign up with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Input fields */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#b0908c"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#b0908c"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#b0908c"
              secureTextEntry={!passwordVisible}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} style={styles.eyeButton}>
              <Text style={styles.eyeButtonText}>{passwordVisible ? "Hide" : "Show"} Password</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#b0908c"
              secureTextEntry={!confirmPasswordVisible}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)} style={styles.eyeButton}>
              <Text style={styles.eyeButtonText}>{confirmPasswordVisible ? "Hide" : "Show"} Password</Text>
            </TouchableOpacity>

            {/* Birthdate */}
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.dateButtonText}>
                {birthdate ? birthdate.toDateString() : "Select your birthdate"}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={birthdate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (selectedDate) setBirthdate(selectedDate);
                }}
              />
            )}
          </View>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <CheckBox value={agreeToTerms} onValueChange={setAgreeToTerms} color="#6b4b45" />
            <Text style={styles.termsText}>I agree to the Terms and Conditions</Text>
          </View>

          {/* Register button */}
          <TouchableOpacity
            style={[styles.button, (isLoading || isGoogleLoading) && styles.disabled]}
            onPress={handleRegister}
            disabled={isLoading || isGoogleLoading || !isLoaded}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Register</Text>
            }
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.link}>Sign In</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
  },
  scrollContent: {
    padding: 20,
    justifyContent: "center",
    flexGrow: 1,
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
    marginTop: -6,
  },
  eyeButtonText: {
    color: "#6b4b45",
    fontWeight: "600",
    fontSize: 14,
  },
  dateButton: {
    backgroundColor: "#faf5f4",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e8d0ce",
  },
  dateButtonText: {
    fontSize: 15,
    color: "#4a2e2c",
    fontWeight: "500",
  },

  // ── Terms ──
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 10,
  },
  termsText: {
    fontSize: 14,
    color: "#7a5a58",
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