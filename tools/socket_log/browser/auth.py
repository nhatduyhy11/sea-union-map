"""Read-only SDK auth selection and restore for fresh game sessions."""

import copy
import json
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import BrowserContext, Page
from playwright.async_api import Error as PlaywrightError

SDK_URL = "https://h5sdk.joynetgame.com/"
AUTH_NAVIGATION_TIMEOUT_MS = 60_000

RESTORE_JS = """({data}) => {
    for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key,
            typeof value === 'string' ? value : JSON.stringify(value));
    }
}"""

CHECK_ACCOUNT_JS = """(key) => {
    try {
        return JSON.parse(localStorage.getItem(key))?.value?.username ?? null;
    } catch { return null; }
}"""


def select_account(data: object, email: str) -> tuple[dict, str]:
    """Copy the complete object, replacing only userLoginData.value."""
    if not isinstance(data, dict):
        raise TypeError("Secret must be a JSON object of localStorage keys")
    lists = [key for key in data if key.endswith("_allLoginList")]
    if len(lists) != 1:
        raise ValueError("Expected exactly one SDK _allLoginList key")
    list_key = lists[0]
    login_key = list_key.removesuffix("_allLoginList") + "_userLoginData"
    wrapper = data[list_key]
    accounts = wrapper.get("value") if isinstance(wrapper, dict) else None
    if not isinstance(accounts, dict) or email not in accounts:
        raise ValueError("Selected account is absent from allLoginList.value")
    account = accounts[email]
    if not isinstance(account, dict) or account.get("username") != email:
        raise ValueError("Selected account must be an object with matching username")
    if not account.get("access_token"):
        raise ValueError("Selected account has no access_token")
    if not isinstance(data.get(login_key), dict):
        raise TypeError("Expected userLoginData wrapper object")
    selected = copy.deepcopy(data)
    selected[login_key]["value"] = copy.deepcopy(account)
    return selected, login_key


@dataclass(frozen=True, repr=False)
class SelectedAuth:
    data: dict
    login_key: str
    email: str


def load_auth(path: Path, email: str) -> SelectedAuth:
    try:
        raw = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        raise ValueError("Cannot read auth JSON file") from None
    try:
        source = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError("Auth file is not valid JSON") from None
    data, login_key = select_account(source, email)
    return SelectedAuth(data, login_key, email)


async def restore_auth(context: BrowserContext, auth: SelectedAuth) -> Page:
    """Return the SDK tab; caller closes it after opening the game tab."""
    page = await context.new_page()
    await page.goto(SDK_URL, wait_until="domcontentloaded",
                    timeout=AUTH_NAVIGATION_TIMEOUT_MS)
    if page.url.rstrip("/") != SDK_URL.rstrip("/"):
        raise ValueError("Auth page did not retain the expected SDK origin")
    await page.evaluate(RESTORE_JS, {"data": auth.data})
    if await page.evaluate(CHECK_ACCOUNT_JS, auth.login_key) != auth.email:
        raise ValueError("SDK storage readback does not match selected account")
    print("[auth] SDK storage restored; selected account readback matches", flush=True)
    return page


async def verify_game_account(page: Page, auth: SelectedAuth) -> None:
    """Fail before crawling if the game's SDK storage shows another account."""
    for frame in page.frames:
        origin = urlsplit(frame.url)
        if (origin.scheme, origin.netloc) != ("https", "h5sdk.joynetgame.com"):
            continue
        try:
            username = await frame.evaluate(CHECK_ACCOUNT_JS, auth.login_key)
        except PlaywrightError:
            continue
        if username == auth.email:
            print("[auth] selected account verified in game SDK frame", flush=True)
            return
    raise ValueError("Selected account could not be verified in game SDK frame")
