# CLAUDE.md

## Map data

- `src/data/map-coords.ts` is raw coordinate/route data traced from `specs/map-*.PNG`.
  Only open it when the task is about island positions or routes; never edit it
  without re-tracing from the specs. Positions are locked by `src/domain/data.test.ts`.
- `src/data/map-layout.ts` holds the logic (`layoutNodes`, `layoutRoutes`, `mapBounds`)
  built on top of that data — start there for anything else map-related.
