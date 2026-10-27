"""Tranh Bá Tứ Hải (Sea Union) event implementation (module 0x72):
protocol, walkthrough, crawler, report.

Entries: crawler.py (payload-driven crawl), walkthrough.py (GUI POC capture),
report.py (crawl + CampGVG config -> FE JSON). Generic machinery lives one
level up (core/ / browser/ / capture/).

Independence rule: this package must not import mine_socket (and vice versa) —
deleting either subfolder leaves the other fully working.
"""
