import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { BASE_URL } from "../api";
import { fetchSystemStatus } from "../utils/systemStatus";

/*
 * The latest update notice from the super admin (mock defense 2026-10-21),
 * which Home shows (components/UpdateNotice.js). There is no maintenance for
 * travelers (user rule 2026-10-23): the app never closes for it.
 *
 * Asked at launch, every minute, and when the app comes back to the front. The
 * app doesn't wait for it, and a failed check keeps what it had.
 */
const EVERY_MS = 60_000;

// App.js asks once and shares the answer, so Home's notice doesn't poll again.
export const SystemStatusContext = createContext({ notice: null });
export const useSystemNotice = () => useContext(SystemStatusContext).notice;

export default function useSystemStatus({ fetchStatus = fetchSystemStatus } = {}) {
  const [status, setStatus] = useState({ notice: null });
  const live = useRef(true);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const next = await fetchStatus(BASE_URL);
      if (next && live.current) setStatus(next);
    } finally {
      busy.current = false;
    }
  }, [fetchStatus]);

  useEffect(() => {
    live.current = true;
    check();
    const timer = setInterval(check, EVERY_MS);
    const sub = AppState.addEventListener("change", (next) => { if (next === "active") check(); });
    return () => {
      live.current = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [check]);

  return { ...status, recheck: check };
}
