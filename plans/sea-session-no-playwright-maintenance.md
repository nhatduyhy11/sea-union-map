Ngày 2026-10-26 (bắt đầu ~15:15, bảo trì ~2h): game H5 bảo trì — TUYỆT ĐỐI không
khởi động Playwright/browser hay chạy `sea_capture.py`/logger trong session này.
Mọi việc giới hạn ở phân tích offline với frame đã capture
(`.tmp/socket-capture/sea-20261026-142917`, 549 frame). Không đề nghị re-capture —
sẽ fail. Session chạy lại sẽ do chủ dự án manual start khi bảo trì xong.

**Why:** chủ dự án chốt trước khi bắt đầu work offline; dữ liệu mới không thể sinh
ra trong cửa sổ bảo trì.

**How to apply:** nếu việc kế tiếp cần capture live → dừng, báo chủ dự án để họ
start session; tiếp tục decode/parse offline (QuickLZ, board, snapshot) là thoải mái.
Hết hạn khi chủ dự án xác nhận bảo trì xong.
