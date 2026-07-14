import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const message =
        this.props?.fallbackMessage ||
        "Something went wrong. Please try again.";

      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>😵</Text>
          <Text style={styles.title}>Oops!</Text>
          <Text style={styles.message}>{message}</Text>
          {this.props.showDetails && this.state.error && (
            <Text style={styles.detail}>
              {this.state.error.toString()}
            </Text>
          )}
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleReset}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7cfc9",
    padding: 30,
  },
  emoji:    { fontSize: 60, marginBottom: 12 },
  title:    { fontSize: 22, fontWeight: "700", color: "#4a2e2c", marginBottom: 8 },
  message:  { fontSize: 15, color: "#7a5a58", textAlign: "center", lineHeight: 22, marginBottom: 8 },
  detail:   { fontSize: 11, color: "#b0908c", textAlign: "center", marginBottom: 20, fontFamily: "monospace" },
  button:   { backgroundColor: "#6b4b45", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
