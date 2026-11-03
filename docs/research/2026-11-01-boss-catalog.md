# Boss Sea: phần còn mở

## Catalog dùng chung theo phiên bản config

- Tích hợp `seaMonstersById[monsterId]` cho wrapper Sea và
  `creepsByCode[code]` cho unit, giữ riêng hai miền ID. Bổ sung mô tả và hero
  gợi ý cho FE; lookup skill tách riêng khi cần.
- Xác định cách gắn phiên bản config vào catalog và xử lý khi config thay đổi;
  không mặc định mọi server hoặc phiên bản game đều dùng cùng catalog.
- Nguồn dữ liệu: `tools/socket_log/sea_socket/per_event/boss_extract.py`
  xuất `catalog.json` và `<monsterId>-<model>/info.json` (monster, creep,
  skills, buffs, heroes, restrainTags, specialAttrs). Dữ liệu là giá trị runtime
  sau giải mã/localize, không phải bytes thô `.bin` hay contract FE.

Phạm vi implementation và tự nhận diện đợt bằng `GetOutInfoR.startDt` nằm ở
[BACKLOG_SEA.BE.md mục 2](../sea/BACKLOG_SEA.BE.md#2-boss-node--tự-nhận-diện-đợt-và-catalog).
Chuỗi ID nằm ở [SEA_STRUCTURE.md §4.2](../sea/SEA_STRUCTURE.md#42-boss-node-campgvgmonsterlo).

## Quy tắc gộp biến thể boss ngoài Sea

Chốt quy tắc gộp các row `CreepLO` có token `Boss` trong `_unit_type_tag` thành
loại boss độc lập nếu mở rộng catalog ngoài Sea. Không dùng số row, tên hoặc
model làm số lượng loại boss; lookup theo code và giữ wrapper riêng từng event.

## Giải mã combat nếu cần chỉ số thực chiến

- Giải mã graph SkillPhase/KeyFrames/Damage/Summon và công thức quy đổi các
  cột `*level`; không coi `_atk/_life/_defence = 0` trong `CreepLO` là chỉ số
  cuối cùng trong trận.
- Alien (`monsterId = 1002`, `CreepLO.code = 120071201`): truy handler của
  `_specialAttr = "[[10196,-5000]]"` (10196 là Kháng Tê Liệt) để xác định
  công thức chịu thêm sát thương Tê Liệt.
- Kiểm chứng thời điểm triệu hồi thực tế: buff `30712999000` có `TICKED`,
  `_init_cd = 15`, `_cd = 15`; mô tả skill còn có nhánh triệu hồi lập tức
  cho lối chơi khác.
- Truy graph bất tử/hồi HP: buff `10001405000` có `_effect = "IMMORTAL"`,
  buff `10001405100` dùng preset `When_Blood_Reduce_Target_Percent` và
  `_presetParams = "[1]"`. Chưa dùng mô tả skill hồi HP ở 1% làm bằng chứng
  đã giải mã đầy đủ hành vi combat.
