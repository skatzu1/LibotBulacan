import React, { useEffect, useRef, useState } from "react";
import { Animated, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, MAX_FONT_SCALE, TAB_BAR_HEIGHT } from "../context/ThemeContext";
import { oldestReadSince, subscribe } from "../utils/serverActivity";
import { navigationRef } from "../navigation/navigationRef";
import Icon from "./Icon";

const BACK_ONLINE_MS = 2200;

const WAKING_AFTER_MS = 4000;

let NetInfo = null;
try {
  NetInfo = require("@react-native-community/netinfo").default;
} catch (e) {
  if (__DEV__) {
    console.warn("[OfflineBanner] NetInfo native module missing — rebuild the app to enable the offline banner.", e?.message);
  }
}

const isOffline = (state) =>
  state.isConnected === false || state.isInternetReachable === false;

function useServerWaking(afterMs) {
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    let timer;
    const check = () => {
      clearTimeout(timer);
      const since = oldestReadSince();
      if (since === null) return setWaking(false);
      const left = since + afterMs - Date.now();
      if (left <= 0) return setWaking(true);
      setWaking(false);
      timer = setTimeout(check, left);
    };
    const unsubscribe = subscribe(check);
    check();
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [afterMs]);
  return waking;
}

// Whether the floating tab bar (Screens/Home.js) is on screen: the root
// stack's "Home" route is the tab navigator.
const tabsShowing = () => {
  try {
    if (!navigationRef.isReady()) return false;
    const root = navigationRef.getRootState();
    return root?.routes?.[root.index]?.name === "Home";
  } catch {
    return false;
  }
};

function useTabsShowing() {
  const [onTabs, setOnTabs] = useState(tabsShowing);
  useEffect(() => navigationRef.addListener?.("state", () => setOnTabs(tabsShowing())), []);
  return onTabs;
}

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener?.("keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener?.("keyboardDidHide", () => setOpen(false));
    return () => { show?.remove?.(); hide?.remove?.(); };
  }, []);
  return open;
}

/*
 * Offline, back online, or a read that is taking long.
 *
 * At the bottom, just above the tab bar (or the screen's edge), and touches
 * go straight through it (2026-11-10). It used to sit across the top, over
 * every screen's back button and header actions, and caught their taps for as
 * long as a slow read lasted. Only the offline notice's own Retry takes a
 * touch; everything else under the notice works as if it weren't there. It
 * steps aside while the keyboard is up, so it never covers what's typed.
 *
 * Without NetInfo's native side the offline part is off, but the slow-server
 * notice still works.
 */
export default function OfflineBanner() {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [backOnline, setBackOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const wasOffline = useRef(false);
  const slide = useRef(new Animated.Value(0)).current;
  const waking = useServerWaking(WAKING_AFTER_MS);
  const onTabs = useTabsShowing();
  const keyboardOpen = useKeyboardOpen();

  useEffect(() => {
    if (!NetInfo) return undefined;
    let hideTimer;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOffline = isOffline(state);
      setOffline(nowOffline);
      if (!nowOffline && wasOffline.current) {
        setBackOnline(true);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
      }
      if (nowOffline) setBackOnline(false);
      wasOffline.current = nowOffline;
    });
    return () => {
      clearTimeout(hideTimer);
      unsubscribe();
    };
  }, []);

  // Offline says more than "slow", so it wins; so does the brief "Back online".
  const showWaking = waking && !offline && !backOnline;
  const visible = (offline || backOnline || showWaking) && !keyboardOpen;
  // Stays true until the slide-out finishes, then the banner unmounts, so a
  // hidden "Back online" is never left off-screen for a screen reader to find.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, slide]);

  const retry = async () => {
    setChecking(true);
    try {
      const state = await NetInfo.refresh();
      setOffline(isOffline(state));
    } finally {
      setChecking(false);
    }
  };

  // The tab bar's top edge: its bottom padding (Home.js CustomTabBar) + its height.
  const edge = Math.max(insets.bottom, 12);
  const bottom = (onTabs ? edge + 12 + TAB_BAR_HEIGHT : edge) + 8;
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const background = offline ? colors.brandDark : colors.brand;

  if (!mounted && !visible) return null;

  return (
    <Animated.View
      testID="offline-banner"
      pointerEvents="box-none"
      style={[styles.wrap, { bottom, opacity: slide, transform: [{ translateY }] }]}
      accessibilityLiveRegion="polite"
    >
      <View pointerEvents="box-none" style={[styles.bar, { backgroundColor: background }]}>
        {/* The words never take a touch: what's under them still works. */}
        <View pointerEvents="none" style={styles.message}>
          <Icon name={offline ? "wifi-off" : showWaking ? "clock" : "check"} size={16} color={colors.onBrand} />
          <Text
            style={[styles.text, { color: colors.onBrand, fontFamily: fonts.sansMedium }]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityRole="alert"
          >
            {offline
              ? "You're offline. Spots, missions and reviews need a connection."
              : showWaking
                // Can't tell which it is: a weak signal or the free server
                // waking up both look like a read that hasn't answered yet.
                ? "Still loading. A slow connection or a waking server can take up to a minute."
                : "Back online"}
          </Text>
        </View>
        {offline && visible && (
          <Pressable
            onPress={retry}
            disabled={checking}
            accessibilityRole="button"
            accessibilityLabel="Check the connection again"
            hitSlop={8}
            style={({ pressed }) => [
              styles.retry,
              { backgroundColor: colors.accent, opacity: pressed || checking ? 0.7 : 1 },
            ]}
          >
            <Text
              style={[styles.retryText, { color: colors.onAccent, fontFamily: fonts.sansSemi }]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            >
              {checking ? "Checking…" : "Retry"}
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 520,
    borderRadius: 14,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  message: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, paddingVertical: 2, paddingRight: 4 },
  text: { flexShrink: 1, fontSize: 13, lineHeight: 17 },
  retry: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  retryText: { fontSize: 13 },
});
