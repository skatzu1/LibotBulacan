import React, { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, View } from "react-native";

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
