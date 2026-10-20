@AGENTS.md

## Shipping changes

The app is hosted on Render (`render.yaml`), which deploys `main` — anything merged
there is live straight away, including in the App Store app (it loads the live site).

Once a change passes `npx tsc --noEmit`, `npm run lint` and `npm run build`, push it
to a branch and open a pull request against `main`, but **don't merge it until the
owner says so**. Vercel builds a preview of every pull request (`vercel.json`; its
production deploys are off, Render stays the live host) and posts the link on the
pull request: give the owner that link so they can try the change on their phone.
When they say to ship it, squash-merge it. If the owner asks for a change to go
straight live, it can be merged without a preview.
