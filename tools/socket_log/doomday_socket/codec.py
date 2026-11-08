"""Decode complete leaderboard and public-profile messages with the game schema."""

import base64

from playwright.async_api import Page

DECODE_JS = r"""
({namespace, message, b64, compressed}) => {
  const req = window.__require;
  for (const name of ['GameDef', 'GhostWar', 'PlayerInfo', 'Guild']) {
    const proto = req(name + 'Proto');
    const defs = req(name + 'Define')[name + 'Define'];
    for (const [key, value] of Object.entries(proto)) {
      if (typeof value === 'function' && defs[key + '_Def']) {
        value.getDefines = defs[key + '_Def'];
      }
    }
  }
  const cls = req(namespace + 'Proto')[message];
  if (!cls?.getDefines) throw new Error('Missing schema: ' + message);
  let data = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (compressed) data = req('QuickLZ').QuickLZ.decompress(data);
  const value = req('BufferUtils').BufferUtils.decode(
    cls, req('PBReader').PBReader.create(data));
  function plain(v) {
    if (v == null || typeof v !== 'object') return v;
    if (typeof v.getArray === 'function') return v.getArray().map(plain);
    if (typeof v.foreach === 'function' && typeof v.getValue === 'function') {
      const result = {};
      v.foreach((key, item) => result[key] = plain(item));
      return result;
    }
    if (Array.isArray(v)) return v.map(plain);
    return Object.fromEntries(Object.entries(v).map(([key, item]) => [key, plain(item)]));
  }
  return plain(value);
}
"""


async def decode_message(page: Page, namespace: str, message: str,
                         header: dict, body: bytes) -> dict:
    return await page.evaluate(DECODE_JS, {
        "namespace": namespace, "message": message,
        "b64": base64.b64encode(body).decode(),
        "compressed": header["status"] == 1,
    })
