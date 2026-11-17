"""Retired legacy run backfill after Sea event-cache migration.

To refresh identity explicitly, run crawler.py with the same login options and
--rebuild-info-cache. Ordinary crawls supplement missing contributor briefs.
"""

if __name__ == "__main__":
    raise SystemExit(
        "Legacy brief_backfill is retired. Use sea_socket/crawler.py with "
        "--rebuild-info-cache to rebuild Sea event info explicitly."
    )
