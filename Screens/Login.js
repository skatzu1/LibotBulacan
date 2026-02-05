import { View, StyleSheet, TouchableOpacity, TextInput, Text, Alert, ActivityIndicator } from "react-native";
import { useState } from "react";
import CheckBox from "expo-checkbox";
import { useAuth } from "../context/AuthContext"; 

export default function Login({ navigation }) {
  const [isChecked, setChecked] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();

  const handleForgotPassword = () => { 
    alert("Password reset feature coming soon!"); 
  };

  const handleLogin = async () => {
    // Validation
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (!result.success) {
        // Show error message from backend
        Alert.alert(
          "Login Failed", 
          result.message || "Invalid credentials. Please check your email and password."
        );
      }
      // If successful, the AuthContext will handle navigation automatically
    } catch (error) {
      Alert.alert(
        "Error", 
        "Unable to connect to server. Please check your internet connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>
          Please sign in to continue
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          placeholderTextColor="#808080" 
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!isLoading}
        />
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          placeholderTextColor="#808080" 
          secureTextEntry={!passwordVisible}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          editable={!isLoading}
        />
      </View>

      <View style={styles.showhideContainer}>
        <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
          <Text style={styles.eyeButton}>
            {passwordVisible ? "Hide" : "Show"} Password
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.checkboxContainer}>
        <View style={styles.rememberRow}>
          <CheckBox 
            value={isChecked} 
            onValueChange={setChecked}
            color={isChecked ? "#6b4b45" : undefined}
            style={styles.checkbox}
          />
          <Text style={styles.rememberMe}>Remember me</Text>
        </View>
        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={styles.forgotPassword}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Optional: Add a sign up link */}
      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.signupLink}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.devButtonContainer}>
        <TouchableOpacity 
          style={styles.devButton}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.devButtonText}>Dev: Skip to Home</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
    screen: {
      backgroundColor: "#f7cfc9",
      flex: 1,
      padding: 20,
      paddingTop: 80,
    },
    titleContainer: {
      alignItems: "center", 
      marginBottom: 80,
      marginTop: 60,
    },
    title: {
      fontSize: 25,
      fontWeight: "700",
      textAlign: "center",
    },
    subtitle: {
      fontSize: 18,
      textAlign: "center",
      color: "#444",
      marginTop: 10,
    },
    inputContainer: {
      width: "95%",
      marginBottom: -5,
      alignSelf: "center",
      gap: 20,
    },
    input: {
      backgroundColor: "#fff",
      padding: 15,
      borderRadius: 10,
      marginBottom: 10,
      width: "100%",
      color: "#000",
    },
    buttonContainer: {
      width: "100%",
      alignItems: "center",
    },
    loginButton: {
      backgroundColor: "#6b4b45",
      padding: 15,
      borderRadius: 10,
      alignItems: "center",
      width: "80%",
    },
    loginButtonDisabled: {
      backgroundColor: "#999",
    },
    buttonText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 18,
    },
    checkboxContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 30,
    },
    rememberRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    checkbox: {
      marginLeft: 25,
    },
    rememberMe: {
      marginLeft: 8,
      fontSize: 16,
    },
    forgotPassword: {
      fontSize: 13,
      marginRight: 30,
    },
    showhideContainer: {
      marginLeft: 25,
      marginBottom: 15,
    },
    eyeButton: {
      fontSize: 14,
      color: "#6b4b45",
      fontWeight: "600",
    },
    signupContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 20,
    },
    signupText: {
      fontSize: 14,
      color: "#444",
    },
    signupLink: {
      fontSize: 14,
      color: "#6b4b45",
      fontWeight: "700",
    },
    devButtonContainer: {
      alignItems: "center",
      marginTop: 15,
    },
    devButton: {
      backgroundColor: "#999",
      padding: 10,
      borderRadius: 8,
      width: "60%",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#666",
    },
    devButtonText: {
      color: "#fff",
      fontWeight: "600",
      fontSize: 12,
    },
});