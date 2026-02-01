import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider, useAuth } from './context/AuthContext';
import { ReviewProvider } from './context/ReviewContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import WelcomePage from "./Screens/WelcomePage";
import WelcomePage2 from "./Screens/WelcomePage2";
import Login from "./Screens/Login";
import Register from "./Screens/Register";
import Home from "./Screens/Home";
import Lists from "./Screens/Lists";
import InformationScreen from "./Screens/InformationScreen";
import Categories from './Screens/Categories';
import ARScreen from './Screens/ARScreen';
import Settings from './Screens/Settings';
import Leaderboard from './Screens/Leaderboard';
import Bookmark from './Screens/Bookmark';
import Reviews from './Screens/Reviews';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b4b45" />
      </View>
    );
  }

  return (
    <ReviewProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={user ? "Home" : "WelcomePage"}>
          {user ? (
            <>
              <Stack.Screen 
                name="Home" 
                component={Home} 
                options={{ headerShown: false, gestureEnabled: false }}
              />
              <Stack.Screen
                name="Leaderboard"
                component={Leaderboard}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="InformationScreen" 
                component={InformationScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Categories"
                component={Categories}
                options={{ headerShown: false}}
              />
              <Stack.Screen 
                name="Bookmark"
                component={Bookmark}
                options={{ headerShown: false}}
              />
            
              <Stack.Screen
                name="ar"
                component={ARScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Settings"
                component={Settings}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Reviews"
                component={Reviews}
                options={{ headerShown: false}}
              />
              <Stack.Screen 
                name="Lists" 
                component={Lists} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Login" 
                component={Login} 
                options={{ headerShown: false }}
              />
            </>
          ) : (
            <>
            <Stack.Screen 
                name="Reviews"
                component={Reviews}
                options={{ headerShown: false}}
              />
            <Stack.Screen
                name="Settings"
                component={Settings}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Lists" 
                component={Lists} 
                options={{ headerShown: false }}
            />
              <Stack.Screen 
                name="WelcomePage" 
                component={WelcomePage} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="WelcomePage2" 
                component={WelcomePage2} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Login" 
                component={Login} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Register" 
                component={Register} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="InformationScreen" 
                component={InformationScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Home" 
                component={Home} 
                options={{ headerShown: false, gestureEnabled: false }}
              />
              <Stack.Screen
                name="ar"
                component={ARScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ReviewProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7cfc9',
  },
});