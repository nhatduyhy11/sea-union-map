"""Extract protobuf schema (cmd -> message -> fields) from the game bundle.

Research tool — chạy local khi cần đào packet mới (tra tên field thay vì đoán
fN). Không thuộc flow crawl → dump → UI; output để trong .tmp/, không commit.

The minified bundle ``assets/main/index.<hash>.js`` keeps every proto definition
by name, so no guessing of f1/f2 is needed. Two patterns carry everything:

- Proxy: ``this._m=<module>,...registerModuleName(this._m,"<NS>Proxy")`` then
  ``this._s.register(this._m,<cmd>,"<Name>",s.<Name>_<NS>_<C2S|S2C>,
  n.<NS>Define.<Name>_<NS>_<dir>_Def|null,<handler>?)`` — handler suffix
  ``Response`` = reply, ``Push`` = server push, none = request/sub-struct.
- Define: ``<Msg>_Def=function(){...e.add(<field>,{n:"<name>",ft:..,wt:..,
  bt:..,refCls:a.<Msg>})...}``.

Sub-messages referenced via refCls are resolved recursively across namespaces.
Pure text parsing — no browser needed when ``--bundle`` is given; otherwise the
page is booted headless once to discover the current bundle hash (it rotates
per deploy) and the file is cached under ``.tmp/bundle/``.

Usage:
    uv run python tools/socket_log/research/proto_extract.py --ns CampGVG \
        --ns Ranking --ns PlayerInfo --out .tmp/proto/sea
    # -> sea.json (machine) + sea.md (bảng cmd → message → field)
"""

import argparse
import asyncio
import json
import re
import urllib.request
from pathlib import Path

DEFAULT_URL = "https://hauntedroomvnh5.joynetgame.com/"
CACHE_DIR = Path(".tmp/bundle")

PROXY_RE = re.compile(
    r'this\._m=(\d+),this\._s=\w+\.SocketMgr\.Ins,'
    r'this\._s\.registerModuleName\(this\._m,"(\w+)Proxy"\)'
)
REGISTER_RE = re.compile(
    r'this\._s\.register\(this\._m,(\d+),"(\w+)",\w+\.(\w+?_(C2S|S2C)),'
    r'(?:\w+\.\w+\.(\w+_Def)|null)(?:,this\.(\w+)\.bind\(this\))?'
)
DEF_RE = re.compile(r'\b(\w+_(?:C2S|S2C))_Def=function\(\)\{')
# Def bodies: "var e=new c.Dictionary;return e.add(..),e.add(..),e}" or
# "...;return e}" when empty — end is the bare 1-char var before "}".
DEF_END_RE = re.compile(r'[,;](?:return )?\w\}')
FIELD_RE = re.compile(r'\w\.add\((\d+),\{(.*?)\}\)')
ATTR_RE = re.compile(r'(\w+):(?:"([^"]*)"|[\w$]+\.(?:\w+\.)?(\w+))')


async def discover_bundle(url: str) -> str:
    from playwright.async_api import async_playwright

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="chrome", headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="load", timeout=60_000)
        for _ in range(30):
            urls = await page.evaluate(
                "() => performance.getEntriesByType('resource').map(e => e.name)"
            )
            hit = [u for u in urls if re.search(r"/assets/main/index\.\w+\.js$", u)]
            if hit:
                await browser.close()
                return hit[0]
            await asyncio.sleep(2)
        await browser.close()
    raise SystemExit("main bundle not seen — page did not boot?")


def load_bundle(path: str | None, url: str) -> str:
    if path:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    bundle_url = asyncio.run(discover_bundle(url))
    cached = CACHE_DIR / bundle_url.rsplit("/", 1)[1]
    if not cached.exists():
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        print(f"[proto] downloading {bundle_url}")
        urllib.request.urlretrieve(bundle_url, cached)
    print(f"[proto] bundle {cached}")
    return cached.read_text(encoding="utf-8", errors="replace")


def parse_defs(text: str) -> dict[str, list[dict]]:
    defs: dict[str, list[dict]] = {}
    for match in DEF_RE.finditer(text):
        # Empty messages have no add() and must not borrow the next Def's fields.
        end = DEF_END_RE.search(text, match.end(), match.end() + 20_000)
        if not end:
            continue
        fields = []
        for num, body in FIELD_RE.findall(text[match.end() : end.start()]):
            attrs = {key: (lit if lit else ident) for key, lit, ident in ATTR_RE.findall(body)}
            fields.append({"no": int(num), **attrs})
        defs[match.group(1)] = fields
    return defs


