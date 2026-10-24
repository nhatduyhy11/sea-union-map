# Sea capture POC — thêm `scroll` vào step DSL + `sea_capture.py` walkthrough

## Context

Dự án có 2 phần rời rạc: UI demo (mock data, `src/`) và bộ tool bắt socket (`tools/socket_log/`, đã POC trên event mỏ). Event **Tranh Bá Tứ Hải** mới được spec tại `docs/SEA_STRUCTURE.md` (chủ dự án đã confirm 2026-10-24) nhưng **chưa có capture nào** — protocol của event chưa biết.

Bước 1 theo yêu cầu chủ dự án: chạy lệnh playwright để đi đúng 10 bước điều hướng (SEA_STRUCTURE §2), **bắt raw WS frame + screenshot bằng chứng** (lobby là bắt buộc, kèm node detail / boss detail / node leaderboard / BXH ×2 / faction ×4 / battle map). Methodology chuẩn đã ghi ở `docs/planning/2026-10-22-socket-step-learn.md`: chạy stage → đọc shot → sửa tọa độ → chạy lại.

**Out of scope (phase sau):** decode/chốt protocol sea, `sea_logger` + sinks, dedupe boss (scrape-once), enumerate tự động toàn map, transform ra data cho frontend.

## Thay đổi

### 1. `tools/socket_log/socket_capture.py` (sửa)

- **Thêm verb `scroll`** vào `run_step` (chèn giữa nhánh `click` và `mark`), cập nhật docstring DSL:
  - Grammar: `scroll:X,Y,DX,DY` — `mouse.move(X,Y)` rồi `mouse.wheel(DX, DY)` (DY dương = cuộn xuống), settle 1.0s như `click`.
  - Đủ cho cả cuộn lobby event (bước 3) lẫn probe pan battle map. KHÔNG có gesture drag trong DSL — flow mới vào sea qua event lobby, không cần swipe carousel hàng icon nữa (drag verb đã drop).
- **Tách launch block** (:163-191) thành `launch_session(playwright, *, profile, url, writer, settle, width, height, browser, headless) -> CaptureSession(context, page, guard_task)` + `close_session(session)` — behavior-preserving, giữ nguyên channel-conditional, `service_workers: block`, first-page-vs-new-page, `attach_capture` cho cả page lẫn `context.on("page")`, `navigate_to_game` retry, delayed frame-guard task. CLI/defaults của `socket_capture` giữ nguyên.
- Smoke test đường cũ: `uv run python tools/socket_log/socket_capture.py --profile .tmp/pmain --step shot:t --step sleep:2` (`.tmp/m535` không còn tồn tại).

### 2. `tools/socket_log/sea_capture.py` (file mới)

Thin entry import từ `socket_capture`: `FrameWriter, attach_capture, parse_step, run_step, DEFAULT_OUT_DIR, launch_session, close_session`; thêm `page_guards.close_profile_popup_tabs` (gọi trước mỗi step — hiện là no-op, chỉ phòng popup tab) và `process_guard.acquire_profile_lock/release_profile_lock` (**lock profile `pmain`**, tên `.sea_capture.lock` — đây là session chính đang sống của user).

- **`STAGES: list[tuple[str, list[str]]]`** — walkthrough theo SEA_STRUCTURE §2. `node_steps(idx, x, y, *, close_detail)` sinh 12 step/node: mark → click node → `shot:7-nNN-detail` → mark → click kính lúp **383,251** → `shot:9-nNN-boss` → click close boss 476,149 → mark → click ô xếp chồng **487,479** → `shot:8-nNN-board` → click close board 487,88 → mark → click close detail. Prefix shot `7/8/9` = số hình trong SEA_STRUCTURE để review theo nhóm; trình tự nằm ở marks trong `index.jsonl`.
- **`run_stages()`**: tự emit `mark:stage:<name>` / `stage:<name>:end` quanh mỗi stage (definitions giữ sạch); **fail-fast** — click trượt không raise mà chỉ lệch flow, nên khi exception: chụp `screens/FAIL-<stage>.png` rồi raise; resume bằng `--from`.
- **CLI**: `--profile` default **`.tmp/pmain`**; `--out` default `DEFAULT_OUT_DIR/sea-<ts>` (**dir mới mỗi lần chạy** — `FrameWriter.seq` reset, dùng lại dir cũ sẽ ghi đè frame); `--settle` default 8; `--list`; `--from STAGE`; `--only STAGE`; `--step` passthrough chạy sau các stage; `meta.json` superset (thêm from/only/stages).

