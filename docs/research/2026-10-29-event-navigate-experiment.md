# Event navigate — thí nghiệm payload entry E1/E2 + quy trình tìm key (2026-10-29)

> **Nhật ký research.** Kết quả đang dùng (flow entry + bản đồ payload sea) ở
> [`../sea/EVENT_NAVIGATE_DECODE.md`](../sea/EVENT_NAVIGATE_DECODE.md). Doc này giữ cách
> làm + số đo để tái dùng khi tìm key cho event khác.
>
> Nguồn: capture walkthrough `.tmp/socket-capture/sea-20261029-010721` + experiment E1
> `.tmp/e1-inject-home{,-2}/` (có `result.json` mỗi run).

## 1. Vấn đề gốc + số đo

**Vấn đề gốc (10-26):** entry GUI fail khi game load chậm — `login` stage `sleep:8`
cứng rồi popclose trên loading screen → click bị overlay nuốt → chết ở
`expect:2a-event-lobby-start`. Rerun tay là workaround, không có cơ chế chờ sẵn sàng.

| | GUI entry (v4) | Payload entry (E1 đo) |
| --- | --- | --- |
| Stage GUI replay | 3 | **0** |
| Click / wheel / popclose | ~30+ | **0** |
| expect template-match | 3 | 0 — thay bằng assert data (`0x000c` đủ 89 `cityInfos`) |
| Thời gian tới snapshot | ~211s | **~9–13s** (warm cache) |
| Chế độ fail | click trượt / splash chậm / load chậm | inject retry + throttle predicate |

## 2. Kết luận các thí nghiệm

| # | Thí nghiệm | Kết luận |
| --- | --- | --- |
| E1 | Inject `0x000b` + `0x001b` từ home | **PASS ×4** (headed + headless, 3 profile, cả cụm khác); `0x000c` đủ 89 node owner, `0x001c` đủ 4 phe, `cityIds` khớp 1:1 owner `0x000c` — rủi ro "server trả thiếu khi không đứng đúng screen" không xảy ra |
| — | Signal `wait_login_done()` | `0x72/0x0002` đầu tiên (7.8–12.2s); heartbeat `0x02/0x0009` muộn ~2.6s, push `0x0019` chỉ đến sau `0x0013` — loại |
| — | `0x0013 → 0x0014` | err=0, chỉ kích push `0x0019` — bỏ khỏi entry |
| — | Scroll/zoom/pan | sinh **0 frame** — server chỉ thấy click |
| E2 | Nhúng vào `crawler.py` | Mặc định payload entry; cụm pjen (cold): login +10.6s, 89/89 state + board, 482 briefs, 0 thiếu brief |

## 3. Quy trình tìm key cho event bất kỳ

1. Capture có `mark:` quanh từng transition (walkthrough DSL sẵn có).
2. Lọc frame S theo window giữa các mark; bỏ heartbeat và boot-sync block (luôn có
   lúc login). Lưu ý quét S: request rỗng dài 6B — `iter_frames` từng drop vì guard
   `length < 5`, đã fix 10-29.
3. Key = request chỉ xuất hiện đúng lúc transition, thường rỗng/gần rỗng; response
   cmd+1 là data màn đó. Đối chiếu: scroll quanh đó phải sinh 0 frame. Tên request tra
   bằng [`BUNDLE_RESEARCH.md`](BUNDLE_RESEARCH.md) §3.
4. Verify inject-from-anywhere: wait_login_done + inject + so response với lúc click
   thật. Pass → event đó bỏ entry GUI. Phạm vi: inject kéo được **data**, không
   teleport UI.

## 4. Evidence

- Capture: `.tmp/socket-capture/sea-20261029-010721/` (index.jsonl + frames/ + screens/);
  script đối chiếu offline `.tmp/e0_offline_confirm.py`.
- E1: `.tmp/e1_inject_home.py` → `.tmp/e1-inject-home/` (pmain headed: login +11.1s,
  snapshot 161ms) + `.tmp/e1-inject-home-2/` (pmain headless: +7.8s, 93ms) +
  `.tmp/e1-inject-home-p545/` (+11.7s, 444ms) + `.tmp/e1-inject-home-pjen/` (cụm khác,
  +12.2s, 119ms; xuất kèm `data.json`).
- E2: `.tmp/sea-crawl/sea-crawl-pjen-payload/` — crawler payload entry đầu tiên,
  login +10.6s, `summary.json` 89/89/482.
- Decode 1 frame: `uv run python tools/socket_log/core/decode.py <capture_dir> <n>`;
  build request rỗng: `sea_socket/protocol.py build_request`; double =
  `struct.unpack('<d')` trên bit pattern fixed64.
