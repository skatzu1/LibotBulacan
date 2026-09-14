import { View, Text, StyleSheet, TouchableOpacity, Image, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, spacing, radius, typography } from "../context/ThemeContext";

export default function WelcomePage({ navigation }) {
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      <View style={styles.content}>
        <View style={styles.card}>
          <Image source={require("../assets/welcome.png")} style={styles.image} />
        </View>

        <View style={styles.titleContainer}>
          <Text style={[typography.h1, styles.title, { color: colors.textPrimary }]}>Welcome</Text>
          <Text style={[typography.body, styles.subtitle, { color: colors.textSecondary }]}>
            We're glad that you are here
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.accent }]}
        onPress={() => navigation.navigate("WelcomePage2")}
        activeOpacity={0.85}
      >
        <Text style={[typography.title, { color: colors.onAccent }]}>Continue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 360,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "85%",
    height: "85%",
    resizeMode: "contain",
  },
  titleContainer: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
  button: {
    width: "100%",
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
});
