// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["android/*", "ios/*", "dist/*", "Claude outputs/*", "node_modules/*"],
  },
  {
    rules: {
      // Guards against HTML entity mistakes on the web. React Native's <Text>
      // renders apostrophes and quotes literally, so "isn't" is correct here.
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["__tests__/**/*.js", "**/*.test.js"],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    // Build-time Node scripts and config plugins, not app code.
    files: ["scripts/**/*.js", "plugins/**/*.js"],
    languageOptions: { globals: { ...globals.node } },
  },
]);
