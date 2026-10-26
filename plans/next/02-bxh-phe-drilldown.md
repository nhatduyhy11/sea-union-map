# 02 — BXH: header chung + Filter mode + drill-down guild (tab Phe)

Mô hình tương tác chung xem `../NEXT_SPEC.md`. Đây là phần nặng nhất của
spec — expansion và filter móc nhau ở tab Phe.

## Mục tiêu

Tab Phe thành bảng drill-down Phe → guild → thành viên, guild mở chính là
filter canvas; kèm mode "xem tự do" tắt toàn bộ side-effect lên canvas.

## Scope

- **Header chung panel BXH** — eyebrow "TOÀN CHIẾN TRƯỜNG" + checkbox
  "Filter mode" (default tick) trên board tabs; bỏ eyebrow lặp trong 3 board.
  Checkbox ít bắt mắt, tooltip ngắn giải thích hai mode.
- **`stores/panel`** — `filterMode: boolean` (default `true`); state panel,
  sống qua các lần đổi tab.
- **Filter mode bật** — guild row thành accordion (một guild mở = filter
  guild, collapse → reset `all` + đóng hết expansion); member row toggle
  player↔guild (guild vẫn mở, member được chọn highlight mạnh hơn). Sub-tab
  phe thuần view (view-local, reset khi rời board) — guild/member là control
  filter duy nhất của tab Phe; mở guild ở list hay ở card view đều như nhau
  (view không bị kéo theo filter). Faction summary row không phải filter
  control, cũng single-open theo accordion. Guild row thêm metadata "· N
  đảo"; row đang filter tint màu phe nhẹ + chevron xoay.
- **Filter mode tắt** — mọi expansion thành `<details>` đa mở thuần đọc;
  member row inert (không affordance tương tác); tắt mode → canvas reset về
  `all`. (Sub-tab phe view-only sẵn ở cả 2 mode nên không khác gì.)
- **Reset view** — đổi tab BXH / rời ranking / collapse row đang mở → filter
  về `all`, đóng hết expansion (dùng command reset từ 01; `filterMode` giữ
  nguyên).

## Chấp nhận

- Filter mode bật: một guild mở tại một thời điểm; guild/member phản chiếu
  đúng filter đang bật (tint + chip canvas); sub-tab phe không phải filter.
- Filter mode tắt: BXH không side-effect gì lên canvas.
