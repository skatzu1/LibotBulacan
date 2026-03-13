// App.js
import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import 'react-native-reanimated';

import { ReviewProvider } from './context/ReviewContext';
import { AuthProvider } from './context/AuthContext';
import { BookmarkProvider } from './context/BookmarkContext';
import { ArrivalProvider } from './context/ArrivalContext';
import { tokenCache } from './utils/tokenCache';
import { setupClerkInterceptor } from './api';

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
import Mission from './Screens/Mission';
import MissionsScreen from './Screens/MissionsScreen';
import BadgeScreen from './Screens/BadgeScreen';
import PreviousTripsScreen from './Screens/PreviousTripScreen';
import ARSpotSelect from './Screens/ARspotSelect';           // ← NEW
import MissionsSpotSelect from './Screens/MissionsSpotSelect'; // ← NEW
import TrackSpotSelect from './Screens/TrackSpotSelect';       // ← NEW

const CLERK_PUBLISHABLE_KEY = 'pk_test_cHJpbWUtY2hpY2tlbi0yNS5jbGVyay5hY2NvdW50cy5kZXYk';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [hasSeenWelcome, setHasSeenWelcome] = useState(null);

  useEffect(() => {
    if (isLoaded) {
      setupClerkInterceptor(getToken);
    }
  }, [isLoaded, getToken]);

  useEffect(() => {
    const checkWelcome = async () => {
      try {
        const value = await AsyncStorage.getItem("hasSeenWelcome");
        setHasSeenWelcome(value === "true");
      } catch (error) {
        setHasSeenWelcome(false);
      }
    };
    checkWelcome();
  }, [isSignedIn]);

  if (!isLoaded || hasSeenWelcome === null) {
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
          <ArrivalProvider>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                {isSignedIn ? (
                  <>
                    <Stack.Screen name="Home" component={Home} options={{ gestureEnabled: false }} />
                    <Stack.Screen name="Leaderboard" component={Leaderboard} />
                    <Stack.Screen name="InformationScreen" component={InformationScreen} />
                    <Stack.Screen name="Categories" component={Categories} />
                    <Stack.Screen name="Bookmark" component={Bookmark} />
                    <Stack.Screen name="ar" component={ARScreen} />
                    <Stack.Screen name="Settings" component={Settings} />
                    <Stack.Screen name="Reviews" component={Reviews} />
                    <Stack.Screen name="Lists" component={Lists} />
                    <Stack.Screen name="Mission" component={Mission} />
                    <Stack.Screen name="Missions" component={MissionsScreen} />
                    <Stack.Screen name="Track" component={Track} />
                    <Stack.Screen name="Badges" component={BadgeScreen} />
                    <Stack.Screen name="PreviousTrips" component={PreviousTripsScreen} />
                    {/* ── Spot selector screens (one per feature) ── */}
                    <Stack.Screen name="ARSpotSelect" component={ARSpotSelect} />
                    <Stack.Screen name="MissionsSpotSelect" component={MissionsSpotSelect} />
                    <Stack.Screen name="TrackSpotSelect" component={TrackSpotSelect} />
                  </>
                ) : (
                  <>
                    {!hasSeenWelcome && (
                      <>
                        <Stack.Screen name="WelcomePage" component={WelcomePage} />
                        <Stack.Screen name="WelcomePage2" component={WelcomePage2} />
                      </>
                    )}
                    <Stack.Screen name="Login" component={Login} options={{ gestureEnabled: false }} />
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
          </ArrivalProvider>
        </BookmarkProvider>
      </ReviewProvider>
    </AuthProvider>
  );
}

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