"""Tranh Bá Tứ Hải (Sea Union) event implementation (module 0x72):
protocol, walkthrough, crawler, report.

Entries (CLI, run by path): crawler.py (payload-driven crawl),
brief_backfill.py (re-ask missing briefs of a run), walkthrough.py (GUI POC
capture), report.py (crawl + CampGVG config -> FE JSON, offline).
crawl/ is the online engine behind crawler + backfill (router, board codec,
briefs, phases); protocol.py holds the event's frame builders/parsers.
Generic machinery lives one level up (core/ / browser/ / capture/).

Independence rule: this package must not import mine_socket (and vice versa) —
deleting either subfolder leaves the other fully working.
"""
