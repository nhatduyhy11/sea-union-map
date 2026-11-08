# Doomsday: chiến công nhận thưởng và điểm BXH

Kiểm tra live nhân vật HuAsura (player ID 51921435),
trong lobby Trận Chiến Chung Cuộc, vòng chính thức 6–8/11/2026.

| Nơi hiển thị | Giá trị | Nguồn dữ liệu |
| --- | ---: | --- |
| Thưởng Chiến Công | 5.096.982; cấp 14 | `GetOutGhostWarInfoR.selfInfo.feat` |
| BXH cá nhân | 5.061.270; hạng 38 | `GetRankInfoR.myRanks.score` |

Chênh lệch là **35.712**. GUI BXH rút gọn thành **5.06M**; popup thưởng
hiện **5096982/6000000**. Độ lệch tồn tại trong hai response của server,
không phải do định dạng số của giao diện hay decoder. Hai lần mở session
và lấy lại dữ liệu đều trả cùng các giá trị này.

## Đối chiếu giao diện và client

- Click nút Thưởng Chiến Công ở góc dưới phải lobby mở `GhostWarMerit`.
  `GhostWarMerit.initUIInfo` lấy `GhostWarModule.Ins.outGhostWarInfo.selfInfo.feat`
  làm tiến độ; `GhostWarMeritItem` dùng cùng trường để xét mốc nhận thưởng.
- Popup ghi: **“HP tiêu hao đổi thành EXP Chiến Công theo tỷ lệ 1:1”**.
- Nút BXH mở cấu hình `GhostRankCycle` khi ở vòng chính thức.
  Cấu hình lấy `GhostWarModule.getRankInfo`, chuyển `score` của từng dòng
  thành giá trị hiển thị. `getRankInfo` có cache client 10 giây, nhưng các
  request trực tiếp tới server cũng trả số thấp hơn popup.
- Protocol GhostWar module `0x67`: request context `0x21` → response `0x22`;
  request BXH `0x41` → response `0x42`. Hai rank type cá nhân đã kiểm tra,
  109 và 94, cùng trả `myRanks = {id: 51921435, rank: 38, score: 5061270}`.

Ảnh kiểm tra trực tiếp:

- [Thưởng Chiến Công](../assets/doomday/pmain-merit.png)
- [BXH cá nhân](../assets/doomday/pmain-player-rank.png)

## Kết luận cho collector

Giữ riêng `selfInfo.feat` (tiến độ nhận thưởng chiến công) và
`myRanks.score` (điểm BXH). Dùng `ranks[].score` / `myRanks.score` khi tái hiện
BXH; không thay bằng `feat` hoặc áp dụng hệ số quy đổi.

Nguyên nhân lệch phía server chưa xác định; không diễn giải chênh lệch
thành một công thức quy đổi. Luật reset được đối chiếu ở mục cuối.

## Phạm vi lấy chiến công của người khác — xác minh live 9/11/2026

**Chiến công `feat` không bị giới hạn ở tài khoản đang đăng nhập.**
Popup Thưởng Chiến Công chỉ hiển thị `selfInfo.feat` của acc hiện tại;
API ranking vẫn chỉ trả `rank`, `id`, `score`. Tuy nhiên có API chiến trường
trả `feat` cho người chơi khác:

- `0x67/0x005d GetWarfieldMembers`: nhận `playerIds` (repeated uint32).
- `0x67/0x005e GetWarfieldMembersR`: trả `infos`, map từ player ID tới
  `AOIMemberInfo_GhostWar_S2C`. Trong struct này, field 15 là `feat`.
- `GetGuildPrepareInfoR.baseCampInfo.member[]` cũng có các
  `AOIMemberInfo` với `feat` của người chơi ở căn cứ. Lượt kiểm tra nhận
  36 member trong căn cứ guild HUNTERS.

Hỏi chính HuAsura và ba người top BXH:

