import './utils/silenceLogs';
import 'react-native-reanimated';
// Must stay among the first imports: it registers the gesture system before
// any screen loads. Imported once, with the one name App.js needs from it.
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { ActivityIndicator, View, Text, StyleSheet, AppState, useColorScheme } from 'react-native';
import { showAlert, AppAlertProvider } from './components/AppAlert';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ReviewProvider }       from './context/ReviewContext';
import { AuthProvider }         from './context/AuthContext';
import { BookmarkProvider }     from './context/BookmarkContext';
import { ArrivalProvider }      from './context/ArrivalContext';
import { tokenCache }           from './utils/tokenCache';
import api, { setupClerkInterceptor, appealAPI, moderationAPI, BASE_URL } from './api';
import { ProfileImageProvider } from "./context/ProfileImageContext";
import { navigationRef }        from './navigation/navigationRef';
import { RewardCelebrationProvider } from './components/RewardCelebration';
import { OwedRewards } from './utils/owedRewards';
import { MissionProvider }      from "./context/MissionContext";
import { PointsProvider }       from "./context/PointsContext";
import { ThemeProvider, useTheme, lightColors, darkColors, MAX_FONT_SCALE } from "./context/ThemeContext";
import OfflineBanner            from "./components/OfflineBanner";
import ErrorBoundary            from "./utils/ErrorBoundary";
import { initCrashReporting }   from "./utils/crashReporter";
import { installFetchTimeout }  from "./utils/fetchTimeout";
import { trackBackendRead }     from "./utils/serverActivity";
import useSystemStatus, { SystemStatusContext } from "./hooks/useSystemStatus";
import { connectLive, disconnectLive, subscribeLive } from "./utils/live";

// Fonts. Every weight is a separate family because React Native does not
// synthesize weights for custom fonts — see the note in ThemeContext.
// Each face comes from its own folder. A package's index requires every face
// it publishes (14 Newsreader + 12 Schibsted files, 2.9 MB), and everything
// required ships inside the iPhone and Android app, used or not; these seven
// are 0.8 MB.
import { Newsreader_600SemiBold }       from "@expo-google-fonts/newsreader/600SemiBold";
import { Newsreader_700Bold }           from "@expo-google-fonts/newsreader/700Bold";
import { Newsreader_800ExtraBold }      from "@expo-google-fonts/newsreader/800ExtraBold";
import { SchibstedGrotesk_400Regular }  from "@expo-google-fonts/schibsted-grotesk/400Regular";
import { SchibstedGrotesk_500Medium }   from "@expo-google-fonts/schibsted-grotesk/500Medium";
import { SchibstedGrotesk_600SemiBold } from "@expo-google-fonts/schibsted-grotesk/600SemiBold";
import { MomoTrustDisplay_400Regular }  from "@expo-google-fonts/momo-trust-display/400Regular";
// Trial faces for Home's greeting name — see NAME_FONT in Screens/Home.js.
import { Raleway_700Bold }  from "@expo-google-fonts/raleway";
import { Epilogue_700Bold } from "@expo-google-fonts/epilogue";
import { Nunito_700Bold }   from "@expo-google-fonts/nunito";
import { Dosis_700Bold }    from "@expo-google-fonts/dosis";
import { useFonts } from "expo-font";

// Screens
import WelcomePage        from "./Screens/WelcomePage";
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
import LocationMission     from './Screens/LocationMission';
import BadgeScreen        from './Screens/BadgeScreen';
import PreviousTripsScreen from './Screens/PreviousTripScreen';
import ARSpotSelect       from './Screens/ARspotSelect';
import MissionsSpotSelect from './Screens/MissionsSpotSelect';
import TrackSpotSelect    from './Screens/TrackSpotSelect';
import EditProfile        from './Screens/EditProfile';
import ProfileScreen      from './Screens/Profilescreen';
import BannedScreen       from './Screens/BannedScreen';
import SuspendedScreen    from './Screens/SuspendedScreen';
import MunicipalityScreen from './Screens/MunicipalityScreen';
import LoginSecurity       from './Screens/LoginSecurity';
import ReportProblem      from './Screens/ReportProblem';
import TravelerProfile    from './Screens/TravelerProfile';
import ReportTraveler     from './Screens/ReportTraveler';

