import { View, StyleSheet, Button, TextInput } from "react-native";

export default function Login() {
  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Username"
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />

      <Button title="Login" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    height: 40,
    width: 200,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
});
