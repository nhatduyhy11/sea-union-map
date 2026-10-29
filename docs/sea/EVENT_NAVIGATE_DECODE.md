# EVENT_NAVIGATE_DECODE — Payload entry: crawler sea bỏ hết GUI, khuôn mẫu cho event khác

> **Kết quả chính:** entry crawler sea cắt toàn bộ GUI replay (3 stage, ~30+ thao tác,
> ~211s) thay bằng wait-login + inject payload — **~9–13s tới snapshot, 0 click**, đo
> được trên 2 run 2026-10-29 (headed + headless). File này là khuôn mẫu tham khảo cho
> các event khác — decode chi tiết từng field nằm trong capture, không lặp lại ở đây.
>
> Nguồn: capture walkthrough `.tmp/socket-capture/sea-20261029-010721` + experiment E1
> `.tmp/e1-inject-home{,-2}/` (có `result.json` mỗi run). Framing xem
> `docs/sea/SOCKET_PROTOCOL.md` §2.

## 1. Vấn đề và cải thiện flow crawl

**Vấn đề gốc (10-26):** entry GUI fail khi game load chậm — `login` stage `sleep:8`
cứng rồi popclose trên loading screen → click bị overlay nuốt → chết ở
`expect:2a-event-lobby-start`. Rerun tay là workaround, không có cơ chế chờ sẵn sàng.

**Flow mới (chứng minh bằng E1; đã nhúng vào crawler = E2, 2026-10-29):**

```
launch + hook WS
  → wait_login_done(): chờ response 0x72/0x0002 đầu tiên (boot sync; đo được
    7.8–11.1s tuỳ lần load), +~0.5s cho nốt boot block
  → inject 0x72/0x000b (rỗng, ssid 0xF1..) → 0x000c snapshot 89 node (≤161ms)
  → (tuỳ chọn) inject 0x72/0x001b → 0x001c bảng 4 phe compact 181B
  → crawl loop per-node như v4 (đã payload-driven từ trước)
```

- Signal login chốt là `0x72/0x0002`: heartbeat đầu (`0x02/0x0009`) muộn hơn ~2.6s —
  không cần; push `0x0019` loại (chỉ đến sau `0x0013`, không có lúc login).
- E1 PASS cả 2 run: `0x000c` đủ 89 node owner, `0x001c` đủ 4 phe, owned list của
  `0x001c` khớp 1:1 owner `0x000c`. Rủi ro "server trả thiếu khi không đứng đúng
  screen" **không xảy ra**.

| | GUI entry (v4) | Payload entry (E1 đo) |
| --- | --- | --- |
| Stage GUI replay | 3 | **0** |
| Click / wheel / popclose | ~30+ | **0** |
| expect template-match | 3 | 0 — thay bằng assert data (`0x000c` đủ f2×89) |
| Thời gian tới snapshot | ~211s | **~9–13s** (warm cache; cache ngu chờ E3) |
| Chế độ fail | click trượt / splash chậm / load chậm | inject retry + throttle predicate (v4 đã có) |

## 2. Bản đồ payload sea (tham khảo)

| Transition | Client gửi | Response data | Chỉ có khi transition? |
| --- | --- | --- | --- |
| Boot (login sync) | block rỗng `0x72/0x0001,0x0006,0x0020,0x0033,0x0036` | `0x0002` (= **signal login-done**), `0x0007`, `0x0021`, `0x0034`, `0x0037` | — luôn có lúc boot |
| Click banner vào sea lobby | **`0x72/0x001b`** (rỗng) | **`0x001c`** bảng nhiên liệu 4 phe + owned list | **KEY** (`0x0036` cùng gửi nhưng boot cũng gửi, không kéo `0x001c`) |
| Click tâm map vào battlefield | **`0x72/0x000b`** (rỗng) + `0x0013` | **`0x000c`** snapshot 23KB; `0x0014 {f1:0}` + push `0x0019` | **KEY `0x000b`** (`0x0006` cùng gửi nhưng boot cũng gửi) |

Semantics tối thiểu (chi tiết trong capture, script đối chiếu `.tmp/e0_offline_confirm.py`):

