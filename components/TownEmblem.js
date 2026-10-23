import React from "react";
import { View, Image } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { badgeImage } from "../utils/image";
import Icon from "./Icon";

/*
 * A town's badge is the image the admin uploaded on the panel's Town Badges
 * page. Until a town has one it shows the plain medal icon, like a spot badge
 * with no image — never a made-up picture of the town.
 */
function TownEmblem({ image, size = 96, color, style }) {
  const { colors } = useTheme();
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      {image ? (
        <Image source={{ uri: badgeImage(image, size) }} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : (
        <Icon name="award" size={Math.round(size * 0.4)} color={color || colors.textMuted} />
      )}
    </View>
  );
}

export default React.memo(TownEmblem);
