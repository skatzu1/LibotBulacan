import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";

export default function InformationScreen({ route, navigation }) {
  const { spot } = route.params;

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: "#f7cfc9" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>
        {spot.name}
      </Text>

      <Image
        source={{ uri: spot.image }}
        style={{ width: "100%", height: 200, marginVertical: 10 }}
      />

      <Text>{spot.description}</Text>

      {/* AR BUTTON */}
      <TouchableOpacity
        style={{
          marginTop: 20,
          backgroundColor: "#000",
          padding: 15,
          borderRadius: 10,
          alignItems: "center"
        }}
        onPress={() => navigation.navigate("ar", { spot })}
      >
        <Text style={{ color: "#fff", fontWeight: "bold" }}>
          AR
        </Text>
      </TouchableOpacity>
    </View>
  );
}
