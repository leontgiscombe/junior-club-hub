@AGENTS.md

## Shipping changes

The app is hosted on Render (`render.yaml`), which deploys `main` — anything merged
there is live straight away, including in the App Store app (it loads the live site).
Changes go through `staging` first, so the owner can test them before they're live.

1. Once a change passes `npx tsc --noEmit`, `npm run lint` and `npm run build`, push
   it to a branch and open a pull request against **`staging`** (not `main`). Merging
   into `staging` is fine without asking: nothing there goes live. Squash-merge it.
2. Vercel builds every branch except `main` (`vercel.json`; its production deploys
   are off, Render stays the live host), each on its own database, not the live one.
   `staging` is always at
   https://junior-club-hub-previews-git-staging-leon-giscombe-s-projects.vercel.app —
   give the owner that link so they can try it on their phone.
3. When the owner says to ship it, open a pull request from `staging` into `main`
   and merge it with a **merge commit** (not a squash), so `staging` and `main` keep
   the same history. That makes it live.

If the owner asks for a change to go straight live, it can go to `main` without
staging; afterwards merge `main` back into `staging` so the two don't drift apart.

### Render builds cost the owner pipeline minutes

Every build of `main` comes out of the owner's monthly Render pipeline minutes, so:

- **Never start a Render deploy by hand** (no `trigger_deploy`, no Manual Deploy).
  Render deploys `main` by itself, but it can take 10 minutes or more to start; a
  deploy started by hand on top of it builds the same commit twice. If one truly
  hasn't started 20 minutes after the merge, tell the owner instead.
- **Ship in batches:** let changes collect on `staging` and ship them together when
  the owner says so, rather than one build per small change.
- Changes only to `docs/`, `ios-app/`, `vercel.json` or `.md` files don't rebuild
  the live site (`buildFilter` in `render.yaml`).
