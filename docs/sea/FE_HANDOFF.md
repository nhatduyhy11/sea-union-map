# FE HANDOFF — Việc FE còn mở

> Việc FE đã bàn nhưng chưa làm; mỗi mục đủ context + hướng để người sau pick
> up. Làm xong thì xoá mục, không giữ lại như log.

---

## 1. Tách type `MapData` theo phase dữ liệu (đề xuất, chưa chốt)

- **Hiện trạng**: dữ liệu FE đi qua 3 phase — raw `SeaLiveDump`
  (`src/data/sea-live.ts`, `sea-live/dump.ts`) → join / reconcile
  (`buildLiveData`, `src/data/sea-live/join.ts`: đổi id game → layout, phe →
  hướng, điền chỗ thiếu) → derive (`buildMapData`, `src/domain/mapData.ts`:
  index và thống kê tính một lần mỗi bộ dữ liệu). `MapData` là
  `ReturnType<typeof buildMapData>`, trộn field chuyển thẳng từ phase join
  (`ownedIslands`, `contributions`, `routes`, `guildNames`…) với field derive
  (`scoresByNode`, `canvasIconByNode`, `islandStatsByFaction`…), nên nhìn type
  không biết field nào FE tự tính.
- **Hướng**: đánh dấu ranh giới ở type, không dùng prefix từng field (gần như
  mọi field `MapData` đều derive nên prefix chỉ thành nhiễu) — khai báo hai
  interface trong `mapData.ts`, `MapData = LiveData & DerivedData`.
- **Chưa chốt**: có nhóm field thành object con (`source` / `derived`) hay chỉ
  tách type giữ shape phẳng; tách phẳng thì không phải sửa consumer.
