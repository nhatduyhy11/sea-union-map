"""Player briefs (0x0d/0x001f -> 0x0020) and guild briefs (0x24/0x0035 -> 0x0036).

Player briefs land in router.briefs via CrawlRouter.route(); this module only
decides which ids to ask and in which batches.
"""

import asyncio

from playwright.async_api import Page

from core.protocol import GUILD_BRIEF_CMD, GUILD_MODULE, parse_guild_brief
from sea_socket.crawl.router import REQUEST_PACE, CrawlRouter
from sea_socket.protocol import build_brief_frame

BRIEF_CHUNK = 60  # client batches ~59 ids per request
BRIEF_RETRY_CHUNK = 20  # re-ask size for the post-throttle tail
BRIEF_RETRY_ROUNDS = 3
BRIEF_RETRY_BACKOFF = 4.0  # per-round step: round N waits 4s*N -> 4s, 8s, 12s


def player_ids_from_boards(boards: dict) -> set[str]:
    """Every player rankId in decoded boards (rows + self).

    id_type 1 = player; board 116 rows are factions (id_type 5, ids "1".."4")
    — the brief endpoint refuses those, asking for them is wasted quota.
    """
    ids: set[str] = set()
    for row in boards.values():
        for entry in row.get("rows", []):
            if entry.get("id_type") == 1:
                ids.add(str(entry["player_id"]))
        if row.get("self"):
            ids.add(str(row["self"]["player_id"]))
    return ids


async def ask_briefs(page: Page, router: CrawlRouter, wanted: list[str], chunk: int,
                     pace: float = REQUEST_PACE) -> None:
    """One pass over wanted in chunks; ids already in router.briefs are skipped."""
    for start in range(0, len(wanted), chunk):
        missing = [pid for pid in wanted[start : start + chunk] if pid not in router.briefs]
        if not missing:
            continue
        try:
            await router.send(page, lambda seq, ids=missing: build_brief_frame(seq, ids),
                              f"0d/001f:{len(missing)} ids")
        except RuntimeError as exc:
            print(f"[briefs] {len(missing)} ids: {exc}", flush=True)
        await asyncio.sleep(pace)


async def fetch_player_briefs(page: Page, router: CrawlRouter, wanted: list[str], *,
                              chunk: int = BRIEF_CHUNK,
                              retry_chunk: int = BRIEF_RETRY_CHUNK,
                              rounds: int = BRIEF_RETRY_ROUNDS,
                              backoff: float = BRIEF_RETRY_BACKOFF,
                              pace: float = REQUEST_PACE) -> list[str]:
    """First pass in `chunk`, then up to `rounds` re-asks of the tail; returns ids still missing.

    A throttled batch can come back empty (2026-10-27: one 60-id batch
    answered 0 briefs) — the tail is re-asked in smaller chunks with linear
    backoff. Ids still missing after this are server-refused (cross-server
    group); brief_backfill.py re-asks them in a later session.
    """
    await ask_briefs(page, router, wanted, chunk, pace)
    still = [pid for pid in wanted if pid not in router.briefs]
    for attempt in range(1, rounds + 1):
        if not still:
            break
        wait = backoff * attempt
        print(f"[briefs] retry {attempt}: {len(still)} ids missing — backoff {wait:.0f}s",
              flush=True)
        await asyncio.sleep(wait)
        await ask_briefs(page, router, still, retry_chunk, pace)
        still = [pid for pid in still if pid not in router.briefs]
    return still


async def fetch_guild_briefs(page: Page, router: CrawlRouter, guild_ids: list[int],
                             pace: float = REQUEST_PACE) -> dict[str, dict]:
    """One request per guild; {str(gid): brief} for every guild that answered.

    Gives a name to guilds whose members all refuse cross-server player briefs
    (OLYMPUS & co, 2026-10-27). An answer can still be an empty brief (no name)
    for inactive guilds — callers decide whether to keep those.
    """
    out: dict[str, dict] = {}
    for gid in guild_ids:
        try:
            _h, body = await router.inject(page, GUILD_MODULE, GUILD_BRIEF_CMD, [(1, gid)])
            out[str(gid)] = parse_guild_brief(body)
        except RuntimeError as exc:
            print(f"[guild] {gid}: {exc}", flush=True)
        await asyncio.sleep(pace)
    return out
