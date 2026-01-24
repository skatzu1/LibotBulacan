import { View, StyleSheet, TouchableOpacity, TextInput, Text } from "react-native";
import { useState } from "react";
import CheckBox, { Checkbox } from "expo-checkbox";

export default function Login() {
  const [isChecked, setChecked] = useState(false);
  const handleForgotPassword = () => { alert("nigga"); }
  const [PasswordVisible, setPasswordVisible] = useState(false);
  return (
    <View style={styles.screen}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>
          Please sign in to continue
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder="Username" />
        <TextInput style={styles.input} placeholder="Password" 
        secureTextEntry={PasswordVisible} />
      </View>

      <View style={styles.showhideContainer}>
        <TouchableOpacity onPress={() => setPasswordVisible(!PasswordVisible)}>
          <Text style={styles.eyeButton}>{PasswordVisible ? "Show" : "Hide"} Password</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.checkboxContainer}>
        <View style={styles.rememberRow}>
          <CheckBox value={isChecked} onValueChange={setChecked}
          color={isChecked ? "#f7cfc9" : "#ffffff"}
          marginLeft={25}/>
          <Text style={styles.rememberMe}>Remember me</Text>
        </View>
        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={styles.forgotPassword}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Login</Text>
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
    },
    buttonContainer: {
      width: "100%",
      alignItems: "center",
    },
    button: {
      backgroundColor: "#6b4b45",
      padding: 15,
      borderRadius: 10,
      alignItems: "center",
      width: "80%",
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
    }
});