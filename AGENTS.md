# Agent Instructions

## Project rules

Keep this section in sync with `CLAUDE.md`.

### Commands

- When the user asks which command to run (dev, test, build, crawl, fullcrawl…),
  check `docs/sea/TLDR_DOCS.md` first and answer from it; fall back to `README.BE.md` /
  `README.md` only for what it doesn't cover. That file is a human-first cheat sheet
  of the owner's most-used commands — keep it short, don't grow it into a full
  reference.

### Map data

- `src/data/map-coords.ts` is raw coordinate/route data traced from `specs/map-*.PNG`.
  Only open it when the task is about island positions or routes; never edit it
  without re-tracing from the specs. Positions are locked by `src/domain/data.test.ts`.
- `src/data/map-layout.ts` holds the logic (`layoutNodes`, `layoutRoutes`, `mapBounds`)
  built on top of that data — start there for anything else map-related.

### FE/BE boundary

- FE code and comments describe the FE data contract only (`src/types.ts`,
  `SeaLiveDump` fields and their UI meaning). Don't cite BE internals info. That
  knowledge belongs in `docs/sea/SEA_STRUCTURE.md`; FE comments reference the
  dump field name and the in-game UI column it mirrors instead.

### Writing docs, commit messages and code comments

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
overwrite them. Keep this section in sync with `CLAUDE.md`.

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

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

```bash
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

Other commands that may prompt: `scp`/`ssh` → `-o BatchMode=yes`; `apt-get` → `-y`;
`brew` → `HOMEBREW_NO_AUTO_UPDATE=1`.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:46cd31e7 -->
## Beads: git policy and session close

Quick reference, task-tracking rules and the Dolt sync model are in the Codex block
below and in `bd prime`.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

Session close:

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Git/sync** - Conservative: run `git status`, report, wait for approval. If a required sync or push is blocked, report the exact command and error.
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->

<!-- bv-agent-instructions-v7 -->

## bv triage sidecar

This repo uses the Go `bd` CLI (not `br`). [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) (`bv`) gives graph-aware triage over `.beads/issues.jsonl`; `bv` decides *what to work on*, `bd` creates/claims/closes.

**CRITICAL: Use ONLY --robot-* flags. Bare bv launches an interactive TUI that blocks your session.**

```bash
bv --robot-triage        # Start here: top picks, quick wins, blockers, health, next commands
bv --robot-next          # Just the single top pick + claim command
bv --robot-plan          # Parallel execution tracks with unblocks lists
bv --robot-insights      # PageRank, betweenness, critical path, cycles…
bv --robot-alerts        # Stale issues, blocking cascades, priority mismatches
bv --robot-suggest       # Duplicates, missing deps, label suggestions, cycle breaks
bv --robot-diff --diff-since <ref>   # New/closed/modified issues since ref
bv --robot-graph [--graph-format=json|dot|mermaid]
bv --recipe actionable --robot-plan  # Scope: only unblocked work (also --label <x>, --as-of <ref>)
```

Recommendations are a snapshot: check `bd show <id>` before claiming. After Beads
mutations, refresh the export bv reads: `bd export -o .beads/issues.jsonl`.

<!-- end-bv-agent-instructions -->
