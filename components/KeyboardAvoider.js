import React, { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, View } from "react-native";

/*
 * A KeyboardAvoidingView that gives the space back when the keyboard closes.
 *
 * React Native's own one (0.81) is wrong on Android in an edge-to-edge app
 * (app.json edgeToEdgeEnabled). It handles keyboardDidHide as a keyboard
 * *change* and measures itself against that event's screenY, which is the
 * height of the window's visible frame: the screen minus the status and
 * navigation bars. The view runs under both bars, so once the keyboard closed
 * it kept that much padding — an empty strip under the last thing on the
 * screen, e.g. below "Don't have an account?" on Login. ("height" behaviour
 * does the same sum and stays that much short.)
 *
 * Here the padding is exactly the part of this view the keyboard covers, and
 * goes back to 0 when it hides. iOS keeps React Native's, which handles
 * keyboardWillHide correctly.
 *
 * Pair it with hooks/useKeyboardAwareScroll when the form is a ScrollView.
 */
function AndroidKeyboardAvoider({ style, children, onLayout, ...props }) {
  const ref = useRef(null);
  const laidOut = useRef(false);
  const [inset, setInset] = useState(0);

  // keyboard.screenY is the keyboard's top edge in window coordinates.
  const avoid = (keyboard) => {
    ref.current?.measureInWindow((_x, y, _w, h) => {
      setInset(Math.max(0, Math.round(y + h - keyboard.screenY)));
    });
  };

  useEffect(() => {
    const subs = [
      Keyboard.addListener("keyboardDidShow", (e) => avoid(e.endCoordinates)),
      Keyboard.addListener("keyboardDidHide", () => setInset(0)),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, []);

  // Mounted with the keyboard already up (Signup tapped mid-typing): no show
  // event is coming, so measure once the view has a frame.
  const handleLayout = (e) => {
    onLayout?.(e);
    if (laidOut.current) return;
    laidOut.current = true;
    const keyboard = Keyboard.isVisible() && Keyboard.metrics();
    if (keyboard) avoid(keyboard);
  };

  return (
    <View ref={ref} style={[style, { paddingBottom: inset }]} onLayout={handleLayout} {...props}>
      {children}
    </View>
  );
}

function IOSKeyboardAvoider(props) {
  return <KeyboardAvoidingView behavior="padding" {...props} />;
}

export default Platform.OS === "ios" ? IOSKeyboardAvoider : AndroidKeyboardAvoider;
