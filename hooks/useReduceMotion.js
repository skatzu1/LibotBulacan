import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The phone's Reduce Motion setting, kept current. Looping effects (badge
 * shine, sparkles, the reward moments) stand still while it is on.
 */
export default function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setReduce(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => setReduce(!!v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduce;
}
