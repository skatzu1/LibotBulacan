import { View, StyleSheet, TouchableOpacity, TextInput, Text, Alert, ActivityIndicator } from "react-native";
import { useState } from "react";
import CheckBox from "expo-checkbox";
import { useAuth } from "../context/AuthContext";

export default function Register({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useAuth();

  const handleRegister = async () => {
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (name.trim().length < 2) {
      Alert.alert("Error", "Name must be at least 2 characters");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    // Password validation
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (!agreeToTerms) {
      Alert.alert("Error", "Please agree to the Terms and Conditions");
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await register(email, password, name);
      
      if (result.success) {
        Alert.alert(
          "Success", 
          "Account created successfully!",
          [
            {
              text: "OK",
              onPress: () => navigation.replace("Home")
            }
          ]
        );
      } else {
        Alert.alert(
          "Registration Failed", 
          result.message || "Unable to create account. Please try again."
        );
      }
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
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Please fill in the form to continue
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input} 
          placeholder="Full Name" 
          placeholderTextColor="#808080" 
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          editable={!isLoading}
        />
        
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
          editable={!isLoading}
        />

        <View style={styles.showhideContainer}>
          <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
            <Text style={styles.eyeButton}>
              {passwordVisible ? "Hide" : "Show"} Password
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput 
          style={styles.input} 
          placeholder="Confirm Password" 
          placeholderTextColor="#808080" 
          secureTextEntry={!confirmPasswordVisible}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!isLoading}
        />

        <View style={styles.showhideContainer}>
          <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
            <Text style={styles.eyeButton}>
              {confirmPasswordVisible ? "Hide" : "Show"} Password
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.termsContainer}>
        <CheckBox 
          value={agreeToTerms} 
          onValueChange={setAgreeToTerms}
          color={agreeToTerms ? "#6b4b45" : undefined}
          style={styles.checkbox}
          disabled={isLoading}
        />
        <Text style={styles.termsText}>
          I agree to the Terms and Conditions
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.registerButton, isLoading && styles.registerButtonDisabled]} 
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Register</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.loginContainer}>
        <Text style={styles.loginText}>Already have an account? </Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate("Login")}
          disabled={isLoading}
        >
          <Text style={styles.loginLink}>Sign In</Text>
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
    marginBottom: 60,
    marginTop: 40,
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
  },
  showhideContainer: {
    marginLeft: 25,
    marginBottom: 15,
    marginTop: -15,
  },
  eyeButton: {
    fontSize: 14,
    color: "#6b4b45",
    fontWeight: "600",
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 25,
    marginBottom: 30,
    marginTop: 10,
  },
  checkbox: {
    marginRight: 8,
  },
  termsText: {
    fontSize: 14,
    color: "#444",
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
  },
  registerButton: {
    backgroundColor: "#6b4b45",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    width: "80%",
  },
  registerButtonDisabled: {
    backgroundColor: "#999",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  loginText: {
    fontSize: 14,
    color: "#444",
  },
  loginLink: {
    fontSize: 14,
    color: "#6b4b45",
    fontWeight: "700",
  },
});