import { View, StyleSheet, TouchableOpacity, TextInput, Text, Alert, ActivityIndicator, Platform } from "react-native";
import { useState, useEffect } from "react";
import CheckBox from "expo-checkbox";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSignUp, useOAuth, useUser } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { authAPI } from '../services/api';

WebBrowser.maybeCompleteAuthSession();

export default function Register({ navigation }) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const { user } = useUser();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [birthdate, setBirthdate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS !== 'android') WebBrowser.coolDownAsync();
    };
  }, []);

  // --- GOOGLE SIGNUP ---
  const handleGoogleSignUp = async () => {
    if (isGoogleLoading || !isLoaded) return;
    setIsGoogleLoading(true);

    try {
      const { createdSessionId } = await startOAuthFlow();
      if (!createdSessionId) throw new Error("No session returned from Google OAuth");

      await setActive({ session: createdSessionId });

      // Send session to backend
      const saveUserResult = await authAPI.register({
        clerkSessionId: createdSessionId,
        isGoogle: true
      });

      if (!saveUserResult.success) {
        Alert.alert("Sign Up Failed", saveUserResult.message || "Could not save user");
        return;
      }

      Alert.alert("Success", "Google account registered successfully!");
      navigation.navigate("Home");

    } catch (err) {
      console.error("Google Sign Up Error:", err);
      Alert.alert(
        "Sign Up Failed",
        err.message || "Unable to sign up with Google."
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // --- EMAIL SIGNUP ---
  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword || !birthdate) {
      return Alert.alert("Error", "Please fill in all fields");
    }
    if (password !== confirmPassword) return Alert.alert("Error", "Passwords do not match");
    if (!agreeToTerms) return Alert.alert("Error", "Please agree to the Terms and Conditions");
    if (!isLoaded) return Alert.alert("Error", "Authentication system is loading. Please wait.");

    setIsLoading(true);
    try {
      const [firstName, ...lastNameParts] = name.trim().split(' ');
      const lastName = lastNameParts.join(' ') || '';

      const signUpResult = await signUp.create({ emailAddress: email, password, firstName, lastName });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      navigation.navigate("EmailVerification", { email, firstName, lastName, fromLogin: false, signUpId: signUpResult.id });

    } catch (err) {
      console.error("Email Registration Error:", err);
      const errorCode = err.errors?.[0]?.code;
      const errorMessage = err.errors?.[0]?.message;
      if (errorCode === 'form_identifier_exists') {
        Alert.alert("Registration Failed", "An account with this email already exists.");
      } else {
        Alert.alert("Registration Failed", errorMessage || "Unable to register. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Please fill in the form to continue</Text>
      </View>

      {/* Google Signup */}
      <View style={styles.googleButtonContainer}>
        <TouchableOpacity
          style={[styles.googleButton, isGoogleLoading && styles.googleButtonDisabled]}
          onPress={handleGoogleSignUp}
          disabled={isGoogleLoading || isLoading || !isLoaded}
        >
          {isGoogleLoading ? <ActivityIndicator color="#444" /> : (
            <>
              <Text style={styles.googleIcon}>🔍</Text>
              <Text style={styles.googleButtonText}>Sign up with Google</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Input Fields */}
      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder="Full Name" value={name} placeholderTextColor="#aaaaaa" onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Email" value={email} placeholderTextColor="#aaaaaa" onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Password"  secureTextEntry={!passwordVisible} value={password} placeholderTextColor="#aaaaaa" onChangeText={setPassword} />
        <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
          <Text style={styles.eyeButton}>{passwordVisible ? "Hide" : "Show"} Password</Text>
        </TouchableOpacity>
        <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry={!confirmPasswordVisible} value={confirmPassword} placeholderTextColor="#aaaaaa" onChangeText={setConfirmPassword} />
        <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
          <Text style={styles.eyeButton}>{confirmPasswordVisible ? "Hide" : "Show"} Password</Text>
        </TouchableOpacity>

        {/* Birthdate Picker */}
        <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.datePickerText}>{birthdate ? birthdate.toDateString() : "Select Birthdate"}</Text>
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
        <CheckBox value={agreeToTerms} onValueChange={setAgreeToTerms} />
        <Text style={styles.termsText}>I agree to the Terms and Conditions</Text>
      </View>

      {/* Register Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.registerButton, (isLoading || isGoogleLoading) && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={isLoading || isGoogleLoading || !isLoaded}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
        </TouchableOpacity>
      </View>

      {/* Login Redirect */}
      <View style={styles.loginContainer}>
        <Text>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
          <Text style={styles.loginLink}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f7cfc9", flex: 1, padding: 20, paddingTop: 60 },
  titleContainer: { alignItems: "center", marginBottom: 30 },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 16, color: "#444", textAlign: "center", marginTop: 6 },
  googleButtonContainer: { width: "100%", alignItems: "center", marginBottom: 20 },
  googleButton: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    width: "90%",
    borderWidth: 1,
    borderColor: "#6b4b45",
    flexDirection: "row",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  googleButtonDisabled: { backgroundColor: "#f5f5f5", borderColor: "#ccc" },
  googleIcon: { fontSize: 20, marginRight: 10 },
  googleButtonText: { color: "#444", fontWeight: "600", fontSize: 16 },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginVertical: 20, paddingHorizontal: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#ccc" },
  dividerText: { marginHorizontal: 10, color: "#666", fontWeight: "500", fontSize: 14 },
  inputContainer: { width: "95%", marginBottom: 20, alignSelf: "center", gap: 15 },
  input: { backgroundColor: "#fff", padding: 14, borderRadius: 12, fontSize: 16 },
  eyeButton: { fontSize: 14, color: "#6b4b45", fontWeight: "600", marginBottom: 8 },
  datePickerButton: { backgroundColor: "#fff", padding: 14, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  datePickerText: { color: "#444", fontSize: 16 },
  termsContainer: { flexDirection: "row", alignItems: "center", marginBottom: 30 },
  termsText: { fontSize: 14, color: "#444", marginLeft: 8 },
  buttonContainer: { width: "100%", alignItems: "center" },
  registerButton: { backgroundColor: "#6b4b45", padding: 16, borderRadius: 12, alignItems: "center", width: "80%" },
  registerButtonDisabled: { backgroundColor: "#999" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  loginContainer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  loginLink: { fontSize: 14, color: "#6b4b45", fontWeight: "700" },
});
