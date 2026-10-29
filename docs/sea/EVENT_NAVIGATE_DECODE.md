# EVENT_NAVIGATE_DECODE — Payload entry: crawler sea bỏ hết GUI

> **Kết quả chính:** entry crawler sea cắt toàn bộ GUI replay (3 stage, ~30+ thao tác,
> ~211s) thay bằng wait-login + inject payload — **~9–13s tới snapshot, 0 click**.
> `crawler.py` mặc định dùng flow này; `--gui-entry` chạy lại 3 stage cũ làm fallback.
> Thí nghiệm E1/E2, số đo, quy trình tìm key cho event khác:
> [`../research/2026-10-29-event-navigate-experiment.md`](../research/2026-10-29-event-navigate-experiment.md).
> Framing xem `docs/sea/SOCKET_PROTOCOL.md` §2.

## 1. Flow entry

```
launch + hook WS
  → wait_login_done(): chờ response 0x72/0x0002 đầu tiên (boot sync, 7.8–12.2s
    tuỳ lần load), +~0.5s cho nốt boot block
  → inject 0x72/0x000b GetMapInfos (rỗng, ssid 0xF1..) → 0x000c snapshot 89 node (≤161ms)
  → (tuỳ chọn) inject 0x72/0x001b GetCampsProduct → 0x001c bảng 4 phe compact 181B
  → crawl loop per-node (payload-driven)
```

## 2. Bản đồ payload sea

| Transition | Client gửi | Response data | Chỉ có khi transition? |
| --- | --- | --- | --- |
| Boot (login sync) | block rỗng `0x72/0x0001` GetOutInfo, `0x0006` GetPlayerInfo, `0x0020` GetLogInfo, `0x0033` GetCampStrategy, `0x0036` GetNotice | `0x0002` (= **signal login-done**), `0x0007`, `0x0021`, `0x0034`, `0x0037` | — luôn có lúc boot |
| Click banner vào sea lobby | **`0x72/0x001b`** GetCampsProduct (rỗng) | **`0x001c`** bảng nhiên liệu 4 phe + `cityIds` | **KEY** (`0x0036` cùng gửi nhưng boot cũng gửi, không kéo `0x001c`) |
| Click tâm map vào battlefield | **`0x72/0x000b`** GetMapInfos (rỗng) + `0x0013` EnterScene | **`0x000c`** snapshot 23KB; `0x0014 {err:0}` + push `0x0019` UpdateCampScoreP | **KEY `0x000b`** (`0x0006` cùng gửi nhưng boot cũng gửi) |

Field từng response: [`SEA_PACKET_ANALYSE.md`](SEA_PACKET_ANALYSE.md) §1.1 / §1.5.
`0x0007` GetPlayerInfoR = `{playerId, power (thể lực event), buyPowerNum}` — không cần
cho entry.

## 3. Còn mở

- **E3** — đo pass-rate ≥3 run liên tiếp với 1 run đầu phiên cache lạnh để reproduce
  đúng điều kiện issue 10-26 (data point gần cold nhất hiện có: p545 / pjen, login
  11.7–12.2s vẫn PASS).