**STAGES khởi tạo** (tọa độ đọc từ `docs/assets/sea-socket/*.png`, viewport 640×720 → 1:1, TO VERIFY khi chạy):

| Stage | Nội dung |
| --- | --- |
| `login` | mark + sleep:3 + `shot:1-home-init` (step đóng quảng cáo thêm sau lần chạy đầu — popup guard đang disable) |
| `open-sea` | `click:424,688` icon list event (vòng đỏ `1-home-init.png`) → `shot:2a-event-lobby-start` → 2 lần `scroll:320,400,0,500` xuống cuối list → `shot:2b-event-lobby-scroll-end` → `click:400,594` nút "Khiêu chiến" trên banner Tranh Bá Tứ Hải → `shot:3-sea-home` **← BẰNG CHỨNG bắt buộc, đối chiếu asset 3-sea-home.png** |
| `leaderboards` | `click:494,133` → shot 4-faction; `click:264,689` tab BXH điểm → shot 4-player; `click:488,690` back |
| `factions` | `click:145,612` cờ phe 1 → shot 5-faction-1 → 3 tab trong trang (232/300/377, y≈686) → shot 5-faction-2..4 → back |
| `battle-map` | `click:320,295` trung tâm lobby → `shot:6-battle-map` |
| `nodes` | `node_steps` × 6 node nhìn thấy: đền 310,225; 232,322; 404,322; 318,388; 318,468; 318,585. `close_detail="80,620"` (click ra ngoài popup — gesture CHƯA BIẾT CHẮC, là param để tinh chỉnh) |
| `map-pan` | 2 lần `scroll:320,400,600,0` + shots (probe wheel-pan ngang — canvas ăn hay không chưa biết; nguồn tọa độ cho stage `nodes-2` bổ sung sau) |

### 3. Docs sau capture

- `docs/planning/2026-10-24-sea-capture.md`: tọa độ đã dùng, gì hoạt động/ge gì, kết quả correlation.
- Correlation: lọc `index.jsonl` theo cửa sổ `stage:<name>` → `uv run python tools/socket_log/socket_decode.py <out> <seq>` từng frame — trả lời "thao tác nào sinh module/cmd nào, state nào nằm trong login push".
- Cập nhật `docs/SOCKET_PROTOCOL.md` (mục sea, trạng thái POC) + lật ghi chú "chưa có capture" trong `SEA_STRUCTURE.md` khi đã prove.

## Vòng lặp chạy/verify

1. `--list` → `--only login` → đọc `screens/1-home-init.png` → thêm step đóng popup ads nếu có.
2. `--from open-sea` → đọc `2a-event-lobby-start` (click icon list ăn chưa) → `2b-event-lobby-scroll-end` (2 lần scroll đã tới cuối list chưa) → đối chiếu `3-sea-home` với asset.
3. Tiếp từng stage tới `nodes`; sửa tọa độ theo shot/`FAIL-*.png`; rerun `--from open-sea` (login+open-sea chỉ tốn ~giây, không tách stage qua nhiều session).
4. **Tiêu chí đạt:** frames + marks đủ mỗi stage; `3-sea-home` khớp asset lobby; có shot detail/boss/board cho các node nhìn thấy; session `pmain` còn nguyên sau khi chạy; lock chặn chạy đè.

Chrome chạy **headful** (mặc định) — user có thể xem trực tiếp. Nếu session `pmain` hết hạn giữa chừng thì dừng, đưa user đăng nhập lại.

## File liên quan

- `tools/socket_log/socket_capture.py` — sửa (scroll verb + launch_session/close_session)
- `tools/socket_log/sea_capture.py` — mới (STAGES, node_steps, run_stages, CLI, lock)
- `tools/socket_log/process_guard.py`, `page_guards.py` — tái sử dụng, không sửa
- `docs/SEA_STRUCTURE.md` §2/§5 — nguồn điều hướng; `docs/planning/2026-10-22-socket-step-learn.md` — methodology
- `tools/socket_log/socket_decode.py` — correlation sau capture, không sửa
