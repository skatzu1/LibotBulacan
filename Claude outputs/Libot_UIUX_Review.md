# Libot UI/UX Review

Scope: general pass over the mobile app (`LibotBulacan`) and the admin panel (`libot-admin-1`), reading the shared theme systems, the auth/onboarding flow, Home, Track, Mission, Profile/Settings/EditProfile, Badges/Leaderboard on mobile, and App/Navbar/Login/Comments/Spots/ModRequests on the admin side.

**Overall**: both codebases share a genuinely well-built design system — a real spacing/radius/typography/shadow token scale, a matched light+dark palette on mobile that was recently mirrored into the admin panel's dark theme, accessible labels, good empty/loading/error states, and custom components (`AppAlert`, `Skeleton`, the ModRequests diff viewer) that go well beyond what most solo/student projects build. The issues below are specific and fixable, not systemic redesign work.

---

## Mobile app (`LibotBulacan`)

### 1. Dark mode breaks on loading screens (High)
`HomeSkeleton.js` hardcodes `backgroundColor: "#fff"` on its wrapping `ScrollView`, and every `<Skeleton>` it renders is called without `baseColor`/`shineColor` props — so it always falls back to `Skeleton.js`'s light-mode defaults (`#D3EEF1` / `#EAF7F9`). In dark mode, opening Home while `useProfileImage()` is still loading shows a bright white full-screen flash with light-cyan shimmer bars, right in the middle of an otherwise consistent dark UI. Worth checking `CategoriesSkeleton.js`, `ListsSkeleton.js`, and `InformationSkeleton.js` for the same pattern — I only opened `HomeSkeleton.js`, but they were built at the same time.

**Fix**: thread `colors` from `useTheme()` into these skeleton screens (background + `baseColor`/`shineColor` on each `<Skeleton>`), the same way the rest of the app does.

### 2. The Track (navigate-to-spot) screen ignores dark mode entirely (High)
`Track.js`'s outer container hardcodes `backgroundColor: "#E8F1F2"`, and the entire Leaflet map — injected as a raw HTML string — hardcodes its own light background, loading-overlay, popup, and tooltip colors (`#E8F1F2`, `#fff`, `#232B2C`, etc.) independent of the app theme. The bottom "terminal" sheet also has a leftover set of hardcoded style values (`sheetName: color:'#1a1a2e'`, `sheetType: '#777'`, `sheetDivider: '#f0f0f0'`, `sheetSectionLabel: '#aaa'`) — these happen to be overridden inline by theme colors everywhere they're used today, so they're not currently visible, but they're dead weight that will bite the next person who touches this file. Since "Navigate" is one of the four home-screen quick actions, a dark-mode user gets a jarring bright screen sandwiched between dark ones every time they use it.

**Fix**: pass `colors.background`, `colors.card`, `colors.textPrimary` etc. into the injected HTML template (the file already does this for `colors.brand`/`colors.accent` on the route line and pins — just extend the same treatment to the base map chrome), and delete the unused hardcoded style values in the sheet styles.

### 3. Inconsistent status bar styling (Medium)
`Mission.js` correctly does `barStyle={isDark ? 'light-content' : 'dark-content'}`, but `Login.js`, `Register.js`, `WelcomePage.js`, `WelcomePage2.js`, and `Track.js` all hardcode `barStyle="dark-content"`. In dark mode, the phone's status bar icons/clock render dark-on-dark on these five screens and become nearly unreadable.

**Fix**: swap the hardcoded value for the same `isDark ? 'light-content' : 'dark-content'` pattern already used elsewhere in the codebase.

### 4. Broken/placeholder legal links (Medium)
`Register.js` still has literal placeholders for the required Terms/Privacy links:
```
const TERMS_OF_SERVICE_URL = "...policyUUID=REPLACE_WITH_YOUR_TOS_UUID";
const PRIVACY_POLICY_URL   = "...policyUUID=REPLACE_WITH_YOUR_PRIVACY_UUID";
```
A new user who taps either link during required sign-up agreement hits a broken Termly page. Separately, `Settings.js` points "Help & Support," "About Us," and "Terms and Policies" at `https://libotbackend.onrender.com/help|about|terms` — the Express API's own domain, which doesn't serve HTML pages and doesn't match the real Termly URLs used elsewhere. These three settings links and the two registration links should point at the same, real, working URLs.

