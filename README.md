# Junior Club Hub

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

1. **`club.config.ts`**: the club's name, initials, full name, slogan, crest,
   season, the teams (with their FA Full-Time codes and league opponents, if
   any) and whether results are public.
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

## Developing

```
npm install
npm run dev
```

Before shipping a change: `npx tsc --noEmit`, `npm run lint` and `npm run build`.
