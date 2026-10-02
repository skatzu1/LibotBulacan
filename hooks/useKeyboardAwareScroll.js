import { useCallback, useEffect, useRef } from "react";
import { Keyboard, Platform, TextInput } from "react-native";

/*
 * Keeps the field you're typing in above the keyboard, for a form that is a
 * ScrollView inside a KeyboardAvoidingView.
 *
 * The app runs edge-to-edge on Android (app.json edgeToEdgeEnabled), so the
 * window no longer shrinks when the keyboard opens: the KeyboardAvoidingView
 * has to pad for it (KEYBOARD_BEHAVIOR below) — with no behavior on Android,
 * as these forms had, the keyboard simply covered the lower fields, e.g. the
 * date of birth on sign-up. Even with the padding, the field that OPENED the
 * keyboard was scrolled into view before the padding existed, i.e. into the
 * part the keyboard then covers; once the keyboard is up this scrolls it back
 * above it. (Moving focus to another field later is handled by the native
 * ScrollView, which scrolls a newly focused child into its now-shorter frame.)
 *
 * Usage:
 *   const kb = useKeyboardAwareScroll();
 *   <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR}>
 *     <ScrollView ref={kb.ref} onScroll={kb.onScroll} scrollEventThrottle={16}>
 */
export const KEYBOARD_BEHAVIOR = "padding";

// Room left between the field and the keyboard, for the error line under it.
const MARGIN = 28;

export default function useKeyboardAwareScroll() {
  const ref = useRef(null);
  const offset = useRef(0);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    let timer;
    const sub = Keyboard.addListener("keyboardDidShow", (e) => {
      clearTimeout(timer);
      // One beat for the KeyboardAvoidingView to apply its padding, so the
      // ScrollView can scroll as far as the field needs.
      timer = setTimeout(() => {
        const input = TextInput.State.currentlyFocusedInput();
        if (!input?.measureInWindow || !ref.current) return;
        input.measureInWindow((_x, y, _w, h) => {
          const overlap = y + h + MARGIN - e.endCoordinates.screenY;
          if (overlap > 0) ref.current?.scrollTo({ y: offset.current + overlap, animated: true });
        });
      }, 150);
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  const onScroll = useCallback((e) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { ref, onScroll };
}
