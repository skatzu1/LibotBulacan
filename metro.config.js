const { getDefaultConfig } = require("expo/metro-config");

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  config.resolver.assetExts.push("glb");
  config.resolver.assetExts.push("gltf");
  config.resolver.assetExts.push("bin");
  config.resolver.assetExts.push('tflite');

  return config;
})();