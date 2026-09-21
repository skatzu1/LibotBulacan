import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "../components/Icon";

// Light-only for launch — pull the static light palette so this class component
// (no hooks) still renders on-brand.
const C = {
  bg:       "#FFFFFF",
  card:     "#D3EEF1",
  brand:    "#0C7A84",
  brandDark:"#1E2728",
  text:     "#4C5A5B",
  accent:   "#F2CE1B",
  onAccent: "#2C2810",
};

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // TODO(deploy): forward to a crash reporter (e.g. Sentry) here.
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
          <View style={styles.badge}>
            <Icon name="alert-triangle" size={30} color={C.brand} />
          </View>
          <Text style={styles.title}>Oops!</Text>
          <Text style={styles.message}>{message}</Text>
          {this.props.showDetails && this.state.error && (
            <Text style={styles.detail}>{this.state.error.toString()}</Text>
          )}
          <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Try again</Text>
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
    backgroundColor: C.bg,
    padding: 32,
  },
  badge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.card,
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
  },
  title:   { fontSize: 22, fontWeight: "800", letterSpacing: -0.3, color: C.brandDark, marginBottom: 8 },
  message: { fontSize: 15, color: C.text, textAlign: "center", lineHeight: 22, marginBottom: 10 },
  detail:  { fontSize: 11, color: C.text, textAlign: "center", marginBottom: 20, fontFamily: "monospace", opacity: 0.7 },
  button:  { backgroundColor: C.accent, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 999 },
  buttonText: { color: C.onAccent, fontSize: 14.5, fontWeight: "800" },
});
