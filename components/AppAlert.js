import React, {
  createContext, useContext, useState, useRef, useCallback, useEffect,
} from "react";
import {
  View, Text, Pressable, StyleSheet, Animated, Easing, Modal, BackHandler,
} from "react-native";
import { useTheme, spacing, radius, typography, shadow } from "../context/ThemeContext";
import Icon from "./Icon";

/*
 * In-app alert / toast system that replaces the OS `Alert.alert` dialog and any
 * platform toast. The visible UI is 100% themed and drawn by this app — the only
 * primitive used is React Native's cross-platform <Modal transparent> as a
 * portal so the card always stacks above screen-level modals and catches the
 * Android back button. No native dialog / notification chrome is shown.
 *
 * Drop-in usage (same signature as Alert.alert):
 *   import { showAlert, showToast } from "../components/AppAlert";
 *   showAlert("Title", "Message", [{ text: "OK", onPress }]);
 *   showToast("Saved");
 *
 * Hook usage inside components:
 *   const { alert, toast } = useAppAlert();
 */

const AlertContext = createContext(null);

// Module-level handles so non-hook code can trigger the UI (mirrors Alert.alert).
let _alertHandler = null;
let _toastHandler = null;

export function showAlert(title, message, buttons, options) {
  if (_alertHandler) _alertHandler(title, message, buttons, options);
}
export function showToast(message, opts) {
  if (_toastHandler) _toastHandler(message, opts);
}

