import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import 'react-native-reanimated';

// ✅ Context Providers
import { ReviewProvider } from './context/ReviewContext';
import { AuthProvider } from './context/AuthContext';
import { BookmarkProvider } from './context/BookmarkContext';

import { tokenCache } from './utils/tokenCache';

// Screens
import WelcomePage from "./Screens/WelcomePage";
import WelcomePage2 from "./Screens/WelcomePage2";
import Login from "./Screens/Login";
import Register from "./Screens/Register";
import EmailVerification from "./Screens/EmailVerification";
import Home from "./Screens/Home";
import Lists from "./Screens/Lists";
import InformationScreen from "./Screens/InformationScreen";
import Categories from './Screens/Categories';
import ARScreen from './Screens/ARScreen';
import Settings from './Screens/Settings';
import Leaderboard from './Screens/Leaderboard';
import Bookmark from './Screens/Bookmark';
import Reviews from './Screens/Reviews';
import Track from './Screens/Track';

// 🔑 Clerk Publishable Key
const CLERK_PUBLISHABLE_KEY =
  'pk_test_cHJpbWUtY2hpY2tlbi0yNS5jbGVyay5hY2NvdW50cy5kZXYk';

const Stack = createNativeStackNavigator();

// Navigation Component
function AppNavigator() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b4b45" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <ReviewProvider>
        <BookmarkProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName={isSignedIn ? "Home" : "WelcomePage"}
              screenOptions={{ headerShown: false }}
            >
              {isSignedIn ? (
                <>
                  <Stack.Screen
                    name="Home"
                    component={Home}
                    options={{ gestureEnabled: false }}
                  />
                  <Stack.Screen name="Leaderboard" component={Leaderboard} />
                  <Stack.Screen name="InformationScreen" component={InformationScreen} />
                  <Stack.Screen name="Categories" component={Categories} />
                  <Stack.Screen name="Bookmark" component={Bookmark} />
                  <Stack.Screen name="ar" component={ARScreen} />
                  <Stack.Screen name="Track" component={Track} />
                  <Stack.Screen name="Settings" component={Settings} />
                  <Stack.Screen name="Reviews" component={Reviews} />
                  <Stack.Screen name="Lists" component={Lists} />
                </>
              ) : (
                <>
                  <Stack.Screen name="WelcomePage" component={WelcomePage} />
                  <Stack.Screen name="WelcomePage2" component={WelcomePage2} />
                  <Stack.Screen name="Login" component={Login} />
                  <Stack.Screen name="Register" component={Register} />
                  <Stack.Screen
                    name="EmailVerification"
                    component={EmailVerification}
                    options={{ gestureEnabled: false }}
                  />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </BookmarkProvider>
      </ReviewProvider>
    </AuthProvider>
  );
}

// Root Component
export default function App() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <AppNavigator />
    </ClerkProvider>
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
