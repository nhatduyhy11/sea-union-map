# BUNDLE_RESEARCH — Đào code/config/proto từ bundle game

> **Chỉ đọc khi cần decode thứ mới** (packet chưa biết, bảng config mới, field `fN`
> chưa có tên). Flow chính crawl → dump → UI không cần doc này; kết quả đã chốt nằm ở
> [`../sea/SEA_PACKET_ANALYSE.md`](../sea/SEA_PACKET_ANALYSE.md) /
> [`../sea/SOCKET_PROTOCOL.md`](../sea/SOCKET_PROTOCOL.md).
> Áp dụng chung cho mọi module (sea, mỏ…) — cùng một bundle.

## 1. Bundle game

- Game = Cocos Creator 2.x. Chuỗi tải: `manifest.<ClientVer>.js` (ClientVer trong
  `h5SB_4399_sea_vn.js`) → `main.<hash>.js` (loader) → code game ở
  **`assets/main/index.<hash>.js` (~24MB)**, module truy cập qua `window.__require(<Tên>)`.
- Minify giữ nguyên **tên class / method / field / message proto** → grep tên là đủ
  lần ra logic. Grep trên file 24MB: dùng Python `str.find` / regex không có `.{N}`
  dài phía trước — `grep -oE ".{3000}X"` chạy quá 2 phút.
- Hash bundle (`index.fc863.js`) và config (`config.63692.bin`) đổi theo đợt deploy —
  luôn lấy URL từ resource của page vừa boot, không hardcode.

## 2. Bảng config `*LO`

- Bảng nén QuickLZ + stream custom, KHÔNG tự parse — dùng runtime game:
  `window.__require("<T>LO").<T>LO.get(id)`. Liệt kê tên bảng: regex
  `\b[A-Z]\w*LO\b` trên text bundle (vd `CampGVG*`: `CampGVGLO`, `CampGVGMonsterLO`,
  `CampGVGRoundLO`, `CampGVGCityLO`, `CampGVGCampLO`, `CampGVGVerifyPowerRangeLO`…).
- **Config đầy đủ chỉ tải SAU login** [2026-10-29]: headless không login chỉ có
  `remoteConfig/sea/preload_config.<ver>.bin`, store mọi bảng rỗng →
  `tools/socket_log/config_extract.py` timeout. Cách vòng không cần login — trong page:
  1. fetch `config.<ver>.bin` (URL = resource `preload_config.<ver>.bin` đổi tên);
  2. `QuickLZ.decompress(buf)` → `new BinaryReader().init(data)` →
     `new ConfigParser().writeBinaryDataWhenRead(reader)` (đều qua `window.__require`).
- Store là `Dictionary`: duyệt key bằng `Object.values(store._keyList)` + `LO.get(key)`
  (lazy parse), KHÔNG phải `Object.keys(store)`.
- Schema cột của bảng: tìm `parseData=function(t){var o=new e;return o._id=t.readInt(),…`
  gần chỗ định nghĩa module `<T>LO` trong bundle.

## 3. Schema proto (cmd → message → field)

Tool local: [`tools/socket_log/research/proto_extract.py`](../../tools/socket_log/research/proto_extract.py)

```bash
uv run python tools/socket_log/research/proto_extract.py --ns CampGVG --ns Ranking \
    --ns PlayerInfo --out .tmp/proto/sea          # -> .tmp/proto/sea.{md,json}
```

- `--bundle <file>` để parse file đã tải (không mở browser); mặc định boot page 1 lần lấy
  URL bundle rồi cache ở `.tmp/bundle/`.
- Pattern trong bundle:
  - `XxxProxy`: `this._m=<module>,…registerModuleName(this._m,"XxxProxy")` rồi
    `this._s.register(this._m, <cmd>, "<Name>", s.<Name>_<NS>_<C2S|S2C>,
    n.<NS>Define.<Name>_<NS>_<dir>_Def | null, this.<Name>Response|Push)` — handler đuôi
    `Response` = reply, `Push` = server push, không handler = request/sub-struct.
    Request gửi: `prototype.<Name>Request=function(e,t){this._s.send(this._m,<cmd>,…)}`.
  - `<Msg>_Def=function(){var e=new c.Dictionary;return e.add(<no>,{n:"<field>",
    ft:PFType.<Optional|Repeated|Map>, wt, bt:PBType.<type>, refCls:a.<SubMsg>}),…,e}`.
- 111 proxy trong bundle; module đã dùng: `0x72` CampGVG, `0x0c` Ranking, `0x0d`
  PlayerInfo, `0x48` Mining…

## 4. Trace UI → data (cách làm, ví dụ boss node)

1. Từ hành động UI (kính lúp boss) grep handler class view: `onBtnMonsterTap` trong
   `CampGVGCityDetailPanel` → `CampGVGModule.getMonsterIdBy(cityId)` →
   `CampGVGMonsterLO.get(id).showBoss` → `CreepLO`.
2. Lần ngược nguồn dict: `getMonsterIdBy` = `cityDetailInfoDict[cityId].monsterId`,
   điền trong `openCityDetailView` từ callback `CampGVGProxy.GetCityInfoRequest`.
3. Proxy → cmd (`send(this._m,17)` = `0x11`) → Def response (`CityInfo_CampGVG_S2C_Def`
   field 4 = `monsterId`) → đối chiếu frame thật trong crawl + screenshot game.

Nút UI không sinh request ⇔ data render từ config client hoặc dict đã có từ request trước.

## 5. Manh mối chưa đào (research leads)

| Lead                                                                                                     | Ghi chú                                                     |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `CityInfo.5 campScores` (map campId → double)                                                             | Chưa từng thấy trong 89/89 node crawl 10/29 — khi nào server gửi |
| `0x72/0x0020` `GetLogInfo {logType}` → `LogInfo {id, args, dt}`                                           | Nghi log chiếm/đánh node; chưa biết giá trị `logType`, chưa inject |
| `0x72/0x000d` `UpdateCityInfosP` push (`cityInfos` + `campEfficiencys`)                                   | Nguồn delta đổi chủ thay re-pull `0x000b`; crawler chưa nghe |
| `GuildInfo.memberInfos.hurtScore` trong `GetMapInfosR`                                                     | Field có trong proto nhưng = 0/vắng ở crawl 10/29           |
| `CampGVGVerifyPowerRangeLO` (`_powerRange` theo open-day) / `_monsterType` `[lo,hi,group]`                | Nghi phân nhóm boss/đối thủ theo ngày mở server — chưa xác nhận |

## 6. Evidence

- Bundle `index.fc863.js` (2026-10-29).
- Crawl đối chiếu proto 2026-10-29: 89/89
  `GetCityInfoR` có `cityInfo` f1..f4; `GetMapInfosR` f3.f2 = 112B packed guild id,
  f5 = 2 (phe account), f6 = packed `markCityIds`.
- Boss verify: node 8 (1-23) `monsterId 1001` = "Tứ Hải-Oán Linh" ↔
  `docs/assets/sea-socket/9-boss-node.png`.
