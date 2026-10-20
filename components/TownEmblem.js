import React from "react";
import { View, Image } from "react-native";
import Svg, { Circle, Path, Defs, Text as SvgText, TextPath } from "react-native-svg";
import { fonts } from "../context/ThemeContext";
import { badgeImage } from "../utils/image";
import { sealInk, starPath } from "../utils/townEmblem";

/*
 * A town's badge: the image the admin uploaded on the panel's Town Badges page,
 * or until there is one, a drawn seal — the town's name round the rim,
 * "BULACAN" below, and the Libot compass star in the middle, in the town's own
 * ink (utils/townEmblem.js).
 */
function TownEmblem({ town, image, size = 96, style }) {
  if (image) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <Image source={{ uri: badgeImage(image, size) }} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
    );
  }
  const ink = sealInk(town);
  const id = `seal${String(town).replace(/\W+/g, "")}`;
  const name = String(town).toUpperCase();
  return (
    <View style={[{ width: size, height: size }, style]} accessible accessibilityRole="image" accessibilityLabel={`${town} town seal`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <Path id={`${id}top`} d="M 16 50 A 34 34 0 0 1 84 50" />
          <Path id={`${id}bot`} d="M 20 54 A 30 30 0 0 0 80 54" />
        </Defs>
        <Circle cx="50" cy="50" r="48" fill={ink} />
        <Circle cx="50" cy="50" r="44" fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="1.5 2.5" />
        <Circle cx="50" cy="50" r="25" fill="#FFFFFF" fillOpacity={0.12} />
        <Path d={starPath(50, 50, 21, 12, 5.5)} fill="#F2CE1B" />
        <Circle cx="50" cy="50" r="3.2" fill={ink} />
        <SvgText fill="#FFFFFF" fontSize={name.length > 12 ? 7 : 8.5} fontFamily={fonts.sansBold} letterSpacing={1}>
          <TextPath href={`#${id}top`} startOffset="50%" textAnchor="middle">{name}</TextPath>
        </SvgText>
        <SvgText fill="#FFFFFF" fillOpacity={0.8} fontSize={6} fontFamily={fonts.sansSemi} letterSpacing={1.8}>
          <TextPath href={`#${id}bot`} startOffset="50%" textAnchor="middle">BULACAN</TextPath>
        </SvgText>
      </Svg>
    </View>
  );
}

export default React.memo(TownEmblem);
