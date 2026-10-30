"""Decode leaderboard bodies (0x0c/0x0003) with the game's own runtime.

Board bodies carry the compress flag (response header byte 7); they are decoded
in the live page with QuickLZ + BufferUtils via window.__require — same
approach as core/runtime_codec.py.
"""

import base64

from playwright.async_api import Page

# QuickLZ when flagged, then BufferUtils.decode with the ranking schema def.
DECODE_BOARDS_JS = r"""
async (inputs) => {
  const RP  = window.__require('RankingProto');
  const RD  = window.__require('RankingDefine').RankingDefine;
  const GDP = window.__require('GameDefProto');
  const GDDm = window.__require('GameDefDefine');
  const GDD = GDDm.GameDefDefine || GDDm;
  const BU  = window.__require('BufferUtils').BufferUtils;
  const PBRm = window.__require('PBReader');
  const PBR = PBRm.PBReader || PBRm;
  const QLZm = window.__require('QuickLZ');
  const QLZ = QLZm.QuickLZ || QLZm;
  // Attach schema descriptors by name suffix across every proto export —
  // a direct property grab can miss and BU.decode then silently yields an
  // empty object (seen 2026-10-26: all boards decoded to 0 rows).
  for (const exports of [GDP, RP]) {
    if (!exports) continue;
    for (const clsName of Object.keys(exports)) {
      const defName = clsName + '_Def';
      if (typeof exports[clsName] === 'function') {
        const def = GDD[defName] || RD[defName];
        if (def) exports[clsName].getDefines = def;
      }
    }
  }
  const cls = RP.GetCommonRankR_Ranking_S2C;
  if (!cls.getDefines) throw new Error('Ranking_S2C schema def not found');
  return inputs.map(({b64, compress}) => {
    try {
      const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const plain = compress ? QLZ.decompress(raw) : raw;
      const vo = BU.decode(cls, PBR.create(plain));
      const ranks = vo.ranks || [];
      const n = ranks.length;
      const rows = [];
      for (let i = 0; i < n; i++) {
        const r = ranks.getValueByIndex ? ranks.getValueByIndex(i) : ranks[i];
        rows.push({rank: r.rank, score: r.key, player_id: String(r.rankId),
                   addition_info: r.additionInfo, id_type: r.idType});
      }
      return {err: vo.err !== undefined ? String(vo.err) : null,
              id_type: vo.idType,
              self: vo.selfRank ? {rank: vo.selfRank.rank, score: vo.selfRank.key,
                                   player_id: String(vo.selfRank.rankId),
                                   addition_info: vo.selfRank.additionInfo} : null,
              rows};
    } catch (exc) {
      return {error: String(exc)};
    }
  });
}
"""


async def decode_boards(page: Page,
                        bodies: dict[tuple[int, int], tuple[bytes, bool]]) -> dict[tuple[int, int], dict]:
    """{(kind, node_id): (body, compress)} -> {(kind, node_id): decoded board}.

    One JS round-trip for every board; a per-board failure comes back as
    {"error": ...} and is logged, not raised.
    """
    keys = list(bodies)
    inputs = [{"b64": base64.b64encode(body).decode(), "compress": compress}
              for body, compress in bodies.values()]
    decoded = dict(zip(keys, await page.evaluate(DECODE_BOARDS_JS, inputs)))
    for key, row in decoded.items():
        if "error" in row:
            print(f"[board] {key}: decode error {row['error']}", flush=True)
    return decoded
