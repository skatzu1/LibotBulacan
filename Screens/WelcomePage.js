import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

export default function WelcomePage2({ navigation }) {
  return (
    <View style={styles.screen}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>
          we're glad that you are here
        </Text>
      </View>

      <View style={styles.card}></View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("WelcomePage2")} // Replace the "navigate" with "replace" after finalizing nigga
        >
          <Text style={styles.buttonText}>Continue</Text>
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
  card: {
    width: "100%",
    backgroundColor: "#f7cfc9",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
    justifyContent: "space-between",
    height: 400, 
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
  button: {
    backgroundColor: "#6b4b45",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
