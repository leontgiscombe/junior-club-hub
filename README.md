# Grassroots Club Hub

A team hub for junior football clubs: one Next.js app on Vercel with an
Upstash Redis database, set up for a club from one settings file.

## What's in it

- **Home** (`/`): the club's banner, crest and teams, with a card for each
  part of the hub.
- **Player Training Hub** (`/training-hub`): the players' own app, with a
  tactical guide and pitch diagrams, a three-level quiz, weekly skill
  challenges and position guides. It's one page, `public/training-hub/index.html`;
  scores and ticks stay on the child's device. The guide's content is written
  for under-10s playing 7v7 in a 2-3-1.
- **Kit Sizes** (`/kit`): parents pick their child from the squad and send
  shirt, shorts and socks sizes; coaches see who's still to send.
- **Results** (`/results`): scores, tables and top scorers for parents
  (`publicResults` turns it off for non-competitive football).
- **Coach Admin** (`/admin`, behind the coach password):
  - **Match Log**: fixtures (synced from FA Full-Time if set up), scores,
    scorers and assists, awards and who played.
  - **Training Log**: each Monday's session and its best trainer.
  - **Player of the Month**: worked out from the awards, with a poster to share.
  - **Training Plans**: each team's weeks of sessions from a shared drill
    library.
  - **Stats Tracker**: season totals, milestones, awards, a presentation-evening
    slideshow and end-of-season archiving.
  - **Camera Register**, **Kit Responses** and **Help** (the user manual).
- **Financial Admin** (`/finance`): each team's subs, payments, parent contacts
  and spending, encrypted in the browser with the team's own password, plus
  monthly reminder notifications.

## Setting it up for a club

1. **Coach Admin → Settings**: the club's name, initials, full name, slogan,
   crest, season, whether results are public, and the teams (with their FA
   Full-Time codes and league opponents, if any). These are saved in the
   database; **`club.config.ts`** holds the defaults a new hub starts with,
   and the storage prefix.
2. **`public/club-crest.png`**: the club's crest, plus the home-screen icons
   `public/hub-icon-180.png` and `hub-icon-512.png`.
3. **`public/kit-generic.jpg`**: a picture of the kit for the Kit Sizes pages.
4. **Environment variables** (see `.env.example`): the Upstash database,
   `ADMIN_KEY` (the Coach Admin password) and, for subs reminders,
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `CRON_SECRET`.
5. **Financial Admin**: each team's password is set the first time, from the
   sign-in screen's "Setting up a team for the first time?" link, with the
   Coach Admin password.

Built-in drills and a season plan are optional and live in `drill-pack/`
(empty by default; see its README).

## Many clubs in one app

Set `ROOT_DOMAIN` (e.g. `grassroots-club-hub.co.uk`) and point it and its wildcard
(`*.grassroots-club-hub.co.uk`) at the deployment:

- **The root domain** is the platform's own site (`app/platform/`): what the
  hub does, **find your club**, and **sign up**, where a club picks its name,
  web address, contact email and coach password.
- **Each club** lives at its own subdomain (`riverside.grassroots-club-hub.co.uk`).
  `proxy.ts` and `lib/tenant.ts` work out the club from the address;
  `lib/kv.ts` stores everything for it under its own key prefix
  (`t:riverside:…`), so clubs never see each other's data. Its coach password
  is kept hashed in the platform's club list (`lib/tenants.ts`).
- **The default club**: without `ROOT_DOMAIN` (or on any other address, like a
  preview), the hub runs a single club with `ADMIN_KEY` as its password and its
  data unprefixed.
- The monthly subs reminders go to every club.

Trying it locally: `ROOT_DOMAIN=localhost:3000 npm run dev`, then open
`http://localhost:3000` (the platform) and `http://<club>.localhost:3000`.

## Hosting on Render

`render.yaml` is a Render Blueprint for the app and its reminder job.

1. **Database:** create an Upstash Redis database (upstash.com), in the EU
   region nearest Render's Frankfurt. Keep its REST URL and token.
2. **Blueprint:** in Render, **New → Blueprint**, pick this repo, and fill in
   the values it asks for:
   - `KV_REST_API_URL`, `KV_REST_API_TOKEN`: from Upstash.
   - `ROOT_DOMAIN`: your domain, e.g. `grassroots-club-hub.co.uk`.
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: for subs reminders (generate a
     pair with `npx web-push generate-vapid-keys`).
   - `TRAINING_PLANS_OWNER_KEY`: optional.
   - On the reminder job, `APP_URL`: the web service's `onrender.com` address.

   `CRON_SECRET` is generated for you and shared with the reminder job.
   Leave `ADMIN_KEY` unset: on a platform every club has its own password.
3. **Domain:** in the web service's **Settings → Custom Domains**, add your
   domain and its wildcard (`*.grassroots-club-hub.co.uk`), and create the DNS records
   Render shows (a wildcard needs an extra record for its certificate). Every
   club's address then works with HTTPS.
4. Open your domain: the platform's site, ready for the first club to sign up.

The plans in `render.yaml` are Starter for the web service (always on: the
free plan sleeps, so the first visit after a quiet spell takes a minute) and
the cron job. Change them in the file or the dashboard.

## Developing

```
npm install
npm run dev
```

Before shipping a change: `npx tsc --noEmit`, `npm run lint` and `npm run build`.