### 5. Dead menu item (Medium)
`ProfileScreen`'s "Deactivate" row is fully styled, tappable, and wired only to `console.log("Deactivate pressed")`. A user who taps it gets no feedback and nothing happens — it reads as broken. Either implement it, hide it until it's ready, or add a lightweight "Coming soon" toast so the tap isn't silently swallowed.

### 6. Notification toggle can go stale (Low)
`Settings.js` reads notification-permission status once on mount (`Notifications.getPermissionsAsync()` in a bare `useEffect`). If the user backgrounds the app to change the permission in OS Settings and returns, the switch keeps showing the old state until the screen is fully remounted. Re-checking on `navigation.addListener("focus", …)` (the same pattern already used in `ProfileScreen`/`BadgeScreen`/`Leaderboard`) would fix it cheaply.

---

## Admin panel (`libot-admin-1`)

### 7. Native `alert()` / `confirm()` used throughout instead of the app's own UI (High)
Every single page file uses raw browser dialogs — **57 occurrences** across `Comments.jsx` (16), `ReportedComments.jsx` (12), `ModRequests.jsx` (8), `SpotForm.jsx` (8), `InactiveUsers.jsx` (6), `BannedAccounts.jsx` (4), and `Spots.jsx` (3). These are unstyled OS popups that clash hard with the fully custom dark theme everywhere else, and they cover nearly every meaningful action in the tool: banning, suspending, deleting comments, deleting spots, approving/rejecting requests, and most error messages.

The nice part is the fix pattern already exists in this codebase: `Spots.jsx`'s "Request deletion" flow was already rebuilt as a themed modal instead of `window.prompt`. The mobile app also already solved exactly this problem with `components/AppAlert.js` — a themed, animated modal/toast system with a simple `showAlert(title, message, buttons)` / `showToast(message)` API. Porting a small equivalent (or a shared `<ConfirmModal>` + toast component) into the admin panel and sweeping the 57 call sites would be the single highest-impact visual-consistency fix available here.

### 8. Nav-link route casing bug (Medium)
`Navbar.jsx` links "All Comments" to `path: '/comments'`, but `App.jsx` registers the route as `<Route path="/Comments" .../>` (capital C). React Router matches paths case-sensitively, so two things happen: clicking the link causes an extra redirect bounce through the catch-all route (which sends admins back to `/Comments`), and — more visibly — the "All Comments" item in the sidebar never shows the active/highlighted state (`location.pathname === item.path` never matches, since one is `/Comments` and the other is `/comments`), even while the admin is looking straight at that page.

**Fix**: make the two strings match — either lowercase the route in `App.jsx` or capitalize the nav link's `path` in `Navbar.jsx`.

### 9. No light mode (Low / worth a decision, not a bug)
The admin panel is permanently dark — `App.css` hardcodes the `body` background, and there's no theme toggle, unlike the mobile app's full light/dark system. That may well be intentional for an internal tool, but it's worth deciding on purpose rather than by omission, especially since the two theme files are already deliberately kept in sync color-for-color.

---

## Suggested order of attack

1. Admin panel: replace `alert()`/`confirm()` app-wide (#7) — biggest single visual win, and the pattern to copy already exists in both codebases.
2. Mobile: fix the Track screen and skeleton screens ignoring dark mode (#1, #2) — most visible breakage for anyone using dark mode, which the app clearly invested a lot in getting right everywhere else.
3. Quick one-liners: status bar styling (#3), the Navbar route casing bug (#8), the dead "Deactivate" row (#5).
4. Content/config cleanup: fix the three broken/placeholder legal links (#4).
5. Small polish: notification toggle refresh (#6).

Happy to implement any of these directly — say which ones and I'll make the changes in your connected folders.
