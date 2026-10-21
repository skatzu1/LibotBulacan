# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One Expo (React Native) app for Android and iPhone that follows each phone's own conventions where they matter (sheets, back behaviour, share sheet, system pickers). Android is the public release (an APK from libotbulacan.com; Play Store pending); the iPhone build exists for the thesis (EAS, min iOS 15.1). Portrait only.

## Users

**Travelers:** people aged 13 and over who live in Bulacan (the Terms require both): students, families and friend groups visiting their own province's churches, shrines, museums, bridges, rivers and festivals, phone in hand at the spot.

Other audiences, served by separate surfaces in their own repos: **moderators** (one per municipality) propose spot changes and **the admin** approves them and moderates reviews, in the web admin panel (libot-admin-1); anyone can open the website (libotbulacan.com) for the download, legal pages and shared badge pages. The product is also a thesis, evaluated by a defense panel whose notes drive changes.

## Product Purpose

Get people to visit Bulacan's heritage spots in person. Learning the history on site and sending visitors to nearby local eateries matter too, but they serve the visit.

Success is verified visits: travelers arriving at spots, finishing a spot's Bakit List (its badge), finishing whole towns (town badges, titles), and coming back for more.

## Positioning

Being there is what counts, and the server checks it: arrivals, AR, photo scans and Nearby Eats only complete within range of the real place. Each AR model stands at a pinned position at the site and shows a sourced fact about what stands there. Rewards climb from a spot, to a town, to a title across Bulacan's municipalities. The core runs on the project's own infrastructure (its own road routing and its own photo classifier), not outside services.

## Operating Context

- Used outdoors at the spot: bright sun, one hand, moving, often weak or no signal. Arrivals made offline are queued and sent later; the free-tier server can take time to wake.
- Many spots are churches and shrines with Mass times, dress codes and photo rules; the app must not encourage disrespect or entering closed areas.
- Travelers speak Taglish; the app's copy is in English.
- AR needs ARCore (Android) or ARKit-capable iPhones and works within about 120 m of the spot.
- Content is maintained through the admin panel: moderators propose, the admin approves; nothing goes live without approval.

## Capabilities and Constraints

**Capabilities:** sign-up with email or Google (Terms and Privacy read to the end and agreed in-app; middle name optional; home municipality; date of birth checked on the phone only); spot browsing by category and search; spot pages with facts, reviews and photos; road directions; automatic arrival check-ins with nearby alerts; the Bakit List per spot (Arrive, AI Scan, Nearby Eats, AR); AR trail with per-position facts; points; achievements (spot badges, town badges, titles Explorer, Voyager and GOAT Traveler); shareable badge links; a paged leaderboard with the traveler's own standing first; saved spots; previous trips; Report a Problem; light and dark themes.

**Constraints:**
- The thesis forbids main features relying on outside online APIs.
- Accounts are archived, never erased, including on the traveler's own deletion request; earned rewards are never taken away.
- Residents of Bulacan only, 13 and over. The date of birth never leaves the phone.
- Reviews only after a recorded visit, one per spot, 250 characters.
- Spot facts and trivia need real sources, never Wikipedia or its mirrors. Missing facts are hidden, not made up.
- Suspension locks the account until it ends; a ban is closed and appealable for 30 days.
- Not an official government, church or tourism-office app, and must not look like one.

**Terminology:** spot, town (municipality), Bakit List (a spot's things to do), Nearby Eats (the food mission), AI Scan (the photo mission), Arrive, points, badge, town badge, title, Ranking (the leaderboard tab).

**Undecided:** whether finishing a spot pays its badge's displayed +10 points.

## Brand Commitments

- Name: **Libot Bulacan** ("Libot" on the store listing).
- Logo: the yellow rounded square with a white eight-point compass star (assets/logo.svg is the master).
- Voice: plain, honest and specific. Say what happened and what to do next; no hype, no invented claims, nothing that implies official endorsement.
- Free, no ads, nothing to buy.

## Evidence on Hand

- 23 live spots in 7 towns (Malolos 8, Calumpit 5, Plaridel 4, Pulilan 3, Baliwag, Bulakan and Hagonoy 1 each), each with a badge image; 16 have AR set up.
- Sourced AR trivia for the real spots, with citations: `Claude outputs/spot-trivia/` (gitignored).
- Real app screens and walkthrough media on the website (`LibotWeb/libot-download-site/demo-media`).
- Spot photos are mostly low-resolution thumbnails (200–620 px wide).
- No user counts, testimonials, reviews or press to quote: traveler progress was reset on 2026-10-20. Do not fabricate any.

## Product Principles

1. **Being there is the point.** Reward presence at the real place, verified, over anything that can be done from home.
2. **Never invent facts about a place.** Sourced or hidden; a spot's history is someone's heritage.
3. **Built for the spot, not the desk.** Weak signal, sunlight, one hand and a waking server are the normal case, not the edge case.
4. **Earned stays earned.** Progress, badges and records are kept; nothing a traveler achieved is taken back.
5. **Own the core.** The main features run on Libot's own services.

## Accessibility & Inclusion

Every text and background pair passes WCAG AA in both light and dark themes. Reduce Motion stills animations. Screen reader labels on controls; touch targets of at least 44 pt; system font scaling respected (capped only inside fixed-height elements). Users aged 13 and over.
