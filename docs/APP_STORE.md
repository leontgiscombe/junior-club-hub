# App Store: what's done, and what's left

The iOS app is a Capacitor wrapper around the live site
(https://grassroots-club-hub.co.uk and each club's subdomain). This is the
checklist for building and submitting it.

**The wrapper is built: see `ios-app/README.md` for the step-by-step guide**
(Mac setup, signing, App Store Connect text, screenshots, upload). The site
detects the app by its user agent (`lib/inApp.ts`): inside it, clubs sign up
and their admins subscribe with In-App Purchase, and nothing points to paying
on the website; `/start` is its opening screen.

## Done in the website

- **Apple association file**: served at `/.well-known/apple-app-site-association`
  on the platform's address and every club's (`proxy.ts` rewrites it to
  `app/api/apple-app-site-association`). It lists the app for `webcredentials`
  (passkeys) and `applinks` (links open in the app). Passkeys are made for the
  root domain (`lib/passkeys.ts`), so one entry covers every club.
- **App Review sign-in**: `REVIEW_EMAIL` always gets the fixed 6-digit code
  `REVIEW_CODE`, and no email is sent (`lib/auth.ts` `isReviewAccount`).
- **Account deletion** (guideline 5.1.1(v)): Your Account → Delete Account
  removes the account, its passkeys, sessions, memberships, alerts, Finances
  devices and waiting kit requests; a club's only admin hands it on first.
- **Privacy policy** (`app/privacy`) lists everything the app keeps, including
  medical notes, children's photos, phone numbers, passkeys, and how Finances
  is stored.
- **Sign in with Apple** isn't needed (4.8): the app only has its own accounts
  (email code or passkey).

## To set on Render (the site's environment)

| Variable | What |
| --- | --- |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID (10 characters, in the developer account's Membership page) |
| `IOS_BUNDLE_ID` | The app's bundle ID, e.g. `uk.co.grassrootsclubhub.app` |
| `REVIEW_EMAIL` | App Review's emails, comma-separated: a club admin and a parent, e.g. `appreview@grassroots-club-hub.co.uk,appreview.parent@grassroots-club-hub.co.uk` |
| `REVIEW_CODE` | Any 6 digits; give it to Apple in the Review Notes |

Then make `REVIEW_EMAIL` a club admin of a demo club with some made-up teams,
players, a match and a training session, so the reviewer sees a working hub:

1. In the app (or on the website), **Start a New Club**, e.g. "Demo Juniors",
   with the admin review email; sign in with `REVIEW_CODE`.
2. Platform Admin → the club → **Fill With Demo Data**.
3. Sign in as the parent review email and join the club with its code; approve
   them in the club as the admin.
4. Keep the club **on its free trial** (not Free or paid), so the reviewer sees
   the plans in Settings → Plan. A new club gets 30 days; before each
   submission, Platform Admin → the club → **Trial +30 Days** if it's running
   low. (A club that's Free: **Stop Being Free** starts a 30-day trial.)

## To do in the wrapper project

1. **Capacitor app** (`npx cap init`), with `server.url` set to the platform's
   address. Capacitor's docs say a remote `server.url` isn't meant for
   production; build a small local opening screen (club picker / sign in) that
   then loads the club's address, and show a friendly offline screen instead of
   a blank page.
2. **Navigation**: `server.allowNavigation` = `grassroots-club-hub.co.uk`,
   `*.grassroots-club-hub.co.uk`. Other links (YouTube in the Training Hub,
   `wa.me` WhatsApp reminders, FA Full-Time, ico.org.uk) open in Safari or an
   in-app browser (`@capacitor/browser`).
3. **Associated Domains** entitlement: `webcredentials:grassroots-club-hub.co.uk`
   and `applinks:grassroots-club-hub.co.uk`, `applinks:*.grassroots-club-hub.co.uk`.
   Test Face ID sign-in and opening Finances with it inside the app; the
   passkey PRF used by older Finances devices may not work in a web view (the
   server-kept key and the team password still do).
4. **Native notifications.** Web Push and service workers don't run inside the
   app's web view, so the coaches' join/kit alerts and treasurers' subs
   reminders need APNs:
   - `@capacitor/push-notifications` in the app: ask permission, get the
     device token, and send it to a new endpoint (e.g. `POST /api/push/device`
     with the signed-in account) that stores `{ userId, tenant, token }`.
   - In `lib/notify.ts` (`pushTo`) and the Finances reminder cron, also send to
     those tokens through APNs (an APNs auth key: `.p8`, key ID, team ID), and
     drop tokens APNs says are gone.
   - Hide the web "Notifications" switch when running in the app (Capacitor
     sets `window.Capacitor`), showing the native permission instead.
   - Parents could then get alerts too, e.g. when a kit request is sorted.
5. **Info.plist**: `NSCameraUsageDescription` (QR code scanner, photo
   uploads), `NSPhotoLibraryUsageDescription` (choosing a photo),
   `ITSAppUsesNonExemptEncryption` = NO (only standard HTTPS and the browser's
   built-in encryption; check this is right for you).
6. **App icon and splash** from the platform's icon (not a club's crest).

## In App Store Connect

- **Review Notes**: the review email and code, which demo club to open, and
  that coaches, parents and treasurers see different things.
- **App Privacy**: name, email, phone number, photos, other user content
  (children's names and kit sizes), health (medical notes), user ID, crash data
  (Sentry) — all linked to the user, none used for tracking.
- **Age rating and category**: for parents and coaches (not the Kids category);
  it has user-generated content inside private clubs.
- **Subscriptions**: through In-App Purchase (3.1.1) with RevenueCat, set up
  as in `docs/SUBSCRIPTIONS.md`; clubs that paid on the website are recognised
  in the app (3.1.3(b)). No links to paying on the web inside the UK app.
- **Minimum functionality** (4.2): native notifications, Face ID, the camera
  QR scanner and a proper opening/offline screen are what make it more than a
  website in a frame.
