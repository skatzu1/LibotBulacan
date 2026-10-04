import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, MAX_FONT_SCALE } from "../context/ThemeContext";
import { oldestReadSince, subscribe } from "../utils/serverActivity";
import Icon from "./Icon";

// Libot needs the network for almost everything — spots, missions, reviews,
// points — and without this every screen failed on its own terms (spinners
// that never end, "Failed to load"). One banner across the top says what is
// actually wrong and offers a retry, then briefly confirms when the connection
// comes back. It also says when the server is just slow to answer: the free
// server sleeps when idle, and the first request after that takes 30–60 s.

const BACK_ONLINE_MS = 2200;
// How long a read may wait before the banner explains why.
const WAKING_AFTER_MS = 4000;

// NetInfo is a native module. A binary built before it was added — an older
// dev client, or a store build receiving a JS-only OTA update — doesn't contain
// it, and the library throws the moment it is imported ("NativeModule.RNCNetInfo
// is null"), which took the whole app down with it. Load it defensively: without
// the native side the banner simply doesn't render, and everything else works.
let NetInfo = null;
try {
  NetInfo = require("@react-native-community/netinfo").default;
} catch (e) {
  if (__DEV__) {
    console.warn("[OfflineBanner] NetInfo native module missing — rebuild the app to enable the offline banner.", e?.message);
  }
}

// `isInternetReachable` is null while NetInfo is still checking; treat that as
// online so the banner never flashes on launch.
const isOffline = (state) =>
  state.isConnected === false || state.isInternetReachable === false;

// True while a read from the backend has been waiting longer than `afterMs`.
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

// Without NetInfo's native side the offline part is off, but the slow-server
// notice still works.
export default function OfflineBanner() {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const [backOnline, setBackOnline] = useState(false);
  const [checking, setChecking] = useState(false);
  const wasOffline = useRef(false);
  const slide = useRef(new Animated.Value(0)).current;
  const waking = useServerWaking(WAKING_AFTER_MS);

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
  const visible = offline || backOnline || showWaking;
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

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] });
  const background = offline ? colors.brandDark : colors.brand;

  if (!mounted && !visible) return null;

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[styles.wrap, { paddingTop: insets.top + 6, transform: [{ translateY }] }]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.bar, { backgroundColor: background }]}>
        <Icon name={offline ? "wifi-off" : showWaking ? "clock" : "check"} size={18} color={colors.onBrand} />
        <Text
          style={[styles.text, { color: colors.onBrand, fontFamily: fonts.sansMedium }]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityRole="alert"
        >
          {offline
            ? "You're offline. Spots, missions and reviews need a connection."
            : showWaking
              ? "Waking up the server. The first load can take up to a minute."
              : "Back online"}
        </Text>
        {offline && (
          <Pressable
            onPress={retry}
            disabled={checking}
            accessibilityRole="button"
            accessibilityLabel="Check the connection again"
            hitSlop={10}
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
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { flex: 1, fontSize: 13.5, lineHeight: 18 },
  retry: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { fontSize: 13 },
});
