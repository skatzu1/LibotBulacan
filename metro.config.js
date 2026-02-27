const { getDefaultConfig } = require("expo/metro-config");

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  // Your existing asset extensions
  config.resolver.assetExts.push("glb");
  config.resolver.assetExts.push("gltf");
  config.resolver.assetExts.push("bin");
  config.resolver.assetExts.push("tflite");

  // Fix for TensorFlow.js
  config.resolver.sourceExts.push("cjs");

  // ── Block unused three.js files to prevent OOM crash ──
  config.resolver.blockList = [
    /node_modules\/three\/examples\/jsm\/(?!loaders\/).*/,
    /node_modules\/three\/examples\/js\/.*/,
  ];

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "fs" || moduleName === "path" || moduleName === "crypto") {
      return { type: "empty" };
    }
    return context.resolveRequest(context, moduleName, platform);
  };

  return config;
})();