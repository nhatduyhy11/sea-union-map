"""Page JS for injecting frames through the game's own WebSocket.

WS_SEND_HOOK_JS captures the game socket instance on its first send;
SEND_FRAME_JS then pushes raw bytes through it (returns false while the socket
isn't captured/open). Used by core.runner.NameFetcher and the sea crawlers.
"""

# Captures the game WebSocket instance so Python can inject frames (NameFetcher).
WS_SEND_HOOK_JS = """() => {
    if (window.__wsLoggerHooked) return;
    window.__wsLoggerHooked = true;
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
        window.__wsLoggerWs = this;
        return send.call(this, data);
    };
}"""

SEND_FRAME_JS = """(bytes) => {
    const ws = window.__wsLoggerWs;
    if (!ws || ws.readyState !== 1) return false;
    ws.send(new Uint8Array(bytes));
    return true;
}"""
