const { getDefaultConfig } = require("expo/metro-config");

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  // ── Asset extensions (single source of truth — removed from app.json) ──
  config.resolver.assetExts.push("glb");
  config.resolver.assetExts.push("gltf");
  config.resolver.assetExts.push("bin");
  config.resolver.assetExts.push("tflite");
  config.resolver.assetExts.push("onnx");

  // ── TensorFlow.js CJS support ──
  config.resolver.sourceExts.push("cjs");

  // ── Block unused three.js files to prevent OOM crash ──
  config.resolver.blockList = [
    // Block everything in jsm/ except loaders/ and utils/ (utils needed by some libs)
    /node_modules\/three\/examples\/jsm\/(?!(loaders|utils)\/).*/,
    /node_modules\/three\/examples\/js\/.*/,
  ];

  // ── Polyfill Node core modules as empty to prevent null JSI crash ──
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const emptyModules = ["fs", "path", "crypto"];
    if (emptyModules.includes(moduleName)) {
      return { type: "empty" };
    }
    return context.resolveRequest(context, moduleName, platform);
  };

  return config;
})();