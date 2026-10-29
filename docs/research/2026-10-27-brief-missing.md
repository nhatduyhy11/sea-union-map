# Brief player/guild bị thiếu — diễn biến điều tra (2026-10-27)

> **Nhật ký research.** Kết luận đang áp dụng ở
> [`../sea/STATS_MISMATCH.md`](../sea/STATS_MISMATCH.md) §5.1.

Crawler cũ gom id brief không retry, server nuốt 1 batch 60 id (seq=169 trả 0
brief) → 55 player mất tên. Quá trình xử lý:

- **Throttle:** tool `tools/socket_log/sea_socket/brief_backfill.py` re-request ids
  thiếu (chunk 20 + backoff, chỉ stage login). Lần 1: 39/59, `players.jsonl` 257 → 307.
- **"Từ chối" tạm giải thích là cooldown (sau đó làm rõ):** 16 id trả rỗng xuyên 5
  round → ~90 phút sau 1 batch riêng trả đủ 6.5KB (`still missing: 0`,
  `players.jsonl` → 323). Lần thành công đó đi kèm fix bỏ 4 pseudo-id `1..4` khỏi
  batch — mọi batch chứa `1..4` đều rỗng (5/5), mọi batch sạch đều OK (8/8) → khả
  năng cao là **batch poisoning** (rankId invalid làm rỗng cả list).
- **Roster trong map snapshot:** `parse_map_snapshot` cũ parse `guildInfos` (f4) bằng
  `read_packed_varints` (mis-parse, vứt roster). Sau fix: 51476884 (hạng 2 toàn
  server, VP phe2) thuộc OLYMPUS `5140005` cùng 14 refused khác; 51305171 thuộc
  OneKing `5130004` (phe3).
- **Guild brief rỗng theo thời gian:** 16 guild rỗng lúc 07:26–07:45, chiều cùng ngày
  retry trả đủ 12/12 còn thiếu.
