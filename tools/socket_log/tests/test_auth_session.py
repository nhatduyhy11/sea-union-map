"""Synthetic Chrome integration tests; no live SDK, credentials or game traffic.

uv run python -m unittest discover -s tools/socket_log/tests -v
"""

import asyncio
import base64
import copy
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from browser.auth import SelectedAuth, select_account, verify_game_account
from browser.session import open_game_session
from browser.ws_inject import SEND_FRAME_JS

GAME_URL = "https://hauntedroomvnh5.joynetgame.com/"
ACCOUNTS = ("a@example.invalid", "b@example.invalid")
SOURCE = {
    "sdk_allLoginList": {"value": {
        email: {"username": email, "access_token": "synthetic"} for email in ACCOUNTS
    }},
    "sdk_userLoginData": {"value": "replace"},
    "unrelated": {"value": "keep"},
}
GAME_HTML = """<!doctype html>
<iframe src="https://h5sdk.joynetgame.com/frame"></iframe>
<script>
const ws = new WebSocket('SOCKET_URL');
ws.onopen = () => ws.send(new Uint8Array([1,2,3]));
</script>"""


class AuthSelectionTests(unittest.TestCase):
    def test_only_selected_value_changes(self):
        original = copy.deepcopy(SOURCE)
        selected, key = select_account(SOURCE, ACCOUNTS[1])
        expected = copy.deepcopy(SOURCE)
        expected[key]["value"] = SOURCE["sdk_allLoginList"]["value"][ACCOUNTS[1]]
        self.assertEqual(selected, expected)
        selected[key]["value"]["access_token"] = "changed"
        self.assertEqual(SOURCE, original)

    def test_missing_account_rejected(self):
        with self.assertRaisesRegex(ValueError, "absent"):
            select_account(SOURCE, "missing@example.invalid")


class SessionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.driver = await async_playwright().start()
        self.browsers = []
        self.peers = set()

        async def echo(reader, writer):
            self.peers.add(writer)
            try:
                headers = (await reader.readuntil(b"\r\n\r\n")).decode()
                key = next(line.split(":", 1)[1].strip() for line in headers.splitlines()
                           if line.lower().startswith("sec-websocket-key:"))
                accept = base64.b64encode(hashlib.sha1(
                    (key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode(),
                    usedforsecurity=False,
                ).digest()).decode()
                writer.write(("HTTP/1.1 101 Switching Protocols\r\n"
                              "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                              f"Sec-WebSocket-Accept: {accept}\r\n\r\n").encode())
                await writer.drain()
                while True:
                    opcode, size = await reader.readexactly(2)
                    length = size & 127
                    if length >= 126:
                        raise ValueError("Synthetic test only sends short WS frames")
                    mask = await reader.readexactly(4) if size & 128 else b""
                    body = await reader.readexactly(length)
                    if mask:
                        body = bytes(value ^ mask[i % 4] for i, value in enumerate(body))
                    writer.write(bytes([opcode, length]) + body)
                    await writer.drain()
                    if opcode & 15 == 8:
                        break
            except (asyncio.IncompleteReadError, ConnectionError):
                pass
            finally:
                writer.close()
                self.peers.discard(writer)

        self.server = await asyncio.start_server(echo, "127.0.0.1", 0)
        port = self.server.sockets[0].getsockname()[1]
        game_html = GAME_HTML.replace("SOCKET_URL", f"ws://127.0.0.1:{port}/socket")

        async def install_routes(context):
            await context.grant_permissions(["local-network-access"])
            async def route(request_route):
                body = (game_html if request_route.request.url == GAME_URL
                        else "<!doctype html><title>SDK synthetic</title>")
                await request_route.fulfill(status=200, content_type="text/html", body=body)

            await context.route("https://**/*", route)

        async def launch(**options):
            browser = await self.driver.chromium.launch(**options)
            self.browsers.append(browser)
            create_context = browser.new_context

            async def new_context(**context_options):
                context = await create_context(**context_options)
                await install_routes(context)
                return context

            browser.new_context = new_context
            return browser

        async def launch_persistent_context(**options):
            context = await self.driver.chromium.launch_persistent_context(**options)
            await install_routes(context)
            return context

        self.playwright = SimpleNamespace(chromium=SimpleNamespace(
            launch=launch, launch_persistent_context=launch_persistent_context,
        ))

    async def asyncTearDown(self):
        for browser in self.browsers:
            await browser.close()
        self.server.close()
        await self.server.wait_closed()
        for writer in list(self.peers):
            writer.close()
        await self.driver.stop()

    async def exercise(self, email, fail=False):
        data, key = select_account(SOURCE, email)
        auth = SelectedAuth(data, key, email)
        seen = []

        def on_page(page):
            page.on("websocket", lambda ws: ws.on("framereceived", lambda msg: seen.append(msg)))

        async with open_game_session(
            self.playwright, profile=None, auth=auth, url=GAME_URL,
            on_page=on_page, headless=True,
        ) as page:
            await page.wait_for_function("window.__wsLoggerWs?.readyState === 1", timeout=5000)
            await page.wait_for_selector("iframe")
            await verify_game_account(page, auth)
            self.assertEqual(len(page.context.pages), 1, "Auth tab must be closed")
            self.assertTrue(await page.evaluate(SEND_FRAME_JS, [7, 8, 9]))
            for _ in range(50):
                if b"\x07\x08\x09" in seen:
                    break
                await asyncio.sleep(.02)
            self.assertIn(b"\x07\x08\x09", seen)
            self.assertEqual(seen.count(b"\x07\x08\x09"), 1, "Listener attached twice")
            if fail:
                raise RuntimeError("Synthetic crawl failure")

    async def test_concurrent_accounts_and_cleanup(self):
        results = await asyncio.gather(*(self.exercise(e) for e in ACCOUNTS),
                                       return_exceptions=True)
        for result in results:
            if isinstance(result, BaseException):
                raise result
        self.assertTrue(all(not b.is_connected() for b in self.browsers))

    async def test_cleanup_after_crawl_failure(self):
        with self.assertRaisesRegex(RuntimeError, "Synthetic crawl failure"):
            await self.exercise(ACCOUNTS[0], fail=True)
        self.assertTrue(all(not b.is_connected() for b in self.browsers))

    async def test_persistent_mode_remains_available(self):
        with tempfile.TemporaryDirectory() as profile:
            async with open_game_session(
                self.playwright, profile=profile, url=GAME_URL,
                on_page=lambda page: None, headless=True,
            ) as page:
                await page.wait_for_function("window.__wsLoggerWs?.readyState === 1", timeout=5000)
            self.assertTrue((Path(profile) / "Default").is_dir())

    async def test_cleanup_after_auth_failure(self):
        data, key = select_account(SOURCE, ACCOUNTS[0])
        with (patch("browser.session.restore_auth", side_effect=ValueError("Auth failed")),
              self.assertRaisesRegex(ValueError, "Auth failed")):
            async with open_game_session(
                self.playwright, profile=None, auth=SelectedAuth(data, key, ACCOUNTS[0]),
                url=GAME_URL, on_page=lambda page: None, headless=True,
            ):
                self.fail("Session must not yield after auth failure")
        self.assertTrue(all(not b.is_connected() for b in self.browsers))


if __name__ == "__main__":
    unittest.main()