- `0x001c`/`0x0019`: mỗi phe `{f1 id, f2 Tổng Nhiên Liệu (double), f3 chưa định danh,
  f4 rank, f5 packed đảo đang giữ}` — `f5` là nguồn owner compact thay việc parse 23KB.
  Lưu ý field `f4` "fight_cap" của `0x72/0x0025` cũng chính là nhiên liệu phe, không
  phải lực chiến (misnomer trong `parse_faction_detail`).
- `0x0007`: `{f2 ≈ lực chiến bản thân, f3 = phe ta}` — không cần cho entry.
- `0x0013` không mang data (err=0), chỉ kích push `0x0019` — bỏ khỏi entry.
- Scroll/zoom/pan sinh **0 frame** — server chỉ thấy click, không thấy thao tác list.

## 3. Quy trình tìm key cho event bất kỳ

1. Capture có `mark:` quanh từng transition (walkthrough DSL sẵn có).
2. Lọc frame S theo window giữa các mark; bỏ heartbeat và boot-sync block (luôn có
   lúc login). Lưu ý quét S: request rỗng dài 6B — `iter_frames` từng drop vì guard
   `length < 5`, đã fix 10-29.
3. Key = request chỉ xuất hiện đúng lúc transition, thường rỗng/gần rỗng; response
   cmd+1 là data màn đó. Đối chiếu: scroll quanh đó phải sinh 0 frame.
4. Verify inject-from-anywhere: wait_login_done + inject + so response với lúc click
   thật. Pass → event đó bỏ entry GUI. Phạm vi: inject kéo được **data**, không
   teleport UI.

## 4. NEED_CONFIRM — đã chốt (2026-10-29)

| # | Vấn đề | Kết luận |
| --- | --- | --- |
| 1 | Inject `0x000b`+`0x001b` từ home | **PASS ×2** (headed + headless) |
| 2 | Signal `wait_login_done()` | `0x72/0x0002` đầu tiên; heartbeat và `0x0019` loại |
| 3 | `0x001c` f2/f3/f4 | f2 = Tổng Nhiên Liệu; f4 = rank khớp XH Phe cùng thời điểm (không khớp board 116 "XH điểm"); f3 chưa định danh — không ảnh hưởng entry |
| 4 | `0x0007` f2/f3 | f2 ≈ lực chiến bản thân; f3 = phe ta |
| 5 | `0x0013 → 0x0014` | err=0, chỉ kích push `0x0019` — không cần cho entry |

Còn mở: chỉ còn **E3** — đo pass-rate ≥3 run liên tiếp với 1 run đầu phiên cache ngu
để reproduce đúng điều kiện issue 10-26 (pjen là cụm khác + p545 là data point gần
cold nhất hiện có: login 11.7–12.2s vẫn PASS).

**E2 xong (2026-10-29):** `crawler.py` mặc định payload entry — `payload_entry()` chờ
`0x72/0x0002` + inject `0x000b`/`0x001b` (standings.json), crawl loop giữ nguyên;
`--gui-entry` chạy lại 3 stage cũ làm fallback. Chạy thẳng cụm pjen (cold): login
+10.6s, 89/89 state + board, 482 briefs, **0 player thiếu brief**, dump ra
`public/sea-live-dev.json` đầy đủ (125 guild scores/names/powers).

## 5. Phụ lục — evidence

- Capture: `.tmp/socket-capture/sea-20261029-010721/` (index.jsonl + frames/ + screens/).
- E1: `.tmp/e1_inject_home.py` → `.tmp/e1-inject-home/` (pmain headed: login +11.1s,
  snapshot 161ms) + `.tmp/e1-inject-home-2/` (pmain headless: +7.8s, 93ms) +
  `.tmp/e1-inject-home-p545/` (+11.7s, 444ms) + `.tmp/e1-inject-home-pjen/` (cụm khác,
  +12.2s, 119ms; xuất kèm `data.json`). Range login 4 run: 7.8–12.2s, PASS cả 4.
- E2: `.tmp/sea-crawl/sea-crawl-pjen-payload/` — crawler payload entry đầu tiên,
  login +10.6s, `summary.json` 89/89/482.
- Decode 1 frame: `uv run python tools/socket_log/core/decode.py <capture_dir> <n>`;
  build request rỗng: `sea_socket/protocol.py build_request`; double =
  `struct.unpack('<d')` trên bit pattern fixed64.
