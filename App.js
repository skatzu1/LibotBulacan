import 'react-native-reanimated';
import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ReviewProvider }       from './context/ReviewContext';
import { AuthProvider }         from './context/AuthContext';
import { BookmarkProvider }     from './context/BookmarkContext';
import { ArrivalProvider }      from './context/ArrivalContext';
import { tokenCache }           from './utils/tokenCache';
import { setupClerkInterceptor, appealAPI, moderationAPI } from './api';
import { ProfileImageProvider } from "./context/ProfileImageContext";
import { navigationRef }        from './navigation/navigationRef';
import { MissionProvider }      from "./context/MissionContext";
import { PointsProvider }       from "./context/PointsContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import ErrorBoundary            from "./utils/ErrorBoundary";

// Screens
import WelcomePage        from "./Screens/WelcomePage";
import WelcomePage2       from "./Screens/WelcomePage2";
import Login              from "./Screens/Login";
import Register           from "./Screens/Register";
import EmailVerification  from "./Screens/EmailVerification";
import Home               from "./Screens/Home";
import Lists              from "./Screens/Lists";
import InformationScreen  from "./Screens/InformationScreen";
import Categories         from './Screens/Categories';
import ARScreen           from './Screens/ARScreen';
import Settings           from './Screens/Settings';
import Leaderboard        from './Screens/Leaderboard';
import Bookmark           from './Screens/Bookmark';
import Track              from './Screens/Track';
import Mission            from './Screens/Mission';
import BadgeScreen        from './Screens/BadgeScreen';
import PreviousTripsScreen from './Screens/PreviousTripScreen';
import ARSpotSelect       from './Screens/ARspotSelect';
import MissionsSpotSelect from './Screens/MissionsSpotSelect';
import TrackSpotSelect    from './Screens/TrackSpotSelect';
import EditProfile        from './Screens/EditProfile';
import BannedScreen       from './Screens/BannedScreen';
import SuspendedNotice    from './Screens/SuspendedNotice';
import LoginSecurity       from './Screens/LoginSecurity';

// Move key to .env: EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
  ?? 'pk_test_cHJpbWUtY2hpY2tlbi0yNS5jbGVyay5hY2NvdW50cy5kZXYk';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { colors } = useTheme();
  const [hasSeenWelcome, setHasSeenWelcome] = useState(null);
  const [banInfo,        setBanInfo]        = useState(null);
  const [suspensionInfo, setSuspensionInfo] = useState(null);
  const [showSuspensionNotice, setShowSuspensionNotice] = useState(false);
  const [isCheckingBan,  setIsCheckingBan]  = useState(true);

  // IMPORTANT: runs during render, not inside a useEffect. React always fires
  // child effects before parent effects in the same commit, so if this lived
  // in a useEffect here, ReviewProvider's own useEffect (a child) could run
  // its first requests before this parent effect ever executed — sending
  // them with no auth token registered and triggering a 500 from the
  // backend. Calling this in the render body guarantees the token getter is
  // wired up before any child component mounts or fires its effects.
  if (isLoaded) setupClerkInterceptor(getToken);

  useEffect(() => {
    const checkWelcome = async () => {
      try {
        const value = await AsyncStorage.getItem("hasSeenWelcome");
        setHasSeenWelcome(value === "true");
      } catch {
        setHasSeenWelcome(false);
      }
    };
    checkWelcome();
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn && userId) {
      const checkStatus = async () => {
        try {
          const [appealData, moderationData] = await Promise.all([
            appealAPI.getMyStatus(),
            moderationAPI.getStatus(),
          ]);
          if (appealData.archived) setBanInfo(appealData);

          if (moderationData?.isSuspended) {
            setSuspensionInfo(moderationData);
            setShowSuspensionNotice(true); // popup once per sign-in/app open, dismissible
          } else {
            setSuspensionInfo(null);
          }
        } catch (error) {
          console.warn("Status check failed:", error);
        } finally {
          setIsCheckingBan(false);
        }
      };
      checkStatus();
    } else {
      setBanInfo(null);
      setSuspensionInfo(null);
      setIsCheckingBan(false);
    }
  }, [isSignedIn, userId]);

  if (!isLoaded || hasSeenWelcome === null || isCheckingBan) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <PointsProvider>
    <MissionProvider>
    <ProfileImageProvider>
      <AuthProvider>
        <ReviewProvider>
          <BookmarkProvider>
            <ErrorBoundary>
              <>
                <NavigationContainer ref={navigationRef}>
                  {isSignedIn && banInfo?.archived ? (
                    <BannedScreen banInfo={banInfo} />
                  ) : (
                    <ArrivalProvider>
                      <Stack.Navigator screenOptions={{ headerShown: false }}>
                        {isSignedIn ? (
                          <>
                            <Stack.Screen name="Home"              component={Home}               options={{ gestureEnabled: false }} />
                            <Stack.Screen name="Leaderboard"       component={Leaderboard} />
                            <Stack.Screen name="InformationScreen" component={InformationScreen} />
                            <Stack.Screen name="Categories"        component={Categories} />
                            <Stack.Screen name="Bookmark"          component={Bookmark} />
                            <Stack.Screen name="ar"                component={ARScreen} />
                            <Stack.Screen name="Settings"          component={Settings} />
                            <Stack.Screen name="EditProfile"       component={EditProfile} />
                            <Stack.Screen name="Lists"             component={Lists} />
                            <Stack.Screen name="Mission"           component={Mission} />
                            <Stack.Screen name="Track"             component={Track} />
                            <Stack.Screen name="Badges"            component={BadgeScreen} />
                            <Stack.Screen name="PreviousTrips"     component={PreviousTripsScreen} />
                            <Stack.Screen name="ARSpotSelect"      component={ARSpotSelect} />
                            <Stack.Screen name="MissionsSpotSelect" component={MissionsSpotSelect} />
                            <Stack.Screen name="TrackSpotSelect"   component={TrackSpotSelect} />
                            <Stack.Screen name="LoginSecurity"     component={LoginSecurity} />
                          </>
                        ) : (
                          <>
                            {!hasSeenWelcome && (
                              <>
                                <Stack.Screen name="WelcomePage"  component={WelcomePage} />
                                <Stack.Screen name="WelcomePage2" component={WelcomePage2} />
                              </>
                            )}
                            <Stack.Screen name="Login"             component={Login}             options={{ gestureEnabled: false }} />
                            <Stack.Screen name="Register"          component={Register} />
                            <Stack.Screen name="EmailVerification" component={EmailVerification} options={{ gestureEnabled: false }} />
                          </>
                        )}
                      </Stack.Navigator>
                    </ArrivalProvider>
                  )}
                </NavigationContainer>

                <SuspendedNotice
                  visible={isSignedIn && !banInfo?.archived && !!suspensionInfo?.isSuspended && showSuspensionNotice}
                  suspensionInfo={suspensionInfo}
                  onDismiss={() => setShowSuspensionNotice(false)}
                />
              </>
            </ErrorBoundary>
          </BookmarkProvider>
        </ReviewProvider>
      </AuthProvider>
    </ProfileImageProvider>
    </MissionProvider>
    </PointsProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
        {/* ThemeProvider wraps everything so useTheme() works in AppNavigator */}
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});