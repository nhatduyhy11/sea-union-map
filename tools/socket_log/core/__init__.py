"""Game-generic core: wire-format decode, shared protocol services, the live
logger runner + name service, the runtime codec bridge, and the shared CLI args.

Event packages (mine_socket/, sea_socket/) may import from here; this package
must never import back into an event package.
"""
