# CLAUDE.md

## Map data

- `src/data/map-coords.ts` is raw coordinate/route data traced from `specs/map-*.PNG`.
  Only open it when the task is about island positions or routes; never edit it
  without re-tracing from the specs. Positions are locked by `src/domain/data.test.ts`.
- `src/data/map-layout.ts` holds the logic (`layoutNodes`, `layoutRoutes`, `mapBounds`)
  built on top of that data — start there for anything else map-related.

## FE/BE boundary

- FE code and comments describe the FE data contract only (`src/types.ts`,
  `SeaLiveDump` fields and their UI meaning). Don't cite BE internals info. That
  knowledge belongs in `docs/sea/SEA_STRUCTURE.md`; FE comments reference the
  dump field name and the in-game UI column it mirrors instead.

## Writing docs, commit messages and code comments

- Never cite gitignored data as evidence or reference: crawl run dirs (`.tmp/...`,
  e.g. `sea-crawl-20261030-122836`), `public/sea-live-dev.json`, local profiles,
  frame dumps. Readers of the repo cannot open them. State the finding itself
  (what was checked, the numbers, a date if useful) instead.
- Avoid commit hashes, quoting commit messages, or "previously / earlier version"
  history narration. Docs and comments describe the current state; history lives
  in git.
