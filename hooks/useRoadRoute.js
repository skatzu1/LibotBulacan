import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_URL } from "../api";
import { distanceMeters } from "../utils/arrivalEngine";

/*
 * Directions on the app's maps: the road route from the traveler to a place in
 * the system, from the backend's own road router (GET /api/route). The
 * navigation map (Screens/Track.js) asks for a spot, the Nearby Eats map
 * (Screens/LocationMission.js) for the mission's eatery; both draw the answer
 * with utils/routeLine.js.
 *
 *   const { route, info, note, update } = useRoadRoute({ spotId });   // or { missionId }
 *   update(coords)   on every GPS fix: { latitude, longitude, heading? }
 *
 * A route is fetched at most every 15 s, and again only once the traveler has
 * moved ~45 m; in between, the map trims the line as they go. A request that
 * fails (no signal, a busy server) keeps the last route, and the next fix
 * after 15 s tries again.
 *
 *   route  [[lat, lng], …], or null
 *   info   { distance (m), time (s) } of the route, or null
 *   note   said instead of the distance when no road route can be drawn (e.g.
 *          the traveler is outside Bulacan, beyond the roads the server knows)
 */
const NONE = { route: null, info: null, note: null };
const MIN_WAIT_MS = 15000;
const MIN_MOVE_M = 45;

/** Road distance as the maps show it: 80 m · 1.4 km · 31 km. */
export function fmtDistance(m) {
  if (m == null) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m / 10) * 10} m`;
}

/** Travel time: 4 min · 1 hr 5 min. */
export function fmtDuration(s) {
  if (s == null) return "";
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} hr ${mins % 60} min`;
}

export default function useRoadRoute(to) {
  const query = to?.spotId ? `spotId=${to.spotId}` : to?.missionId ? `missionId=${to.missionId}` : null;
  const [state, setState] = useState(NONE);
  const req = useRef({ at: 0, pt: null, busy: false });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // A new destination starts over; an answer still on its way for the old
  // one is dropped (it belongs to the replaced request state).
  useEffect(() => {
    req.current = { at: 0, pt: null, busy: false };
    setState(NONE);
  }, [query]);

  const update = useCallback(async (coords) => {
    if (!query || !coords) return;
    const st = req.current;
    const now = Date.now();
    if (st.busy || now - st.at < MIN_WAIT_MS) return;
    if (st.pt && distanceMeters(st.pt.latitude, st.pt.longitude, coords.latitude, coords.longitude) <= MIN_MOVE_M) return;
    st.busy = true;
    st.at = now;
    try {
      const heading = Number.isFinite(coords.heading) ? `&heading=${Math.round(coords.heading)}` : "";
      const res = await fetch(`${BASE_URL}/api/route?from=${coords.latitude},${coords.longitude}&${query}${heading}`);
      const data = await res.json().catch(() => null);
      if (!mounted.current || req.current !== st) return;
      if (res.ok && data?.coordinates?.length >= 2) {
        st.pt = coords;
        setState({ route: data.coordinates, info: { distance: data.distance, time: data.duration }, note: null });
      } else if (res.status === 422) {
        st.pt = coords;
        setState({ route: null, info: null, note: data?.message || "No road route was found." });
      }
      // Anything else (no signal, a busy server): the route already drawn
      // stays, and the next fix after 15 s tries again.
    } catch {
      // Offline — as above.
    } finally {
      st.busy = false;
    }
  }, [query]);

  return { ...state, update };
}