def parse_modules(text: str, namespaces: set[str]) -> dict[str, dict]:
    proxies = list(PROXY_RE.finditer(text))
    modules: dict[str, dict] = {}
    for i, proxy in enumerate(proxies):
        ns = proxy.group(2)
        if ns not in namespaces:
            continue
        end = proxies[i + 1].start() if i + 1 < len(proxies) else len(text)
        # register block ends at the first prototype method of the proxy class
        block = text[proxy.end() : end]
        block = block[: block.find("e.prototype.") if "e.prototype." in block else len(block)]
        cmds = []
        for cmd, name, msg, direction, _def, handler in REGISTER_RE.findall(block):
            kind = ("response" if handler.endswith("Response") else
                    "push" if handler.endswith("Push") else
                    "request" if direction == "C2S" else "struct")
            cmds.append({"cmd": int(cmd), "name": name, "msg": msg, "kind": kind})
        modules[ns] = {"module": int(proxy.group(1)), "cmds": cmds}
    return modules


def type_of(field: dict) -> str:
    base = field.get("refCls") or field.get("bt", "?")
    if field.get("ft") == "Map":
        value = field.get("vrefCls") or field.get("vbt", "?")
        return f"map<{field.get('bt')}, {value}>"
    if field.get("ft") == "Repeated":
        return f"repeated {base}"
    return base


# Reward/cost envelopes fan out into the whole item/hero/equip tree — list
# them by name only, never expand.
NO_EXPAND = ("SClientReward_", "SClientCost_")


def referenced(msgs: list[str], defs: dict[str, list[dict]]) -> list[str]:
    """msgs + every refCls reachable from them, in discovery order."""
    seen: list[str] = []
    stack = list(msgs)
    while stack:
        msg = stack.pop(0)
        if msg in seen or msg not in defs or msg.startswith(NO_EXPAND):
            continue
        seen.append(msg)
        for field in defs[msg]:
            for key in ("refCls", "vrefCls"):
                if field.get(key):
                    stack.append(field[key])
    return seen


def render_md(modules: dict[str, dict], defs: dict[str, list[dict]]) -> str:
    out = ["<!-- Generated by tools/socket_log/proto_extract.py — đừng sửa tay -->", ""]
    for ns, mod in modules.items():
        out += [f"## {ns} — module `0x{mod['module']:02x}` ({mod['module']})", "",
                "| cmd | kind | message | fields |", "| --- | --- | --- | --- |"]
        for c in mod["cmds"]:
            fields = defs.get(c["msg"], [])
            desc = ", ".join(f"{f['no']} `{f.get('n')}`: {type_of(f)}" for f in fields) or "—"
            out.append(f"| `0x{c['cmd']:04x}` | {c['kind']} | `{c['name']}` | {desc} |")
        registered = {c["msg"] for c in mod["cmds"]}
        nested = [m for m in referenced(sorted(registered), defs) if m not in registered]
        if nested:
            out += ["", f"### {ns} — sub-message (refCls)", "",
                    "| message | fields |", "| --- | --- |"]
            for msg in nested:
                desc = ", ".join(f"{f['no']} `{f.get('n')}`: {type_of(f)}" for f in defs[msg])
                out.append(f"| `{msg}` | {desc} |")
        out.append("")
    return "\n".join(out)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bundle", help="local assets/main/index.<hash>.js (skip download)")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--ns", action="append", required=True,
                        help="proto namespace / proxy prefix, e.g. CampGVG, Ranking")
    parser.add_argument("--out", required=True, help="output path prefix (.json + .md)")
    args = parser.parse_args()

    text = load_bundle(args.bundle, args.url)
    defs = parse_defs(text)
    modules = parse_modules(text, set(args.ns))
    missing = set(args.ns) - set(modules)
    if missing:
        raise SystemExit(f"proxy not found for: {sorted(missing)}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    msgs = referenced([c["msg"] for m in modules.values() for c in m["cmds"]], defs)
    dump = {"modules": modules, "messages": {m: defs[m] for m in msgs}}
    out.with_suffix(".json").write_text(json.dumps(dump, ensure_ascii=False, indent=1),
                                        encoding="utf-8")
    out.with_suffix(".md").write_text(render_md(modules, defs), encoding="utf-8")
    for ns, mod in modules.items():
        print(f"[proto] {ns}: module 0x{mod['module']:02x}, {len(mod['cmds'])} cmd")
    print(f"[proto] {len(defs)} defs in bundle, {len(msgs)} written -> {out}.{{json,md}}")


if __name__ == "__main__":
    main()
