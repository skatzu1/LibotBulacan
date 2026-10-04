# AR and location: how it works, what was improved, what's next

Libot's real-time loop runs entirely on the phone: GPS decides when you
arrive at a spot, the compass points the AR radar, and ARCore tracks the
camera. The network is involved only when something happens (an arrival, a
mission photo). So "real-time performance" here means three things: react
quickly to movement, stay accurate when GPS and compass are noisy, and do it
without draining the battery. Everything below is measured or unit-tested
unless it says otherwise.

## 1. Latency

**Changed**

| Problem | Fix | Effect |
|---|---|---|
| Every compass reading re-rendered the entire AR screen (scene, HUD, all), up to ~20–60 times a second, to rotate one radar widget | The compass lives inside the radar component (`LiveRadar`); state updates only when the heading moves ≥ 1°, at most 30 per second | Compass work no longer touches the AR screen; sensors run only while the radar is visible |
| Mission photos uploaded at full camera resolution (~2800 px, JPEG 100 %, base64) | Resized to 448 px, JPEG 85 % before upload (`utils/missionAI.js`) | 2.7–4.4 MB → 42–98 KB per attempt on 10 real spot photos; model confidence changed by ≤ 4.6 points against an 82 % pass mark, in no consistent direction |
| The arrival GPS watch was torn down and restarted whenever Clerk's token function changed identity | The watcher calls through a ref; it restarts only when the update rate should change | No lost fixes from spurious restarts |

**Already good (kept)**
- AR GPS uses Google's fused provider (GPS + Wi-Fi + cell) and seeds the
  screen from a cached fix so it never waits on a cold satellite lock.
- Rerouting on the map is throttled (≥ 45 m moved and ≥ 15 s apart).
- The spot list is cached for 5 minutes on the phone and 60 s on the server.

**The biggest latency left is the server, not the app.** A free Render instance
sleeps after 15 minutes idle and takes 30–60 s to answer the first request.
Moving to a paid instance removes that; setting `CLERK_JWT_KEY` removes a
network round trip from token checks (see the backend runbook).

**Not applicable here:** edge computing and custom transport protocols. No
sensor stream goes over the network — by design, for privacy — and the few
requests the app makes are small; QUIC or an edge node would save
milliseconds against the seconds of a cold start.

## 2. Sensor accuracy

**GPS.** Every screen that shows or sends a position now filters it the same
way (`utils/gpsFilter.js`): readings worse than ±100 m are dropped, a coarse
network fix never replaces a better GPS one, and a Kalman filter smooths the
jitter while still following real movement (it inflates its own uncertainty
when a reading lands farther away than noise can explain). This was already
on the AR screen; the **Track map** and **location missions** now use it too,
so the map marker stops jumping and the coordinates sent to the server for a
location mission are the steadier estimate.

**Compass.** The OS's fused heading (magnetometer + accelerometer + gyroscope)
is used first, with a tilt-compensated magnetometer fallback. The smoothing is
now a **One Euro filter** adapted to angles (`utils/headingFilter.js`): it
smooths hard while the phone is still and gets out of the way while turning.
Measured on simulated 30 Hz readings with ±5° noise:

| | Old fixed average | One Euro |
|---|---|---|
| Wobble at rest | ~2.9° | ~1.3–1.7° |
| Lag during a 90°/s turn | — | ~4° |
| Settling after a sudden 90° change | — | < 0.5 s |
| Same behaviour at 10 Hz and 60 Hz sensors | no | yes |

When the OS reports the magnetometer as unreliable (Android accuracy 0–1 of
3; iOS error > 25°), the radar label asks the user to move the phone in a
figure 8 — the usual cause of an arrow pointing the wrong way near steel,
concrete or a car.

**Camera / ARCore.** ARCore runs on the phone: it tracks the camera's motion
and finds the floor, and the model stands on the first floor-sized surface it
detects once GPS says you're within the model's radius. Nothing here goes
over the network.

