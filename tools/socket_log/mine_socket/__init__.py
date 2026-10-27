"""Guild-mine event implementation (module 0x48): protocol, sinks, routes, report.

Entry: logger.py (live mine logger over the shared core.runner.GameLogger).
Generic game-level machinery (broadcast bus, name services, decode primitives)
lives one level up (core/ / browser/ / capture/).

Independence rule: this package must not import sea_socket (and vice versa) —
deleting either subfolder leaves the other fully working.
"""