// Clerk publishable keys are public by design — they ship inside the JS bundle
// either way, so they live here rather than in EAS secrets.
// Release builds (preview + production) get the live instance; local dev gets the
// test instance. Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env to override either
// one — e.g. to run a dev build against production while testing Google SSO.
const DEV_CLERK_KEY  = 'pk_test_cHJpbWUtY2hpY2tlbi0yNS5jbGVyay5hY2NvdW50cy5kZXYk'; // prime-chicken-25.clerk.accounts.dev
const PROD_CLERK_KEY = 'pk_live_Y2xlcmsubGlib3RidWxhY2FuLmNvbSQ';                  // clerk.libotbulacan.com
const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? (__DEV__ ? DEV_CLERK_KEY : PROD_CLERK_KEY);

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is set but empty. Unset it to use the built-in default, or give it a valid pk_… key.',
  );
}

const Stack = createNativeStackNavigator();

// Before the app knows who is signed in, Clerk has to reach its server, and on
// a weak signal that takes a while (it retries quietly). The offline banner
// isn't mounted yet, so a bare spinner looked stuck; after a few seconds this
// says why.
const SLOW_START_MS = 6000;

function StartupWait() {
  const { colors, fonts } = useTheme();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_START_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.brand} />
      {slow && (
        <Text
          style={[styles.slowText, { color: colors.textSecondary, fontFamily: fonts.sans }]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLiveRegion="polite"
        >
          Still connecting. On a slow connection this can take a minute.
        </Text>
      )}
    </View>
  );
}

