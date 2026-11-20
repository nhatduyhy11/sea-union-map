# CLAUDE.md

## Commands

- When the user asks which command to run (dev, test, build, crawl, fullcrawl…),
  check `docs/sea/TLDR_DOCS.md` first and answer from it; fall back to `README.BE.md` /
  `README.md` only for what it doesn't cover. That file is a human-first cheat sheet
  of the owner's most-used commands — keep it short, don't grow it into a full
  reference.

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
- Docs point down to code, never the reverse: code comments state the fact itself
  and never cite docs files or sections (`*.md`, `§x.y`). Source assets the code
  is derived from (`specs/map-*.PNG`, golden screenshots) may still be named.

## Beads setup and conventions

Repo-specific notes kept outside the managed Beads block so `bd` updates don't
overwrite them. Keep this section in sync with `AGENTS.md`.

### Setup (per clone)

- Fresh clone / new machine: `bd bootstrap`, then `bd hooks install --beads`. The
  hooks in `.beads/hooks/` are committed, but `core.hooksPath` is per-clone git
  config and `bd bootstrap` does not set it — without this step no beads hook runs.
- Check hooks with `bd hooks list` (expect 5/5 installed). `bd doctor` is not
  supported in embedded mode, so it will not catch missing hooks.
- `.gitattributes` forces LF for every text file (`* text=auto eol=lf`); keep it that
  way, CRLF breaks the sh hooks in `.beads/hooks/`.
- Hide Dolt's marker branch from `git fetch`:
  `git config --add remote.origin.fetch "^refs/heads/__dolt_remote_info__"` (git 2.29+),
  then `git update-ref -d refs/remotes/origin/__dolt_remote_info__` if it was already
  fetched. Dolt's git remote force-pushes this branch (one `DOLT_REMOTE.md`) on every
  `bd dolt push`; nothing reads it, so deleting it on GitHub is harmless but it comes
  back. Never delete `refs/dolt/data` — it holds the issue database.

### Issue sizing

The managed block says to track ALL work in `bd`; in this repo that is scoped as follows:

- Small standalone fix (one commit, nothing left over, no other agent could pick it
  up): no issue needed; the commit message is the record.
- Follow-up to an existing issue (even if already closed): no new issue. Add
  `bd update <id> --append-notes "..."` (reopen only if the work is genuinely
  unfinished) and reference the ID in the commit.
- Multi-session, has dependencies, may be interrupted, or runs in parallel with other
  agents/sessions: create the issue before writing code and `--claim` it.

Run `bd search <keywords>` before `bd create` to avoid duplicates.

### Linking issues and commits

- Put the bead ID at the end of the commit subject, e.g. `feat(map): ... (sea-union-map-zd9)`.
- Close a bead only after the commit carrying its ID exists; uncommitted work stays
  `in_progress` and the handoff proposes the commit.
- Don't write commit SHAs into bead notes/descriptions — history gets rebased, so SHAs
  go stale. Describe the change instead.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session close

Session close protocol comes from `bd prime` (injected at session start).

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