export function useAppAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAppAlert must be used inside <AppAlertProvider>");
  return ctx;
}

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ data, colors, onDone }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(onDone);
    }, data.duration ?? 2400);
    return () => clearTimeout(t);
  }, [data]);

  const tone = {
    success: { icon: "check-circle", color: colors.success, bg: colors.successBg },
    error:   { icon: "alert-circle", color: colors.danger,  bg: colors.dangerBg },
    info:    { icon: "info",         color: colors.brand,    bg: colors.brandLight },
  }[data.type ?? "info"];

  return (
    <View pointerEvents="box-none" style={styles.toastWrap}>
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
          shadow.lg,
          {
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
          },
        ]}
      >
        <View style={[styles.toastIcon, { backgroundColor: tone.bg }]}>
          <Icon name={tone.icon} size={15} color={tone.color} />
        </View>
        <Text style={[typography.bodyStrong, { color: colors.textPrimary, flex: 1 }]} numberOfLines={2}>
          {data.message}
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Alert card ───────────────────────────────────────────────────────────────
function AlertCard({ data, colors, onClose }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 11 }).start();
  }, []);

  const close = useCallback((btn) => {
    Animated.timing(anim, {
      toValue: 0, duration: 150, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      onClose();
      btn?.onPress?.();
    });
  }, [onClose]);

  const buttons = data.buttons?.length ? data.buttons : [{ text: "OK" }];
  const cancelBtn = buttons.find((b) => b.style === "cancel");
  const stacked = buttons.length > 2;

  // `tone` gives a caller a themed icon without needing `colors`.
  const toneMap = {
    danger:  { icon: "alert-circle",   color: colors.danger,  bg: colors.dangerBg },
    warning: { icon: "alert-triangle", color: colors.warning, bg: colors.warningBg },
    success: { icon: "check-circle",   color: colors.success, bg: colors.successBg },
    info:    { icon: "info",           color: colors.brand,   bg: colors.brandLight },
  };
  const tone      = data.tone ? toneMap[data.tone] : null;
  const iconName  = data.icon ?? tone?.icon;
  const iconColor = data.iconColor ?? tone?.color ?? colors.brand;
  const iconBg    = data.iconBg ?? tone?.bg ?? colors.brandLight;

  const btnStyle = (b, i) => {
    if (b.style === "destructive") {
      return { bg: colors.danger, fg: colors.textInverse, border: "transparent" };
    }
    if (b.style === "cancel") {
      return { bg: "transparent", fg: colors.textSecondary, border: colors.cardBorder };
    }
    // primary / default — the last button gets the accent fill
    const isPrimary = i === buttons.length - 1;
    return isPrimary
      ? { bg: colors.accent, fg: colors.onAccent, border: "transparent" }
      : { bg: colors.brandLight, fg: colors.brandDark, border: "transparent" };
  };

  return (
    <View style={styles.centerWrap}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: anim, backgroundColor: colors.overlay }]}>
        <Pressable
          accessibilityRole="button"
          style={StyleSheet.absoluteFill}
          onPress={() => { if (data.dismissable !== false) close(cancelBtn); }}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.card, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }], opacity: anim },
          shadow.lg,
        ]}
      >
        {!!iconName && (
          <View style={[styles.cardIcon, { backgroundColor: iconBg }]}>
            <Icon name={iconName} size={24} color={iconColor} />
          </View>
        )}
        {!!data.title && (
          <Text style={[typography.h3, styles.cardTitle, { color: colors.textPrimary }]}>{data.title}</Text>
        )}
        {!!data.message && (
          <Text style={[typography.body, styles.cardMessage, { color: colors.textSecondary }]}>{data.message}</Text>
        )}

        <View style={[styles.btnRow, stacked && styles.btnCol]}>
          {buttons.map((b, i) => {
            const s = btnStyle(b, i);
            return (
              <Pressable
                accessibilityRole="button"
                key={i}
                onPress={() => close(b)}
                style={({ pressed }) => [
                  styles.btn,
                  stacked ? styles.btnFull : styles.btnFlex,
                  { backgroundColor: s.bg, borderColor: s.border, borderWidth: s.border === "transparent" ? 0 : 1.5 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[typography.title, { color: s.fg }]}>{b.text ?? "OK"}</Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function AppAlertProvider({ children }) {
  const { colors } = useTheme();
  const [alertData, setAlertData] = useState(null);
  const [toastData, setToastData] = useState(null);

  const alert = useCallback((title, message, buttons, options) => {
    setAlertData({
      title, message: message ?? "",
      buttons: Array.isArray(buttons) ? buttons : undefined,
      dismissable: options?.cancelable,
      tone: options?.tone,
      icon: options?.icon, iconColor: options?.iconColor, iconBg: options?.iconBg,
      key: Date.now(),
    });
  }, []);

  const toast = useCallback((message, opts = {}) => {
    setToastData({ message, type: opts.type, duration: opts.duration, key: Date.now() });
  }, []);

  useEffect(() => {
    _alertHandler = alert;
    _toastHandler = toast;
    return () => { _alertHandler = null; _toastHandler = null; };
  }, [alert, toast]);

  // Android back button closes the alert instead of leaving the screen.
  useEffect(() => {
    if (!alertData) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (alertData.dismissable !== false) setAlertData(null);
      return true;
    });
    return () => sub.remove();
  }, [alertData]);

  return (
    <AlertContext.Provider value={{ alert, toast }}>
      {children}

      {toastData && (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => setToastData(null)}>
          <Toast key={toastData.key} data={toastData} colors={colors} onDone={() => setToastData(null)} />
        </Modal>
      )}

      {alertData && (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => setAlertData(null)}>
          <AlertCard key={alertData.key} data={alertData} colors={colors} onClose={() => setAlertData(null)} />
        </Modal>
      )}
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  backdrop: {},

  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: "center",
  },
  cardIcon: {
    width: 52, height: 52, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  cardTitle: { textAlign: "center", marginBottom: spacing.sm },
  cardMessage: { textAlign: "center", marginBottom: spacing.xl },

  btnRow: { flexDirection: "row", gap: spacing.sm, width: "100%" },
  btnCol: { flexDirection: "column-reverse" },
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  btnFlex: { flex: 1 },
  btnFull: { width: "100%" },

  toastWrap: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: 54, paddingHorizontal: spacing.lg },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: 480,
    width: "100%",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  toastIcon: {
    width: 26, height: 26, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
  },
});