function AppNavigator() {
  const { isLoaded, isSignedIn, getToken, userId, signOut } = useAuth();
  const { colors, isDark } = useTheme();
  // The super admin's update notice, shown on Home (mock defense 2026-10-21).
  // Maintenance never closes the app: it's for the console only.
  const system = useSystemStatus();

  // React Navigation paints its own background behind every screen and during
  // transitions. Left on its default (light) theme, dark mode flashed white
  // between screens; build its theme from the app palette instead.
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.brand,
        background: colors.background,
        card: colors.card,
        text: colors.textPrimary,
        border: colors.divider,
        notification: colors.danger,
      },
    };
  }, [isDark, colors]);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(null);
  const [banInfo,        setBanInfo]        = useState(null);
  const [suspensionInfo, setSuspensionInfo] = useState(null);
  const [isCheckingBan,  setIsCheckingBan]  = useState(true);
  // Tracks whether the signed-in user was archived (banned) on the *previous*
  // status check, so a re-check while the app is already open can tell "was
  // already banned at sign-in" (no popup — BannedScreen just renders) apart
  // from "got banned just now, mid-session" (show the heads-up popup below).
  const wasArchivedRef = useRef(false);
  // The same for a suspension (SuspendedScreen).
  const wasSuspendedRef = useRef(false);
  // An account with no home municipality (made before sign-up asked it) is
  // asked once, by MunicipalityScreen in place of the app.
  const [needsMunicipality, setNeedsMunicipality] = useState(false);

  // IMPORTANT: runs during render, not inside a useEffect. React always fires
  // child effects before parent effects in the same commit, so if this lived
  // in a useEffect here, ReviewProvider's own useEffect (a child) could run
  // its first requests before this parent effect ever executed — sending
  // them with no auth token registered and triggering a 500 from the
  // backend. Calling this in the render body guarantees the token getter is
  // wired up before any child component mounts or fires its effects.
  if (isLoaded) setupClerkInterceptor(getToken);

  // Live updates (utils/live.js), opened again when someone signs in or out:
  // signed in, the server can send this traveler's own suspension or ban.
  useEffect(() => {
    if (!isLoaded) return undefined;
    connectLive({ getToken: isSignedIn ? getToken : null });
    return () => disconnectLive();
  }, [isLoaded, isSignedIn, userId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!(isSignedIn && userId)) {
      setBanInfo(null);
      setSuspensionInfo(null);
      setIsCheckingBan(false);
      wasArchivedRef.current = false;
      wasSuspendedRef.current = false;
      return;
    }

    let cancelled = false;

    // `isRecheck` distinguishes the very first check right after sign-in
    // (where landing straight on BannedScreen is correct — there's nothing
    // "new" to announce) from a later re-check that catches an admin banning
    // the account while this session is already open. For that second case
    // the user asked for it to be *only* a popup — never an automatic screen
    // swap — so a mid-session ban never calls setBanInfo on its own; it only
    // shows an alert, once, and BannedScreen appears solely if the user
    // explicitly taps "Appeal" in it. Tapping "Sign Out" just signs them
    // out; dismissing leaves them where they were (subsequent API calls
    // simply start failing with a "banned" error, same as before this
    // feature existed) and the popup will not repeat.
    const checkStatus = async (isRecheck) => {
      try {
        const [appealData, moderationData] = await Promise.all([
          appealAPI.getMyStatus(),
          moderationAPI.getStatus(),
        ]);
        if (cancelled) return;

        const isArchivedNow = !!appealData.archived;

        if (!isRecheck) {
          // Very first check, right after sign-in — no popup, just render
          // straight to BannedScreen if already banned.
          if (isArchivedNow) setBanInfo(appealData);
        } else if (isArchivedNow && !wasArchivedRef.current) {
          showAlert(
            "You've Been Banned",
            "An admin has banned your account. You can sign out now, or go to the appeal screen.",
            [
              { text: "Sign Out", style: "destructive", onPress: () => signOut() },
              { text: "Appeal", onPress: () => setBanInfo(appealData) },
            ],
            { tone: "danger", icon: "slash", cancelable: false },
          );
        } else if (!isArchivedNow && wasArchivedRef.current) {
          // Unbanned, or the appeal was approved: the app opens again.
          setBanInfo(null);
        }
        wasArchivedRef.current = isArchivedNow;

        // A suspension locks the account until it ends: SuspendedScreen takes
        // the place of the app, and the server refuses the account's requests
        // (the backend's middleware/rejectBanned.js). Suspended at sign-in, or
        // already known: the screen shows. Suspended mid-session: the same
        // one-time popup as a ban first, never a screen swap on its own. Once
        // a check finds it ended, the app opens again.
        const isSuspendedNow = !!moderationData?.isSuspended;
        if (!isSuspendedNow) {
          setSuspensionInfo(null);
        } else if (!isRecheck || wasSuspendedRef.current) {
          setSuspensionInfo(moderationData);
        } else {
          showAlert(
            "Account Suspended",
            `An admin has suspended your account until ${new Date(moderationData.suspendedUntil).toDateString()}. You can't use it until then.`,
            [
              { text: "Sign Out", style: "destructive", onPress: () => signOut() },
              { text: "OK", onPress: () => setSuspensionInfo(moderationData) },
            ],
            { tone: "warning", icon: "pause", cancelable: false },
          );
        }
        wasSuspendedRef.current = isSuspendedNow;
      } catch (error) {
        console.warn("Status check failed:", error);
      } finally {
        if (!cancelled) setIsCheckingBan(false);
      }
    };

    checkStatus(false);

    // Don't hold the whole app on that first check. On a sleeping server it
    // can take a minute, behind a bare spinner. After 5 s the app opens; if the
    // account is banned, BannedScreen takes over when the answer arrives (the
    // first check sets banInfo whenever it lands). A failed check already let
    // the user through — this only stops a slow one from blocking.
    const gate = setTimeout(() => { if (!cancelled) setIsCheckingBan(false); }, 5000);

    // Catch a ban that happens while the app is already open and in use —
    // the one-shot check above only runs at sign-in, so without this a
    // banned-mid-session user would see nothing until they force-quit and
    // reopen the app.
    const interval = setInterval(() => checkStatus(true), 60000);
    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") checkStatus(true);
    });
    // And the moment an admin acts on the account (utils/live.js); the
    // minute's check stays for when the live connection is down.
    const stopLive = subscribeLive(["moderation"], () => checkStatus(true));

    return () => {
      cancelled = true;
      clearTimeout(gate);
      clearInterval(interval);
      appStateSub.remove();
      stopLive();
    };
  }, [isSignedIn, userId]);

  // Once per sign-in. Offline, or no account row yet (a sign-up still being
  // saved): no screen, and the next sign-in asks again.
  useEffect(() => {
    setNeedsMunicipality(false);
    if (!(isSignedIn && userId)) return;
    let cancelled = false;
    api.get('/api/users/me')
      .then(({ data }) => {
        if (!cancelled && data?.user && !data.user.municipality) setNeedsMunicipality(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isSignedIn, userId]);

  if (!isLoaded || hasSeenWelcome === null || isCheckingBan) {
    return <StartupWait />;
  }

  return (
    <SystemStatusContext.Provider value={system}>
    <PointsProvider>
    <MissionProvider>
    <ProfileImageProvider>
      <AuthProvider>
        <ReviewProvider>
          <BookmarkProvider>
            <ErrorBoundary>
              {/* Draws the reward moments (badges, town badges, titles) above
                  every screen, so they carry over a navigation. */}
              <RewardCelebrationProvider>
                {/* Rewards earned away from this phone's own steps (utils/owedRewards.js). */}
                {isSignedIn && !banInfo?.archived && !suspensionInfo?.isSuspended && <OwedRewards key={userId} />}
                <NavigationContainer ref={navigationRef} theme={navTheme}>
                  {isSignedIn && banInfo?.archived ? (
                    <BannedScreen banInfo={banInfo} />
                  ) : isSignedIn && suspensionInfo?.isSuspended ? (
                    <SuspendedScreen suspensionInfo={suspensionInfo} />
                  ) : isSignedIn && needsMunicipality ? (
                    <MunicipalityScreen onDone={() => setNeedsMunicipality(false)} />
                  ) : (
                    <ArrivalProvider>
                      <Stack.Navigator screenOptions={{ headerShown: false }}>
                        {isSignedIn ? (
                          <>
                            <Stack.Screen name="Home"              component={Home}               options={{ gestureEnabled: false }} />
                            {/* Profile used to live inside the Home drawer. The drawer
                                was removed (it duplicated the tabs and quick actions and
                                owned no unique destination), so Profile is a stack screen
                                reached from the Home header avatar. */}
                            <Stack.Screen name="Profile"           component={ProfileScreen} />
                            <Stack.Screen name="Leaderboard"       component={Leaderboard} />
                            <Stack.Screen name="InformationScreen" component={InformationScreen} />
                            <Stack.Screen name="Categories"        component={Categories} />
                            <Stack.Screen name="Bookmark"          component={Bookmark} />
                            <Stack.Screen name="ar"                component={ARScreen} />
                            <Stack.Screen name="Settings"          component={Settings} />
                            <Stack.Screen name="ReportProblem"     component={ReportProblem} />
                            <Stack.Screen name="TravelerProfile"   component={TravelerProfile} />
                            <Stack.Screen name="ReportTraveler"    component={ReportTraveler} />
                            <Stack.Screen name="EditProfile"       component={EditProfile} />
                            <Stack.Screen name="Lists"             component={Lists} />
                            <Stack.Screen name="Mission"           component={Mission} />
                            <Stack.Screen name="LocationMission"   component={LocationMission} />
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
                              <Stack.Screen name="WelcomePage" component={WelcomePage} />
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

                <OfflineBanner />
              </RewardCelebrationProvider>
            </ErrorBoundary>
          </BookmarkProvider>
        </ReviewProvider>
      </AuthProvider>
    </ProfileImageProvider>
    </MissionProvider>
    </PointsProvider>
    </SystemStatusContext.Provider>
  );
}

// Every fetch() gets a time limit, so a dead connection ends in an error and a
// retry instead of a spinner that never stops, and reads from the backend are
// tracked so a slow one can be explained (OfflineBanner). Before React mounts,
// so the first request is covered too. See utils/fetchTimeout.js.
installFetchTimeout(undefined, { onRequest: trackBackendRead(BASE_URL) });

// Initialised at module scope, before React mounts — a crash in the first
// render is exactly the one you most need reported.
initCrashReporting();

export default function App() {
  // Before ThemeProvider exists, follow the system setting — the same default
  // the theme itself starts from — so dark-mode phones don't get a cream flash.
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_600SemiBold, Newsreader_700Bold, Newsreader_800ExtraBold,
    SchibstedGrotesk_400Regular, SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold, MomoTrustDisplay_400Regular,
    Raleway_700Bold, Epilogue_700Bold, Nunito_700Bold, Dosis_700Bold,
  });

  // Hold the tree until the faces are resolved, otherwise the first frame
  // renders in the system font and visibly reflows. `fontError` still lets the
  // app through — a missing font should degrade to the system face, never be a
  // blank screen.
  if (!fontsLoaded && !fontError) {
    return <View style={[styles.loadingContainer, { backgroundColor: (scheme === "dark" ? darkColors : lightColors).background }]} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
          {/* ThemeProvider wraps everything so useTheme() works in AppNavigator */}
          <ThemeProvider>
            <AppAlertProvider>
              <AppNavigator />
            </AppAlertProvider>
          </ThemeProvider>
        </ClerkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slowText: {
    marginTop: 16,
    paddingHorizontal: 40,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});