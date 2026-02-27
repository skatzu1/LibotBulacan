import { View, StyleSheet, TouchableOpacity, TextInput, Text, Alert, ActivityIndicator, Platform, Image } from "react-native";
import { useState, useEffect } from "react";
import CheckBox from "expo-checkbox";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSignUp, useOAuth, useUser } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { authAPI } from '../api';

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

      // Save to backend
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

  // --- EMAIL SIGNUP ---
  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword || !birthdate) return Alert.alert("Error", "Please fill in all fields");
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
      if (errorCode === 'form_identifier_exists') Alert.alert("Registration Failed", "An account with this email already exists.");
      else Alert.alert("Registration Failed", errorMessage || "Unable to register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Fill in the form to continue</Text>
        </View>

        {/* Google Signup */}
        <TouchableOpacity style={[styles.googleButton, isGoogleLoading && styles.disabled]} onPress={handleGoogleSignUp} disabled={isGoogleLoading || isLoading || !isLoaded}>
          {isGoogleLoading ? <ActivityIndicator color="#444" /> : (
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

        {/* Input Fields */}
        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="Full Name" value={name} placeholderTextColor="#aaaaaa" onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Email" value={email} placeholderTextColor="#aaaaaa" onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" secureTextEntry={!passwordVisible} value={password} placeholderTextColor="#aaaaaa" onChangeText={setPassword} />
          <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
            <Text style={styles.eyeButton}>{passwordVisible ? "Hide" : "Show"} Password</Text>
          </TouchableOpacity>
          <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry={!confirmPasswordVisible} value={confirmPassword} placeholderTextColor="#aaaaaa" onChangeText={setConfirmPassword} />
          <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
            <Text style={styles.eyeButton}>{confirmPasswordVisible ? "Hide" : "Show"} Password</Text>
          </TouchableOpacity>

          {/* Birthdate */}
          <TouchableOpacity style={styles.birthdateContainer} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
            <Text style={styles.birthdateText}>{birthdate ? birthdate.toDateString() : "Select your birthdate"}</Text>
            <Text style={styles.calendarIcon}>📅</Text>
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
        <TouchableOpacity style={[styles.registerButton, (isLoading || isGoogleLoading) && styles.disabled]} onPress={handleRegister} disabled={isLoading || isGoogleLoading || !isLoaded}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
        </TouchableOpacity>

        {/* Login Redirect */}
        <View style={styles.loginContainer}>
          <Text>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f7cfc9", padding: 20, justifyContent: "center" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  titleContainer: { alignItems: "center", marginBottom: 25 },
  title: { fontSize: 28, fontWeight: "700", color: "#333" },
  subtitle: { fontSize: 16, color: "#555", marginTop: 6, textAlign: "center" },
  googleButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#6b4b45", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  googleLogo: { width: 24, height: 24, resizeMode: "contain", marginRight: 10 },
  googleButtonText: { fontSize: 16, fontWeight: "600", color: "#444" },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#ccc" },
  dividerText: { marginHorizontal: 10, color: "#666", fontWeight: "500", fontSize: 14 },
  inputContainer: { gap: 12, marginBottom: 20 },
  input: { backgroundColor: "#f2f2f2", padding: 14, borderRadius: 12, fontSize: 16 },
  eyeButton: { fontSize: 14, color: "#6b4b45", fontWeight: "600" },
  birthdateContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f2f2f2", paddingVertical: 16, paddingHorizontal: 20, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: "#ddd", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  birthdateText: { fontSize: 16, color: "#333", fontWeight: "500" },
  calendarIcon: { fontSize: 22, color: "#6b4b45" },
  termsContainer: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  termsText: { fontSize: 14, color: "#444", marginLeft: 8 },
  registerButton: { backgroundColor: "#6b4b45", padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 10 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  disabled: { opacity: 0.6 },
  loginContainer: { flexDirection: "row", justifyContent: "center" },
  loginLink: { fontSize: 14, color: "#6b4b45", fontWeight: "700" },
});