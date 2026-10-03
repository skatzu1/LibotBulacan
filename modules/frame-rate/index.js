import { useEffect } from "react";
import { requireOptionalNativeModule } from "expo";

// Native side: android/…/FrameRateModule.kt. Optional so an over-the-air JS
// update running on an older APK (built before this module existed) just
// skips the request instead of crashing.
const FrameRate = requireOptionalNativeModule("FrameRate");

// Every screen currently asking, by id → Hz. The lowest wins, and the request
// is cleared once nobody is asking.
const requests = new Map();
let nextId = 1;

function apply() {
  const hz = requests.size ? Math.min(...requests.values()) : 0;
  FrameRate?.setPreferredFrameRate(hz).catch(() => {});
}

// Holds the display at `hz` while the calling component is mounted and
// `active` is true.
export function usePreferredFrameRate(hz, active = true) {
  useEffect(() => {
    if (!active || !FrameRate) return undefined;
    const id = nextId++;
    requests.set(id, hz);
    apply();
    return () => {
      requests.delete(id);
      apply();
    };
  }, [hz, active]);
}
