"""Guild-mine event implementation (module 0x48): protocol, sinks, routes, report.

Plugged into the shared ws_logger.GameLogger core by the mine_logger.py entry.
Generic game-level machinery (broadcast bus, name services, decode primitives)
lives one level up (game_protocol.py / socket_decode.py / ws_logger.py).
"""
