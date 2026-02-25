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

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Block Node.js built-in modules from being resolved
    if (moduleName === 'fs' || moduleName === 'path' || moduleName === 'crypto') {
      return { type: 'empty' };
    }
    return context.resolveRequest(context, moduleName, platform);
  };

  return config;
})();