# Tranh Bá Tứ Hải — Quy Tắc Chiếm Cứ Điểm (SEA_EVENT_RULE)

## 1. Trạng thái của tài liệu

Ghi lại các quy tắc game về chiếm cứ điểm (claim) do chủ dự án xác nhận (2026-10-22), làm căn cứ cho việc derive ownership và mock dữ liệu demo. Các phần triển khai đi kèm chỉ mô tả cách demo đang phản ánh rule, không phải rule game. Khi rule thay đổi, cập nhật tài liệu này trước khi sửa code.

## 2. Ngưỡng claim và phe thắng

- Mỗi node có một ngưỡng điểm (claim threshold); một phe phải đạt tối thiểu ngưỡng đó mới đủ điều kiện chiếm node.
- Trong các phe đủ điều kiện (đạt ngưỡng và còn được xét điểm — xem §3), phe có tổng điểm lớn nhất chiếm node.
- Thực tế mỗi node có ngưỡng riêng; demo đang equalize mọi node bằng `1`.

## 3. Đường nối từ base phải liên tục

- Điểm của một phe tại một node chỉ được xét khi có đường nối liên tục từ base của phe đó tới node, đi qua các node thuộc sở hữu của chính phe đó.
- "Liên tục" là chuỗi node phe đó owns; không đi qua node trung lập hay node của phe khác.

## 4. Bị cắt đường thì điểm bị tạm ngắt

- Nếu một node trung gian trên đường nối bị phe khác chiếm, điểm của phe tại các node phía sau bị **tạm ngắt**: không được xét khi quyết định ownership của node đó.
- Điểm bị ngắt không bị mất; khi phe nối lại đường (chiếm lại node trung gian), điểm được xét tiếp như cũ.
- Ngắt chỉ ảnh hưởng tới việc xét ownership của node; leaderboard vẫn là điểm thô (§5).

## 5. Leaderboard là tổng điểm thô

- Điểm trên leaderboard — tổng của player và tổng của phe — **không bao giờ** bị suspend hay ngắt.
- Việc ngắt đường chỉ dùng để quyết định ownership của từng node, không ảnh hưởng điểm tổng.

## 6. Chiếm dần, không chiếm nhảy

- Phe chỉ mở rộng ra node kề với lãnh thổ của mình; không chiếm một node chưa được nối tới base.
- Hệ quả: lãnh thổ mỗi phe luôn là một khối liền quanh base, và node trung lập không nằm lồng bên trong lãnh thổ (case trung lập bị bao vây thực tế không xảy ra).
- Dữ liệu demo đã được điều chỉnh để phản ánh đúng điều này.

## 7. Phe chưa từng mở link thì không có điểm tại node

- Nếu một phe chưa từng mở node liên kết tới một cứ điểm thì cứ điểm đó không có điểm của phe đó.
- Khi có data thật, rule này tự đúng theo dữ liệu; demo mock trọng số theo việc phe đã "probe" tới node hay chưa (§8).

## 8. Triển khai và demo hiện tại

- Ownership không lưu tĩnh trong data: `deriveClaims` tại `src/domain/claims.ts` derive từ islands + routes + contributions bằng fixed-point iteration, vì connectivity và ownership quyết định lẫn nhau.
- Demo `src/data/demo.ts` sinh contributions bằng flood-fill mở rộng khoanh vùng từ 4 base: lãnh thổ mỗi phe một khối liền, giữa map là vùng trung lập; trọng số theo phe — owner cao, phe đã probe tới node thấp, phe chưa probe bằng 0.
- Exact tie giữa các phe đủ điều kiện → node tạm chưa ai chiếm (neutral): cách xử lý đã triển khai, chưa được chủ dự án chốt riêng.
- Tests rule nằm tại `src/domain/claims.test.ts`; node panel đánh mờ phe đang bị ngắt (`FactionScores.tsx`); leaderboard tổng điểm thô tại `src/domain/selectors.ts`.