| Player ID | Guild ID | BXH `score` | Chiến trường `feat` | Chênh lệch |
| --- | --- | ---: | ---: | ---: |
| 51921435 (HuAsura) | 5170010 | 5.061.270 | 5.096.982 | 35.712 |
| 52092459 | 5170010 | 18.600.578 | 18.609.026 | 8.448 |
| 51729833 | 5170010 | 10.980.035 | 10.984.643 | 4.608 |
| 53204879 | 5320011 | 10.430.373 | 10.460.133 | 29.760 |

Với HuAsura, `infos[51921435].feat` bằng đúng `selfInfo.feat` trong context
và số của popup. Người chơi 53204879 thuộc guild khác vẫn được trả dữ liệu.
Có thể join BXH và API này bằng player ID để giữ riêng `score` và `feat`.
Chưa kiểm tra độ phủ toàn bộ BXH/cụm hoặc điều kiện API khi đổi mùa; không
suy ra mọi ID đều luôn truy vấn được từ bốn mẫu thành công này.

`GetPublicPlayerR` của người chơi top 1 đã được kiểm tra; public profile
không có trường chiến công Doomsday trong schema. Nguồn lấy `feat` của
người khác được xác nhận là API chiến trường ở trên.

## Client có giải thích nguyên nhân lệch không?

Đã đối chiếu `ModuleHelpLO` mục `60000` (Trận Chiến Chung Cuộc), phần
“V, Thăng hạng và Thưởng”, trong config client tải ngày 9/11/2026:

- HP tiêu hao khi chiến đấu với **người chơi khác** chuyển thành chiến công
  theo tỷ lệ 1:1; chiến công đạt mốc dùng để nhận thưởng.
- Chiến công và thưởng chiến công reset khi bắt đầu vòng loại/vòng chính thức.
- Khi sự kiện kết thúc, **chiến công** cũng là tiêu chí xếp hạng cá nhân.

Vì vậy tài liệu luật không mô tả hai đại lượng có công thức riêng cho
popup và BXH. Việc giữ riêng `feat`/`score` trong collector là phản ánh hai
nguồn dữ liệu thực tế khác nhau, không phải kết luận về thiết kế game.

Trong client, `GhostWarMerit.initUIInfo` đọc `selfInfo.feat`, còn cấu hình
BXH `GhostRankCycle` chuyển thẳng `RankInfo.score` sang giá trị hiển thị.
Không thấy phép tính chuyển đổi giữa hai trường trong các luồng này.
Client cache API BXH 10 giây; cache đó không giải thích được số lệch trong
các request trực tiếp tới server qua nhiều session. `GhostWarBattleMgr`
nhận `AOIMemberInfo.feat` từ server, không tự tính tổng chiến công từ HP.

Chưa có code server nên chưa xác định được nguyên nhân cập nhật/tổng kết
hay sai lệch phía server. Các giả thuyết như BXH chốt sớm, bỏ sót lần cộng
cuối, hoặc tính HP đánh lính khác với đánh người **chưa được xác minh**.
Không dùng chúng làm mô tả cơ chế chính thức.

## Collector dùng lại và kiểm tra độ phủ

Lệnh chạy: xem [README.BE.md](../../README.BE.md#mode-3--doomday-doomday_socket).
`tools/socket_log/doomday_socket/crawler.py` gom context, BXH cá nhân/guild,
briefs và tùy chọn `--feats` để join chiến công theo ID vào `summary.json`.

Chạy live ngày 9/11/2026 với nhân vật ChongHữuThái (S545): nhận 100 dòng
cá nhân, 72 dòng guild; giải được toàn bộ tên. Hỏi chiến trường theo lô
40 ID, nhận đủ 101/101 người (100 dòng BXH và chính mình), tất cả có `feat`.
Cá nhân đang hạng 1387 nên không nằm trong top 100; `selfFeat = 300.000`
khớp API chiến trường trong khi `selfPlayer.score = 100.000`.
Đây là độ phủ của lượt trả lời này, không khẳng định API lấy được mọi người
tham gia hoặc giữ nguyên điều kiện truy vấn ở mùa sau.
