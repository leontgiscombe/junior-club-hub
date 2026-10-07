# Drill pack

Drills and a season plan that come built into the hub's drill library. The
hub ships with an **empty pack**: the drill library starts empty for coaches
to fill, and the "Use the season plan" button doesn't show.

To include a pack (only content you have the rights to), export the same two
things from `index.ts`:

- `DRILLS`: the drills (`Drill[]`, see `lib/trainingPlanTypes.ts`).
- `SEASON_PLAN`: `{ title, weeks: [{ topic, drillIds }] }` in week order.

Put each drill's session-plan files in `files/`. Signed-in coaches get them
through `/api/training/files`; they are never public. The app reads the pack
only through `lib/builtInDrills.ts`, and `next.config.ts` includes `files/` in
the deployment.
