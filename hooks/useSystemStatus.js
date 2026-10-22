import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { BASE_URL } from "../api";
import { fetchSystemStatus, onMaintenanceHint } from "../utils/systemStatus";

/*
 * Whether the system is under maintenance, and the latest update notice
 * (mock defense 2026-10-21). App.js shows Screens/MaintenanceScreen.js in
 * place of the whole app while maintenance is on, signed in or not, and Home
 * shows the notice.
 *
 * Asked at launch, every minute, when the app comes back to the front, and
 * straight away when a request gets a 503 (utils/systemStatus.js). The launch
 * check waits at most START_WAIT_MS before the app opens anyway, like the
 * account check in App.js: a sleeping server must not hold the app on a
 * spinner, and a failed check never shuts anyone out.
 */
export const START_WAIT_MS = 5000;
const EVERY_MS = 60_000;

// App.js asks once and shares the answer, so Home's notice doesn't poll again.
export const SystemStatusContext = createContext({ maintenance: { on: false }, notice: null });
export const useSystemNotice = () => useContext(SystemStatusContext).notice;

export default function useSystemStatus({ fetchStatus = fetchSystemStatus } = {}) {
  const [status, setStatus] = useState({ maintenance: { on: false }, notice: null });
  const [ready, setReady] = useState(false);
  const live = useRef(true);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const next = await fetchStatus(BASE_URL);
      // Unreadable: keep what we had (a blip doesn't open or close the app).
      if (next && live.current) setStatus(next);
    } finally {
      busy.current = false;
      if (live.current) setReady(true);
    }
  }, [fetchStatus]);

  useEffect(() => {
    live.current = true;
    check();
    const gate = setTimeout(() => { if (live.current) setReady(true); }, START_WAIT_MS);
    const timer = setInterval(check, EVERY_MS);
    const sub = AppState.addEventListener("change", (next) => { if (next === "active") check(); });
    const off = onMaintenanceHint(check);
    return () => {
      live.current = false;
      clearTimeout(gate);
      clearInterval(timer);
      sub.remove();
      off();
    };
  }, [check]);

  return { ...status, ready, recheck: check };
}
