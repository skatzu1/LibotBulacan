import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import 'react-native-gesture-handler';
import 'react-native-reanimated';



import WelcomePage from "./Screens/WelcomePage";
import WelcomePage2 from "./Screens/WelcomePage2";
import Login from "./Screens/Login";
import Home from "./Screens/Home";
import Lists from "./Screens/Lists";

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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
