"""Decode compressed/proto frames with the game's own runtime codec (headless page).

The client decodes S2C bodies itself: QuickLZ decompress (when the 8-byte response
header's compress flag is 1) then ``BufferUtils.decode(class, PBReader)`` with the
schema descriptor attached via ``class.getDefines = Xxx_Def``. Instead of porting
that stack to Python, boot the game page headless and drive ``window.__require``.

Usage:
    # leaderboard 0x0c/0x0003 (mode rank) — b64 body files first, then json on stdout
    uv run python tools/socket_log/core/runtime_codec.py rank body1.b64 body2.b64

    # player briefs 0x0d/0x0020 (mode briefs)
    uv run python tools/socket_log/core/runtime_codec.py briefs body1.b64

    # cut a frame body out of a capture (true 8B header!) and pipe both steps:
    uv run python tools/socket_log/core/runtime_codec.py --cut .tmp/socket-capture/bxh-run7 321
    # -> writes /tmp/f321-body.b64 and prints the header fields
"""

import argparse
import asyncio
import base64
import json
import pathlib
import sys

from playwright.async_api import async_playwright

GAME_URL = "https://hauntedroomvnh5.joynetgame.com/"

DECODE_JS = r"""
async (args) => {
  const [mode, inputs] = args;
  const RP  = window.__require('RankingProto');
  const RD  = window.__require('RankingDefine').RankingDefine;
  const PIP = window.__require('PlayerInfoProto');
  const PID = window.__require('PlayerInfoDefine').PlayerInfoDefine;
  const GDP = window.__require('GameDefProto');
  const GDDm = window.__require('GameDefDefine');
  const GDD = GDDm.GameDefDefine || GDDm;
  const BU  = window.__require('BufferUtils').BufferUtils;
  const PBRm = window.__require('PBReader');
  const PBR = PBRm.PBReader || PBRm;
  const QLZm = window.__require('QuickLZ');
  const QLZ = QLZm.QuickLZ || QLZm;

  // attach descriptors to every proto class that has a matching *_Def
  for (const exports of [GDP, PIP, RP]) {
    for (const clsName of Object.keys(exports)) {
      const defName = clsName + '_Def';
      if (typeof exports[clsName] === 'function' && typeof GDD[defName] === 'function') {
        exports[clsName].getDefines = GDD[defName];
      } else if (typeof exports[clsName] === 'function' && typeof RD[defName] === 'function') {
        exports[clsName].getDefines = RD[defName];
      } else if (typeof exports[clsName] === 'function' && typeof PID[defName] === 'function') {
        exports[clsName].getDefines = PID[defName];
      }
    }
  }
  RP.GetCommonRankR_Ranking_S2C.getDefines = RD.GetCommonRankR_Ranking_S2C_Def;
  PIP.GetBasePlayerInfosR_PlayerInfo_S2C.getDefines = PID.GetBasePlayerInfosR_PlayerInfo_S2C_Def;

  const out = [];
  for (const b64 of inputs) {
    const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    if (mode === 'rank') {
      const plain = QLZ.decompress(raw);
      const vo = BU.decode(RP.GetCommonRankR_Ranking_S2C, PBR.create(plain));
      const ranks = (vo.ranks || []);
      const n = ranks.length;
      const list = [];
      for (let i = 0; i < n; i++) {
        const r = ranks.getValueByIndex ? ranks.getValueByIndex(i) : ranks[i];
        list.push({rank: r.rank, key: r.key,
                   rankId: String(r.rankId), additionInfo: r.additionInfo, idType: r.idType});
      }
      out.push({err: vo.err !== undefined ? String(vo.err) : null, idType: vo.idType,
                rankLength: vo.rankLength, n,
                selfRank: vo.selfRank ? {rank: vo.selfRank.rank, key: vo.selfRank.key,
                                         rankId: String(vo.selfRank.rankId),
                                         additionInfo: vo.selfRank.additionInfo} : null,
                ranks: list});
    } else if (mode === 'briefs') {
      const vo = BU.decode(PIP.GetBasePlayerInfosR_PlayerInfo_S2C, PBR.create(raw));
      const list0 = vo.baseInfos;
      const n = list0 ? list0.length : 0;
      const items = [];
      for (let i = 0; i < n; i++) {
        const b = list0.getValueByIndex ? list0.getValueByIndex(i) : list0[i];
        items.push({
          playerId: String(b.playerId), name: b.name,
          fightCap: typeof b.fightCap === 'bigint' ? Number(b.fightCap) : b.fightCap,
          level: typeof b.level === 'bigint' ? Number(b.level) : b.level,
          vipLevel: typeof b.vipLevel === 'bigint' ? Number(b.vipLevel) : b.vipLevel,
          offlineTime: typeof b.offlineTime === 'bigint' ? Number(b.offlineTime) : b.offlineTime,
          serverId: b.serverId, avatar: b.avatar, frame: b.frame,
          title: b.title, adventureLevel: b.adventureLevel,
          guild: b.guild ? {name: b.guild.name} : null,
        });
      }
      out.push({err: vo.err !== undefined ? String(vo.err) : null, n, items});
    } else {
      throw new Error('unknown mode: ' + mode);
    }
  }
  return out;
}
"""


def cut_frame(capture_dir: str, frame_no: int) -> None:
    """Split a response frame with the TRUE 8-byte response header:
    [len:2][ssid:1][fragIdx:1][fragCount:1][module:1][cmd:2][compress:1] (see
    SocketMgr.onMessageParser in the game bundle — byte 7 = QuickLZ flag)."""
    rows = [json.loads(line) for line in (pathlib.Path(capture_dir) / "index.jsonl").read_text().splitlines() if line.strip()]
    rec = next(r for r in rows if r.get("n") == frame_no)
    raw = (pathlib.Path(capture_dir) / rec["file"]).read_bytes()
    size = int.from_bytes(raw[0:2], "big")
    ssid, frag_idx, frag_cnt = raw[2], raw[3], raw[4]
    module, cmd = raw[5], int.from_bytes(raw[6:8], "big")
    compress = raw[8]
    body = raw[9 : 2 + size]
    out = f"/tmp/f{frame_no}-body.b64"
    pathlib.Path(out).write_text(base64.b64encode(body).decode())
    print(f"#{frame_no}: module=0x{module:02x} cmd=0x{cmd:04x} ssid={ssid} "
          f"frag={frag_idx}/{frag_cnt} compress={compress} body={len(body)}B -> {out}")


async def decode(mode: str, b64_files: list[str]) -> None:
    bodies = [pathlib.Path(p).read_text() for p in b64_files]
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, channel="chrome")
        page = await browser.new_page(viewport={"width": 640, "height": 720})
        await page.goto(GAME_URL, wait_until="load", timeout=60000)
        for _ in range(120):
            if await page.evaluate("!!window.__require"):
                break
            await page.wait_for_timeout(1000)
        else:
            raise RuntimeError("__require not ready after 120s")
        result = await page.evaluate(DECODE_JS, [mode, bodies])
        await browser.close()
    json.dump(result, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", nargs="?", choices=("rank", "briefs"))
    parser.add_argument("b64", nargs="*", help="base64 body file(s)")
    parser.add_argument("--cut", nargs=2, metavar=("CAPTURE_DIR", "FRAME_NO"),
                        help="extract a frame body (8B header) and exit")
    args = parser.parse_args()

    if args.cut:
        cut_frame(args.cut[0], int(args.cut[1]))
        return
    if not args.mode or not args.b64:
        parser.error("need MODE and at least one b64 file (or --cut)")
    asyncio.run(decode(args.mode, args.b64))


if __name__ == "__main__":
    main()
