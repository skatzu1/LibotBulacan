const { getDefaultConfig } = require("expo/metro-config");

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  // ── Asset extensions (single source of truth — removed from app.json) ──
  // .glb/.gltf/.bin are the Viro 3D models. The .tflite/.onnx entries were
  // dropped along with onnxruntime-react-native: mission verification runs
  // server-side (POST /api/verify/:missionId), so no model files ship in the
  // app bundle any more.
  config.resolver.assetExts.push("glb");
  config.resolver.assetExts.push("gltf");
  config.resolver.assetExts.push("bin");

  config.resolver.sourceExts.push("cjs");

  // (The three.js blockList that used to live here is gone — three /
  // three-stdlib / expo-gl were unused and have been removed, so there's
  // nothing left to block.)

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