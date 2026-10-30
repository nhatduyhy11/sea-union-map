---
name: specs-location
description: Backlog / planning docs đặt theo nhánh (docs/sea/, docs/mine_docs/) — chỉ lưu issue còn tồn động, done thì remove, không dùng làm log/history
metadata:
  type: feedback
---

Spec và planning doc đặt trong thư mục docs của nhánh tương ứng (`docs/sea/`,
`docs/mine_docs/`); backlog chung của nhánh là `BACKLOG_*.md`. Nhật ký research (cách
làm, diễn biến điều tra, số đo) đặt ở `docs/research/` với prefix ngày (ví dụ
`docs/research/2026-10-29-event-navigate-experiment.md`) — doc nhánh chỉ giữ kết quả chốt + việc mở.
Xem `docs/DOCS_GUIDE.md`.

Nội dung planning doc chỉ ghi lại các **issue / việc còn tồn động (open items)** —
không phải log hay history của những gì đã hoàn thiện.

**Why:** User yêu cầu specs nằm trong "planning của proj" (2026-09-04) — docs trong repo
là nơi giữ handoff, research, TODO — version-controlled và visible cho team.
User xác nhận lại (2026-09-07): doc này để lưu issue còn tồn động, việc done thì
remove, chỉ snapshot issue khi lần đầu init scan / audit.

**How to apply:**

- Ghi spec/plan mới vào `docs/sea/` hoặc `docs/mine_docs/` (prefix ngày), cập nhật `docs/DOCS_GUIDE.md` nếu thêm doc mới.
- Việc nào đã hoàn thiện (done) thì remove khỏi doc — không giữ lại như log,
  không append dòng "đã xong".
- Chỉ liệt kê toàn bộ issue khi lần đầu init scan / audit; các lần cập nhật sau
  chỉ giữ lại phần còn mở.
