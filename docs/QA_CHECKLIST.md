# Pre-release QA on real devices

Automated checks cover logic and compiling. These cover what only a phone can
show. Run them on a **preview** build before each store release; tick them in
the release notes or a copy of this file.

## Devices

At least: one **low-end Android** (2–3 GB RAM, Android 10–11), one **recent
Android** (Android 14+), and one phone **without ARCore** (check
https://developers.google.com/ar/devices). Add an iPhone when iOS is in scope.

## Automated flows (Maestro)

`maestro test .maestro/ -e LIBOT_EMAIL=… -e LIBOT_PASSWORD=…`. See
`.maestro/README.md`. All five should pass.

## Manual checks

**First run and permissions**
- [ ] Fresh install → welcome → sign up with email (municipality is on the sign-up form) → verification code arrives → Home.
- [ ] Sign in with Google.
- [ ] Location prompt: Libot explains first; Android offers only "While using the app" / "Only this time" / "Don't allow". There is **no "Allow all the time"** request anywhere.
- [ ] Deny location: the app still works; spots list, reviews and profile load.
- [ ] Deny camera: missions explain what is needed instead of crashing.
- [ ] Camera prompt (fresh install, Android and iPhone): the phone's own "Allow camera" prompt appears before the photo-mission camera, the profile photo camera, the review photo camera and AR View. "Don't allow" → an explanation with Open Settings, no crash.
- [ ] Sign-up asks first and last name (no middle name), municipality, email, password, then date of birth (typed or from the calendar). Under 13 is refused. "Continue with Google" needs the municipality and date of birth first. In the municipality list, "I don't live in Bulacan" says the app is for residents only and picks nothing.

**Core journeys**
- [ ] Arrive at a spot (or test at the spot's coordinates): arrival alert, +10 points once. Leave and return: no second award.
- [ ] Complete each mission type (photo, location, AR) at one spot.
- [ ] Post, react to, report and delete a review. A muted account cannot post. Before visiting a spot its reviews can be read but the box says "Visit to write a review"; a review is at most 250 characters.
- [ ] Leaderboard, badges, previous trips, bookmarks all load. Equal points show the same rank. Badges and Previous Trips can be searched.
- [ ] Bookmarking or un-bookmarking a spot shows a toast.
- [ ] Directions on the Track screen draw a route.
- [ ] Settings → Privacy / Terms / Help open the web pages. Report a Problem sends from the app (a toast names the account email); About Libot Bulacan is the last row.
- [ ] Profile → Log Out (bottom of the Profile screen).
- [ ] Edit Profile → Save stays on the screen with a "Profile updated" toast. Delete account → one confirmation → signed out; the account is archived (admin panel), not erased.

**Network**
- [ ] Airplane mode: the offline banner appears; Retry keeps it; reconnecting shows "Back online" and it disappears.
- [ ] First launch after the server has been idle (free Render plan): screens wait rather than fail. (Paid plan: no wait.)

**AR**
- [ ] ARCore phone: model places on a surface; trail order is respected. Each model's card reads "The story, part n of N".
- [ ] Away from the spot, AR View doesn't open: only Cancel and Get directions. With location off, or no GPS fix, it doesn't open either: no "Start anyway".
- [ ] Non-ARCore phone: "AR isn't available on this phone" card, with a way back.
- [ ] Radar arrow is steady when still and follows a turn without lag; near a laptop or car the label shows the figure-8 calibration prompt.

**Location engine** (details and log lines: `docs/AR_GEOLOCATION.md`)
- [ ] Log shows the watch tier changing `far` → `approach` → `near` while travelling to a spot.
- [ ] Walking around the edge of a spot's 50 m radius gives one arrival, not several.
- [ ] Arrive with airplane mode on, then turn it off: `[Rewards] Delivered offline visit` within ~30 s and the points appear.
- [ ] Mission photo verification returns in about a second on mobile data.

**Accessibility**
- [ ] TalkBack on: every icon-only button is announced with a name (profile, search, back, bookmark, close). Swipe through Home, a spot page, Settings.
- [ ] Largest system font size: text is readable, no buttons pushed off-screen.
- [ ] Dark mode (system setting): every screen is readable; no white flashes.

**Screens and performance**
- [ ] Small phone (≈ 5.5") and a tablet: no clipped layouts.
- [ ] Low-end phone: Home scrolls smoothly; AR and the map screen open within a few seconds.
  To measure: enable *Profile GPU rendering* in Developer options, or use Android
  Studio → Profiler on the running app. Watch memory on the AR screen; it should
  level off, not keep climbing.
- [ ] Leave the app in the background for 10 minutes, return: it resumes without a crash or a blank screen.

**Release build specifics**
- [ ] App name, icon and splash are correct; version in Settings/about matches app.json.
- [ ] If Sentry is on: trigger a test error in a preview build and see it arrive in Sentry.
