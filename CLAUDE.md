@AGENTS.md

## Shipping changes

The app is hosted on Render (`render.yaml`), which deploys `main` — anything merged
there is live straight away, including in the App Store app (it loads the live site).

1. Once a change passes `npx tsc --noEmit`, `npm run lint` and `npm run build`, push
   it to a branch, open a pull request against **`main`** and squash-merge it. That
   makes it live; the owner no longer tests changes on a preview first.
2. There's no staging step any more: the `staging` branch isn't used, and Vercel
   doesn't build anything (`vercel.json`, `deploymentEnabled: false`). Don't send the
   owner a Vercel preview link.

### Render builds cost the owner pipeline minutes

Every build of `main` comes out of the owner's monthly Render pipeline minutes, so:

- **Never start a Render deploy by hand** (no `trigger_deploy`, no Manual Deploy).
  Render deploys `main` by itself, but it can take 10 minutes or more to start; a
  deploy started by hand on top of it builds the same commit twice. If one truly
  hasn't started 20 minutes after the merge, tell the owner instead.
- **Batch where it makes sense:** if the owner asks for several small changes in a
  row, put them in one pull request rather than one build each.
- Changes only to `docs/`, `ios-app/`, `vercel.json` or `.md` files don't rebuild
  the live site (`buildFilter` in `render.yaml`).
