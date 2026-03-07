import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";

export default function WelcomePage({ navigation }) {
  return (
    <View style={styles.screen}>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>We're glad that you are here</Text>
      </View>

      <View style={styles.card}>
        <Image
          source={require("../assets/welcome.png")}
          style={styles.image}
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("WelcomePage2")}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7cfc9",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  // ── Title ──
  titleContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#4a2e2c",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#7a5a58",
    marginTop: 8,
  },

  // ── Image card ──
  card: {
    width: "100%",
    backgroundColor: "#f7cfc9",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    height: 380,
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: "contain",
  },

  // ── Button ──
  buttonContainer: {
    width: "100%",
    marginTop: 12,
  },
  button: {
    backgroundColor: "#6b4b45",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});