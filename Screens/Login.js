import { View, StyleSheet, TouchableOpacity, TextInput, Text } from "react-native";

export default function Login() {
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
        <TextInput style={styles.input} placeholder="Password" secureTextEntry />
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    },
    titleContainer: {
    alignItems: "center", 
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
    width: "100%",
    marginBottom: 20,
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
    },
    button: {
    backgroundColor: "#444",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
    },
    buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
});