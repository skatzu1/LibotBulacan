import React from 'react'
import { View, Text} from 'react-native'

export default function InformationScreen({ route }) {
  const { spot } = route.params;

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: "#f7cfc9" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>{spot.name}</Text>
      <Image source={{ uri: spot.image }} style={{ width: "100%", height: 200, marginVertical: 10 }} />
      <Text>{spot.description}</Text>
    </View>
  );
}