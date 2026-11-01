# Boss Sea: catalog, lookup và raw config

Ngày kiểm tra: **2026-11-01**. Mục tiêu: xác định nguồn thông tin boss, phạm vi
catalog giữa các server và dữ liệu cần bổ sung cho snapshot FE. Chỉ đọc game/config;
chưa triển khai export, backfill, cache hay contract FE mới.

Kết quả sử dụng thường xuyên nằm ở [SEA_STRUCTURE.md §4.2](../sea/SEA_STRUCTURE.md#42-boss-node-campgvgmonsterlo);
request/response nằm ở [SOCKET_PROTOCOL.md](../sea/SOCKET_PROTOCOL.md).

## 1. Phương pháp và kết quả đối chiếu

1. Mở session game đã đăng nhập; đọc server từ
   `PlayerModule.Ins.playerInfo.info.serverId`.
2. Gửi `0x72/0x0011 {cityId}`; đối chiếu **cityId trả về** và field 4 `monsterId`
   trong `cityInfo` của response `0x0012`. Ba node trên server 545:
   `50` (1-17), `68` (2-51), `7` (1-7) đều trả `monsterId = 1002`.
3. Enumerate toàn bộ `CampGVGMonsterLO.store`, không chỉ những ID thấy trong
   response node; tra `_showBoss` sang `CreepLO`.
4. Đối chiếu toàn bộ bảng theo ID/code và từng field giữa ba session/server.

| Server | `CampGVGMonsterLO` | Các boss `CreepLO` qua `showBoss` | Toàn bộ `CreepLO` |
| --- | --- | --- | --- |
| 545 | Baseline: 13 row, 1001..1013 | 13 row | 4.563 row |
| 735 | Không khác bất kỳ field nào | Không khác bất kỳ field nào | Không khác bất kỳ field nào |
| 2 | Không khác bất kỳ field nào | Không khác bất kỳ field nào | Không khác bất kỳ field nào |

Hai server 735 và 2 cùng tải resource `remoteConfig/sea/config.64346.bin`
(và preload tương ứng); session server 2 tải code `assets/main/index.1377a.js`.
13 là số row của config đã kiểm tra, không phải giới hạn hardcode. Kết quả ba server
ủng hộ catalog dùng chung theo phiên bản config; chưa chứng minh mọi server hoặc
bản game tương lai luôn có catalog giống nhau.

Có thể enumerate bằng runtime game sau khi full config đã tải:

```javascript
function dumpTable(table) {
  const cls = window.__require(table)[table];
  // Getter store gọi tryToInit để parse đầy đủ bảng đang lazy-load.
  const store = cls.store;
  const keys = Object.values(store._keyList);
  return keys.map(key => cls.get(key)).filter(Boolean);
}

const seaMonsters = dumpTable("CampGVGMonsterLO");
const units = dumpTable("CreepLO");
```

`store` là Dictionary; không dùng `Object.keys(store)` như danh sách row. Nếu mới
có preload config, cần chờ full config sau login hoặc tải/parse full config bằng
runtime; xem [BUNDLE_RESEARCH.md §2](BUNDLE_RESEARCH.md#2-bảng-config-lo).

Trong toàn bộ `CreepLO`, lọc token `Boss` trong `_unit_type_tag.split("|")` được
3.981 row, 149 giá trị `_name` và 77 giá trị `_model` khác nhau. Đây là biến thể
unit, chưa phải phân loại số boss độc lập. Ví dụ nhiều row tên U Linh Nhi dùng
cùng model nhưng khác `_code`. Lookup chung nên khóa theo code, giữ riêng config
wrapper của từng event; chưa chốt quy tắc gộp các biến thể thành một loại boss.

## 2. Alien: nguyên văn runtime config

Server 545: `monsterId = 1002` → `_showBoss = 120071201`. Các JSON dưới đây là
field/value đã serialize từ object runtime sau khi game giải mã config và localize
text; không phải bytes thô của file `.bin`, không phải schema/contract tự đặt cho FE.
Giữ nguyên tên field, markup, string chứa JSON và cấu trúc List nội bộ của game.

### `CampGVGMonsterLO.get(1002)` — toàn bộ 38 field

```json
{
  "_id": 1002,
  "_type": 1,
  "_name": "Tứ Hải-Nữ Hoàng Alien",
  "_round": "[1007001,3012001,1007002,1007003,1017003,1007004,1017004,1007005,1017005,1007006,1017006,1023006,1007007,1017007,1023007,1007008,1017008,1023008,1007009,1017009,1023009,1007010,1007010,1017010,1023010,1007011,1007011,1017011,1023011,1007012,1007012,1017012,1023012,1007013,1007013,1017013,1023013,1007014,1007014,1017014,1023014,1007015,1007015,1017015,1017015,1023015,1007016,1007016,1017016,1017016,1023016,1007017,1007017,1017017,1017017,1023017,1007018,1007018,1017018,1017018,1023018,1007019,1007019,1017019,1017019,1023019,1007020,1007020,1017020,1017020,1023020]",
  "_roundNum": 20,
  "_money": "[[3,30600001,1]]",
  "_initialNum": 5,
  "_initLevel": "[[[1,1],[2,1]]]",
  "_bornPos": "[[1,1],[1,2],[1,3],[1,4],[1,5]]",
  "_initBuild": "[[3,1,6,3],[3,1,11,3],[3,1,12,3],[3,1,7,3],[4,1,10,3],[4,1,13,3],[4,1,14,3],[4,1,9,3]]",
  "_limitTime": 180,
  "_showBoss": 120071201,
  "_showCreep": "[120071201,120080801,120081801,120082401]",
  "_showSize": "[0.3,0.4,0.4,0.4]",
  "_showPos": "[[0,-70],[0,-50],[0,-50],[0,-50]]",
  "_battleGroundCode": 131002,
  "_atklevel": 200,
  "_lifelevel": 400,
  "_defencelevel": 250,
  "_atkElitelevel": 200,
  "_lifeElitelevel": 400,
  "_defenceElitelevel": 250,
  "_atkBosslevel": 300,
  "_lifeBosslevel": 400,
  "_defenceBosslevel": 250,
  "_attr_Crit": 0,
  "_attr_IgnoreCrit": 0,
  "_attr_BlockBreak": 0,
  "_attr_Block": 0,
  "_attr_Hit": 0,
  "_attr_Dodge": 0,
  "_attr_ArmorBreak": 0,
  "_attr_Tough": 0,
  "_attr_HurtAdd": 0,
  "_attr_HurtSub": 0,
  "_attr_IgnoreDrawsLife": 0,
  "_attr_immuneControl": 0,
  "_isCheckBattle": 1
}
```

### `CreepLO.get(120071201)` — toàn bộ 48 field của boss chính

```json
{
  "_code": 120071201,
  "_name": "Tứ Hải-Nữ Hoàng Alien",
  "_subType": 712,
  "_race": 4,
  "_profession": 2,
  "_initStar": 0,
  "_gender": 2,
  "_upAttr": "[[1,1.05],[2,1000000000000000],[12,2],[13,2]]",
  "_specialAttr": "[[10196,-5000]]",
  "_atk": 0,
  "_life": 0,
  "_defence": 0,
  "_speed": 24,
  "_initEnergy": 0,
  "_efficiency": 5000,
  "_maxEnergy": 1000,
  "_fightScale": 100,
  "_avatar": "head/head_boss_008",
  "_model": "Boss_008",
  "_collider": "",
  "_halfPic": "half/half_boss_008",
  "_pictureDraw": "",
  "_rectanglePic": "",
  "_normalSkill": 30712001000,
  "_actSkill": 0,
  "_posSkill1": 30712999000,
  "_posSkill2": 0,
  "_posSkill3": 0,
  "_derma": 0,
  "_pSkills": "[10000118000,10001401000,10001405000,10000202000,10000203000,10000214000,10000204000,30999000000,30999001000,30999004000,30999013000,30999007000,30999016000,10001201000]",
  "_color": 1,
  "_type": 3,
  "_unit_type_tag": "Boss|BigBoss",
  "_camp": -1,
  "_work": 1,
  "_range": "Melee",
  "_killedTrigger": "OpenWheel",
  "_notShowInSandBox": 0,
  "_killerBonus_pve": 25,
  "_killerBonus_pvp": 25,
  "_simpleDesc": "Điểm yếu: <color=#47e3ff>Tê Liệt</c><br/>Kháng: <color=#FF6347>Mất HP Thiêu Đốt Choáng Dẫn Dắt</c><br/>Đặc điểm: Chặn đường đạn bắn, cứ cách một khoảng thời gian triệu hồi 5 rắn nhỏ phía sau",
  "_desc": "Chịu thêm 50% ST <color=#47e3ff>Tê Liệt</c>. Miễn <color=#FF6347>Mất HP</c>, <color=#FF6347>Thiêu Đốt</c>, <color=#FF6347>Dẫn Dắt</c> và <color=#FF6347>Choáng</c>. Chặn đường đạn bắn, cứ cách một khoảng thời gian tạo 5 quái sau lưng",
  "_superSimpleDesc": "Mẫu thể dị hình, sẽ triệu hồi<br/>loại nhỏ, điểm yếu là <color=#47e3ff>Tê Liệt</c>",
  "_move_privilege": 1000,
  "_restrainTag": "[5,15]",
  "_showHeroItem": "[[5,50000001,1]]",
  "_ignoreDefaultAI": 0,
  "_should_accept_overkill_credit": 1
}
```

### Mô tả kỹ năng — chọn field liên quan, nguyên văn

Các thông tin "15 giây", "bất tử/hồi HP khi còn 1%", "100% ST" và kháng trạng
thái sâu nằm ở các row kỹ năng bên dưới; không phải toàn bộ đều nằm trong
`CreepLO._desc`. Không thay các chuỗi gốc bằng bản diễn giải tổng hợp.

```json
[
  {
    "_id": 30712001000,
    "_name": "Công Thường BOSS 12",
    "_desc": "Một địch chịu 100% ST. ",
    "_detailedDesc1": "Một địch chịu 100% ST. "
  },
  {
    "_id": 30712999000,
    "_name": "Bị Động BOSS 12",
    "_desc": "Chặn đường đạn bắn, mỗi 15s sau lưng xuất hiện 5 Quái Nhỏ (Chuyên dụng cho lối chơi khác, lập tức triệu hồi)",
    "_detailedDesc1": "Chặn đường đạn bắn, mỗi 15s sau lưng xuất hiện 5 Quái Nhỏ"
  },
  {
    "_id": 10001405000,
    "_name": "BOSS Bất Tử",
    "_desc": "BOSS bất tử, khi còn 1% HP sẽ hồi HP",
    "_detailedDesc1": "BOSS bất tử, khi còn 1% HP sẽ hồi HP"
  },
  {
    "_id": 30999013000,
    "_name": "Kháng Choáng Sâu",
    "_desc": "Kháng Choáng Sâu",
    "_detailedDesc1": "Kháng Choáng Sâu"
  },
  {
    "_id": 30999016000,
    "_name": "Kháng Dẫn Dắt Sâu",
    "_desc": "Kháng Dẫn Dắt Sâu",
    "_detailedDesc1": "Kháng Dẫn Dắt Sâu"
  }
]
```

### Buff — chọn field liên quan, nguyên giá trị

```json
[
  {
    "_id": 30712999000,
    "_trigger": "TICKED",
    "_buffAffect": {
      "0": 30712999000,
      "1": 30712999010,
      "2": 30712999020,
      "3": 30712999030,
      "4": 30712999040,
      "_TempSort": [],
      "_length": 5,
      "_isReadonly": true
    },
    "_init_cd": 15,
    "_cd": 15
  },
  {
    "_id": 10001405000,
    "_effect": "IMMORTAL"
  },
  {
    "_id": 10001405100,
    "_presetBuff": "When_Blood_Reduce_Target_Percent",
    "_presetParams": "[1]"
  }
]
```

## 3. Phạm vi đã xác minh và điểm còn mở

- Mô tả 50% ST Tê Liệt là nguyên văn config; `_specialAttr = "[[10196,-5000]]"`.
  `AttributeDescLO` gọi loại 10196 là "Kháng Tê Liệt". Chưa suy diễn công thức
  combat đầy đủ chỉ từ một giá trị này.
- Buff triệu hồi có `TICKED`, `_init_cd = 15`, `_cd = 15` và 5 buff-action ID.
  Chu kỳ 15 giây cũng được ghi trong mô tả skill. Chưa đo thời điểm thực tế trong
  trận; mô tả skill có thêm câu "Chuyên dụng cho lối chơi khác, lập tức triệu hồi".
- Passive bất tử có `_effect = "IMMORTAL"`; row liên quan dùng preset
  `When_Blood_Reduce_Target_Percent` với tham số string `"[1]"`. Phát biểu hồi HP
  khi còn 1% đến từ mô tả skill, chưa giải mã trọn handler và graph combat.
- Chưa giải mã toàn bộ SkillPhase/KeyFrames/Damage/Summon hoặc công thức quy đổi
  các cột `*level` thành chỉ số thực chiến. Không coi `_atk/_life/_defence = 0`
  của row CreepLO hay các cột level là số cuối cùng trong trận.
- Boss chính được xác định bằng `_showBoss`. Ba unit khác trong `_showCreep`
  không phải đối tượng của phần nghiên cứu boss chính này; không cần đưa vào
  dữ liệu mô tả boss nếu FE không sử dụng.
- Danh mục chung không thay thế mapping node do server trả. Snapshot FE cũ
  thiếu mapping dù parser đã giữ `monsterId` dưới tên `art`; đề xuất backfill
  và giới hạn reuse theo server/đợt nằm tại SEA_STRUCTURE §4.2.3.
- Quy luật boss cố định suốt 7 ngày cùng server/event do chủ dự án xác nhận;
  lần kiểm tra này chưa thực hiện quan sát liên tục đủ 7 ngày.
