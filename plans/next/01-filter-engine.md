# 01 — Filter engine + furniture canvas

Mô hình tương tác chung xem `../NEXT_SPEC.md` — spec này chỉ scope phần nền.

## Mục tiêu

Canvas lọc được theo guild / player đúng mô hình "một filter
một thời điểm"; legend đáy về display-only. Chưa đụng panel BXH — filter
guild/player chỉ cần wire tối thiểu để kiểm chứng trên canvas, chip là
deliverable thấy được.

## Scope

- **`stores/mapView`** — `filter` thành union
  `{ kind: "guild" | "player", id } | null` (null = all); action set/toggle +
  reset. Filter phe drop (owner chốt 2026-10-26): `toggleFaction`/
  `selectFaction` xóa theo — legend display-only, sub-tab phe view-only,
  không consumer nào còn ghi filter phe.
- **`domain/mapGraph`** — node match theo kind: guild/player → node có
  contribution của guild/player đó highlight, node còn lại dim; edge luôn
  resting (bỏ hẳn logic highlight edge — không còn filter phe). Bỏ nhánh
  neutral/owner-match của filter. Thêm transition dim nhẹ (~150ms).
- **`domain/mapData`** — cặp index `nodeIdsByGuild` / `nodeIdsByPlayer`
  derive một lần cạnh `scoresByNode`. Bucket "Không guild" match được như
  một guild thường (node có contribution từ player không guild).
- **`domain/selectors`** — `GuildScore` mang thêm danh sách thành viên (id,
  tên, điểm, số đảo) sort theo điểm — dữ liệu cho accordion ở sub-spec 02.
- **`stores/commands`** — command set/toggle filter + reset (chip ✕ và các
  sub-spec sau dùng chung).
- **Chip overlay** góc trên canvas: `[⚔ Guild A ✕]` / `[👤 Player1 ✕]`,
  ✕ → reset về `all`.
- **`components/map/FactionLegend`** — bỏ nút, chỉ còn swatch màu + label
  (filter "Trung lập" mất theo drop filter phe — data layer cũng bỏ case
  neutral trong filter).

## Chấp nhận

- Filter phe drop hoàn toàn: không còn đường nào lọc canvas theo phe; edges
  luôn resting, dim chỉ xảy ra cho guild/player.
- Chip hiện đúng kind + tên của filter đang bật; `all` → không chip.
