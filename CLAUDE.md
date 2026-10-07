@AGENTS.md

## Shipping changes

Once a change passes `npx tsc --noEmit`, `npm run lint` and `npm run build`, open a
pull request against `main` and merge it (squash) — the owner doesn't need to be
asked first. The app is hosted on Render (`render.yaml`), which deploys `main`;
if a Render preview or check runs on the pull request, wait for it to succeed
before merging.
