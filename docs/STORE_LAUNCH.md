# Store launch checklist

Everything Google Play (and later the App Store) asks for, with the answers
that match what the app actually does. Where the answer depends on a choice,
it says so.

Links you will paste repeatedly:

- Privacy policy: `https://libotbackend.onrender.com/privacy`
- Account deletion: `https://libotbackend.onrender.com/delete-account`
- Support email: `support@libotbulacan.com` (must be a real inbox you read)

## Google Play

### 1. Before you can publish: closed testing

New **personal** developer accounts must run a closed test with **at least 12
testers who stay opted in for 14 days in a row** before Play grants production
access. Start this first; everything else can happen during the 14 days.

1. Play Console → Create app → name "Libot", app, free.
2. Test and release → Testing → Closed testing → create a track, upload the
   production `.aab`, add testers (an email list or a Google Group), and share
   the opt-in link.
3. Ask testers to keep it installed and actually use it. After 14 days, apply
   for production access (Dashboard) and describe what testers found.

### 2. App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | The privacy policy link above. |
| App access | "All or some functionality is restricted." Give reviewers a working test account (email and password) and say: *arrival, missions and AR need you to be at a tourist spot in Bulacan; the rest of the app works anywhere.* |
| Ads | No ads. |
| Content rating | Category **Travel**. Users can post public reviews: **yes**. Moderation and reporting exist. No user-to-user location sharing, no purchases, no gambling or violence. |
| Target audience | **13 and over** (matches the privacy policy and terms). Do not include under-13 ages, or Play's Families policy applies. |
| News app / Health / Financial features / Government app | No / none / none / **No**. Libot is not an official government app; avoid wording in the listing that suggests it is. |
| Data safety | See the table below. |
| Account deletion | There is **no** delete option in the app. Users request deletion by email, as the deletion link above explains. Google Play's policy expects a way to request deletion from inside the app as well, so this answer may be questioned in review. |
| Sensitive permissions | None to declare. The build no longer requests background location. |

### 3. Data safety answers

"Collected" means the data leaves the phone. Arrival at a spot is worked out
on the phone, but precise location does leave it in two cases: completing a
**location mission** sends the current coordinates to Libot's server, which
checks the distance and discards them (they are not stored or logged), and
**directions** send position and destination to the routing service.

| Data type | Collected | Shared | Required? | Purpose | Notes |
|---|---|---|---|---|---|
| Name | Yes | No | Required | Account management, App functionality | Shown on reviews and the leaderboard |
| Email address | Yes | No | Required | Account management | Via Clerk |
| User IDs | Yes | No | Required | Account management | Clerk account ID |
| Precise location | Yes | No * | Optional | App functionality | Sent when completing a location mission (distance check, not stored) and when asking for directions; processed ephemerally |
| Photos | Yes | No | Optional | App functionality | Mission photos are checked and discarded (ephemeral); profile photos are stored |
| App interactions | Yes | No | Required | App functionality | Visits, missions, points, badges, bookmarks |
| Other user-generated content | Yes | No | Optional | App functionality | Reviews and ratings |
| Crash logs, Diagnostics | Yes, **only if** Sentry is turned on | No | Required | Analytics | Leave out while `EXPO_PUBLIC_SENTRY_DSN` is unset |

\* The routing service computes the route on the app's behalf, which Play
treats as a service provider rather than "sharing". If you prefer the cautious
answer, mark precise location as shared.

Security practices: data is **encrypted in transit** (yes); users **can request
deletion** (yes, with the deletion link).

Your privacy policy uses broader wording than this table (it mentions
analytics and marketing that the app does not currently do). That is allowed.
The reverse would not be: never collect anything the table leaves out.

### 4. Store listing

- App name: Libot (up to 30 characters). Short description: up to 80
  characters. Full description: up to 4000.
- App icon 512 × 512 PNG; feature graphic 1024 × 500; at least 2 phone
  screenshots (up to 8). Use real screens: Home, a spot page, a mission, the
  leaderboard, AR.
- Category: **Travel & Local**. Contact email: the support address.
- Spot photos in the listing must be yours or licensed. The same applies to
  in-app spot images from other sources.

### 5. Production release

Create the release on the production track with the same `.aab`, write release
notes, and roll out, starting at 20 % if you want a safety margin. The first
review can take several days.

## Apple App Store (when you are ready for iOS)

- **Sign in with Apple is likely required.** The app offers Google sign-in, and
  App Store guideline 4.8 then expects an equivalent privacy-focused option.
  Clerk supports Apple sign-in; add it before submitting to Apple.
- In-app account deletion: **removed on purpose**. Guideline 5.1.1(v) requires
  it for apps with sign-up, so it has to come back before an iOS submission.
  Location only "While Using": done.
- App Privacy ("nutrition label"): same facts as the Data safety table.
- Build with `npx eas-cli build -p ios --profile production`, test through
  TestFlight, then submit for review with the same test account.