*Removed (2026-10-04): ARCore Geospatial.* It pinned models to their exact
latitude/longitude and steered the radar with the camera's heading, but only
by matching the camera image against Google's online Visual Positioning
Service, with a Google Cloud API key. The project's thesis rules out online
APIs for main features, coverage in Bulacan was patchy, and it had only
started working on 2026-09-30 — before that a wrong tracking-state name made
it always fall back. Placement is now always on the floor, and the radar
always uses the compass (`hooks/useCompassHeading.js`).

## 3. Adaptive update rates

The always-on arrival watch used to run at high accuracy every 3 s / 5 m all
day — even with the nearest spot 20 km away, which is most of the time. It now
follows the distance to the nearest spot (`utils/arrivalEngine.js`):

| Nearest spot | Accuracy | Updates |
|---|---|---|
| within 400 m | high (GPS) | every 3 s or 5 m |
| within 2.5 km | high | every 8 s or 25 m |
| farther | balanced (Wi-Fi/cell) | every 20 s or 150 m |

Moving to a nearer tier switches immediately; moving back out needs 20 % past
the boundary, so hovering at an edge doesn't restart GPS repeatedly. The steps
are sized so an arrival can't be skipped: you can't get from one tier's edge
into a spot's radius without a fix at the faster rate in between (a unit test
checks these relationships). The compass, likewise, now only runs while the
radar is on screen.

## 4. Robustness: bad signal, multipath, no network

**Arrival rules** (`utils/arrivalEngine.js`, unit-tested):
- *Hysteresis:* arrive within 50 m, count as having left only beyond 80 m. GPS
  wander at the edge no longer re-triggers arrivals and their API calls.
- *Accuracy gate:* readings vaguer than ±75 m can't cause an arrival (or,
  beyond ±100 m, a departure).
- *Confirmation:* one precise reading (±20 m) is enough; otherwise two in a
  row. A single reflected-signal jump near buildings is not a visit.

**No signal at the spot.** A first visit used to be marked locally *before* the
server calls; with no signal those calls failed and the points, visit log and
badge were lost for good. Visits now wait in a per-user queue until the server
has answered, and are replayed when the app starts, returns to the
foreground, or gets a location fix (at most every 30 s). Replays are safe
because the server now pays each reward once per user and spot (points,
visit count and mission rewards are atomic, and tested under concurrent
requests).

**Load.** The heavy work (sensor fusion, AR tracking, arrival detection) is on
each phone, so more users add almost no server work per second. The server's
per-user load is a few small requests per arrival plus occasional ~70 KB
mission photos — the photo change cut its biggest cost by ~98 %.

## Next steps, most valuable first

1. **Paid Render instance** — removes the 30–60 s cold start, by far the
   largest delay a user can see.
2. **If background arrivals come back, use OS geofences, not background GPS.**
   `Location.startGeofencingAsync` with one region per spot lets the OS watch
   the 24 spots at almost no battery cost, instead of streaming GPS. It still
   needs Play's background-location declaration.
3. **A real routing service** in place of the OSRM demo server, called through
   the backend so the key stays private (see docs/RELEASE.md).
4. **Speed-aware rates:** use the fix's `speed` to shorten intervals at vehicle
   speeds and lengthen them when stationary for a while.

## Testing on a device

With the app connected to Metro, the log shows what the engine is doing:

- `[Location] Arrival watch: far (20s / 150m)` → `approach` → `near` as you
  travel toward a spot.
- One `[Arrival] Arrived at: …` per visit, even while walking around the
  50 m line.
- Offline arrival: at a spot with airplane mode on, the rewards fail; turn it
  off and within ~30 s `[Rewards] Delivered offline visit: …` appears and the
  points show on the profile.
- AR radar: turn slowly and quickly — the arrow should neither shake at rest
  nor lag a turn. Hold the phone near a laptop or car to see the figure-8 prompt.
- Mission photo: verification should come back in about a second on mobile
  data (plus server wake-up time on the free plan).
