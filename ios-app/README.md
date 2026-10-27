# Club Hub for iPhone: getting it on the App Store

The app is a thin iPhone shell (Capacitor) around the live site. It opens on
`https://grassroots-club-hub.co.uk/start` and then goes straight to the club you
last opened. Everything you change on the website shows up in the app at once:
you only rebuild the app to change its icon, name or permissions.

Already set up for you in this folder and on the site:

- App ID `uk.co.grassrootsclubhub.app`, name **Grassroots Club Hub**, iPhone only, portrait.
- The iOS home-screen icon is
  `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
  (1024 × 1024). The launch screen artwork is in
  `ios/App/App/Assets.xcassets/Splash.imageset/`. Changes to either require
  rebuilding the iOS app. The launch screen goes as soon as the site's page has
  loaded (`public/app-feel.js`); `launchShowDuration` in `capacitor.config.json`
  is only the longest it stays, for a slow connection.
- Camera and photo permission messages, and "no special encryption" (no export paperwork).
- Passkeys (Face ID sign-in) and links into the app (`App/App.entitlements`).
- An offline screen with a Try Again button.
- In-App Purchase through RevenueCat (`@revenuecat/purchases-capacitor`): club
  admins subscribe on the Plans page inside the app, and clubs sign up in the
  app too. Nothing in the app points to paying on the website (Apple's rule 3.1.1).
  See `docs/SUBSCRIPTIONS.md`.

---

## 1. Once: set up the Mac (about 30–60 minutes, mostly downloads)

1. Install **Xcode** from the Mac App Store, open it once, and let it install its extra parts.
2. Install **Node.js** (the LTS version) from https://nodejs.org.
3. Open **Terminal** and run these lines one at a time:

```sh
git clone https://github.com/leontgiscombe/junior-club-hub.git
cd junior-club-hub/ios-app
npm install
npx cap sync ios
npx cap open ios
```

Xcode opens the app's project.

## 2. Once: sign it with your developer account

In Xcode:

1. **Xcode → Settings → Accounts** → **+** → Apple ID → sign in with your developer account.
2. In the left sidebar click **App** (the blue icon at the top), then the **App** target,
   then the **Signing & Capabilities** tab.
3. Tick **Automatically manage signing** and pick your **Team**.
   Xcode registers the app ID for you. If it says the bundle identifier is taken,
   change it to something like `uk.co.grassrootsclubhub.clubhub` and tell me, so
   the website matches.
4. You should see **Associated Domains** listed under the capabilities.

**Find your Team ID**: https://developer.apple.com/account → **Membership details** →
**Team ID** (10 letters/numbers).

## 3. Once: tell the website your Team ID

In **Render** → the web service → **Environment**, add:

| Key | Value |
| --- | --- |
| `APPLE_TEAM_ID` | your Team ID, e.g. `AB12CD34EF` |
| `IOS_BUNDLE_ID` | `uk.co.grassrootsclubhub.app` |

Save and let it redeploy. Then check https://grassroots-club-hub.co.uk/.well-known/apple-app-site-association
shows your Team ID. This is what makes Face ID sign-in work inside the app.

## 4. Try it on your iPhone

1. Plug the iPhone into the Mac (trust the computer if asked). On the iPhone:
   **Settings → Privacy & Security → Developer Mode** → on (it restarts).
2. In Xcode's top bar, pick your iPhone as the device, then press **▶ Run**.
3. Check: it opens your club, sign-in works (email code, then Face ID), Finances opens,
   the QR scanner and photo uploads ask for permission, links to YouTube/WhatsApp open
   outside the app, and Airplane Mode shows the "No Connection" screen.

## 5. Create the app in App Store Connect

https://appstoreconnect.apple.com → **Apps** → **+** → **New App**:

- Platform **iOS**, Name **Grassroots Club Hub** (or "Club Hub – Grassroots Football" if taken),
  language **English (UK)**, Bundle ID the one above, SKU `clubhub1`, **Full access**.

Then fill in (copy and paste from below):

- **Subtitle**: `Your junior football club, sorted`
- **Category**: Sports (secondary: Productivity)
- **Privacy Policy URL**: https://grassroots-club-hub.co.uk/privacy
- **Support URL**: https://grassroots-club-hub.co.uk/support
- **Keywords**: `football,grassroots,junior,club,coach,team,training,kit,subs,parents,soccer,youth`
- **Description**:

```
Club Hub keeps a grassroots junior football club in one place, for coaches, parents and players.

Coaches
• Match log: results, scorers, assists and awards
• Training log and weekly training plans with a shared drill library
• Squad, player stats and Player of the Month posters
• Kit sizes and requests from parents

Parents
• Your child's team, fixtures, results and awards
• Send kit sizes and requests in a couple of taps

Treasurers
• Team subs and who owes, with reminders, kept encrypted

Players
• A Training Hub with tactics, quizzes and skill challenges

Your club gives you its code to join. Sign in with your email, then Face ID.
```

- **App Privacy** (the questionnaire): Data collected, all **linked to the user**, **not used for tracking**:
  Contact info (name, email, phone), User content (photos, other content), Health (medical notes
  parents add), Identifiers (user ID), Diagnostics (crash data). Purpose: **App functionality**.
- **Age rating**: answer No to everything (it's private clubs, no open chat); it comes out 4+.
- **Price**: Free. **Availability**: United Kingdom (add more later if you like).

**App Review Information** (in the version page):

- Sign-in required: **yes**. Username `appreview@grassroots-club-hub.co.uk`, password `061945`.
- **Notes**:

```
Club Hub is for members of grassroots football clubs. Sign in with email:
- Club admin/coach: appreview@grassroots-club-hub.co.uk
- Parent: appreview.parent@grassroots-club-hub.co.uk
On the sign-in screen enter the email, then the 6-digit code 061945 (no email is sent for these accounts).
Both open our demo club, which has made-up teams, players, results and training.
Coaches, parents and treasurers see different things. Only a club's admins can subscribe (Settings → Plan), with In-App Purchase; one subscription covers the whole club, and parents, coaches and players never pay.
```

## 6. Screenshots

App Store Connect needs at least 3 iPhone screenshots at **6.9"** (1320 × 2868; iPhone 16/17 Pro Max).
Easiest: in Xcode, Run on the **iPhone 17 Pro Max simulator**, sign in to the demo club, and press
**⌘S** in the Simulator to save a screenshot to the Desktop. Good ones: Home, Match Log,
Training Plans, a player's card, Kit.

## 7. Upload a build and submit

1. In Xcode's top bar pick **Any iOS Device (arm64)**.
2. **Product → Archive**. When the Organizer opens: **Distribute App → App Store Connect → Distribute**.
3. Wait 10–30 minutes for the email saying it has processed. In App Store Connect, on the
   version page, under **Build** click **+** and pick it.
4. **Add for Review → Submit**. Review usually takes 1–3 days.

Next time (a new build): bump **Version** or **Build** in Xcode (App target → General), then Archive again.

## If Apple rejects it

The usual one for an app like this is **4.2 Minimum Functionality** ("just a website").
The reply: it uses Face ID passkeys, the camera QR scanner and an offline screen, and
it's for private club members. If they insist, the next step is native push
notifications (`docs/APP_STORE.md`, step 4), which we can add.
