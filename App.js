import 'react-native-gesture-handler';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import 'react-native-reanimated';



import WelcomePage from "./Screens/WelcomePage";
import WelcomePage2 from "./Screens/WelcomePage2";
import Login from "./Screens/Login";
import Home from "./Screens/Home";
import Lists from "./Screens/Lists";
import InformationScreen from "./Screens/InformationScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="WelcomePage">
        <Stack.Screen name="WelcomePage" 
        component={WelcomePage} 
        options={{headerShown: false}}
        />
        <Stack.Screen name="WelcomePage2" 
        component={WelcomePage2} 
        options={{headerShown: false}}
        />
        <Stack.Screen name="Login" 
        component={Login} 
        options={{headerShown: false}}
        />
        <Stack.Screen name="Home" 
        component={Home} 
        options={{headerShown: false}}
        />
        <Stack.Screen name="Lists" 
        component={Lists} 
        options={{headerShown: false}}
        />
        <Stack.Screen name="InformationScreen" 
        component={InformationScreen} 
        options={{headerShown: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Database //
/* import { useEffect, useState } from "react";
import { View, Text } from "react-native";

export default function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("http://YOUR_LOCAL_IP:3000/api/test")
      .then(res => res.json())
      .then(json => setData(json.message))
      .catch(err => console.error(err));
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>{data || "Loading..."}</Text>
    </View>
  );
} */