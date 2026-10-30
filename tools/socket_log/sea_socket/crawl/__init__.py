"""Online crawl engine: inject requests into the live game socket.

    router.py       CrawlRouter (ssid-correlated inject) + throttle retry
    board_codec.py  decode leaderboard bodies with the game's own runtime
    briefs.py       player-id extraction, player/guild brief fetch

Used by the crawler.py and brief_backfill.py CLIs; report.py (offline) never
imports from here.
"""

# One lock for every tool driving a profile through this engine, so a crawl
# and a backfill never share a browser profile.
LOCK_FILENAME = ".sea_crawler.lock"
