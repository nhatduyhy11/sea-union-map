# Canvas Icons — Mô hình tập điểm phe và quy ước icon cứ điểm

## 1. Phạm vi tài liệu

Mô hình tập điểm của một phe và quy ước icon canvas. Các quy ước bên dưới đã triển khai. Tài liệu chỉ giữ quy ước hiện tại; khi thay
đổi, cập nhật trực tiếp nội dung, không lưu log thảo luận hay quyết định cũ.

## 2. Mô hình tập điểm của một phe

Server trả về điểm của đủ 4 phe tại mỗi node (node state `0x72/0x0012`, dump
`nodeFactionScores` — xem [SEA_STATS_RECONCILE.md](sea/SEA_STATS_RECONCILE.md)),
và tổng điểm một phe trên mọi node phải bằng Điểm phe trên BXH (số server, bộ
guild rows `0x72/0x0025`). Độ lệch đo đạc giữa các nguồn tổng điểm theo dõi ở
SEA_STATS_RECONCILE, không lặp lại ở đây.

Với một phe X, các tập node phân cấp:

```
P  touched      mọi node X có điểm (đã từng tấn công / dồn điểm)
├─ A  claimable  đủ ngưỡng claim của node (thuần điểm, KỂ CẢ bị cắt đường)
│   ├─ O  owned    X đang là owner thật
│   └─ C  blocked  đủ ngưỡng nhưng không own
│       ├─ cutOff   do bị cắt đường (SEA_EVENT_RULE §4 — điểm bị tạm ngắt)
│       └─ outbid   do phe khác cùng đủ ngưỡng có điểm cao hơn (SEA_EVENT_RULE §2)
└─ B  belowClaim chưa đủ ngưỡng claim
```

- Sơ đồ phân cấp áp dụng cho node thường có điểm. **Base là ngoại lệ**:
  được own mặc định dù 0 điểm, vẫn tính vào `owned`/Đảo chiếm nhưng không
  thuộc `touched` hay `claimable` khi không có điểm.
- `claimable` cố tình **không xét đường nối** — connectivity chỉ quyết định
  điểm có được xét cho ownership hay không (SEA_EVENT_RULE §3, §4), không quyết định việc
  đủ/chưa đủ ngưỡng.
- `blocked · cutOff` và `blocked · outbid` phân biệt bằng **nguyên nhân mất
  owner**: cắt đường là mất tạm do kết nối (không phải thua tranh chấp);
  outbid là thua điểm thuần túy. `outbid` không cần icon riêng: node vẫn xét các điều kiện trạng thái ở §4.
- Trên BXH Phe, ba cột **Đảo chiếm | Đủ điểm | Đánh** lần lượt là
  |O| / |A| / |P|; label ở hàng trên, giá trị ở hàng dưới.
  `claimable` chỉ xét điểm > 0 và đủ ngưỡng, không xét connection.
  `touched` là tập cha gồm mọi node phe có điểm > 0, kể cả node đang chiếm
  có điểm. Base được own mặc định nhưng 0 điểm không thuộc hai tập này.
- Phân loại icon theo **trạng thái node**: node chưa ai owned chỉ có thể rơi
  vào kéo hoặc kiếm đơn (§4) — nếu có phe claimable còn nối đường thì server
  đã cho phe đó own (SEA_EVENT_RULE §2), trừ hoà điểm (chưa gặp, đối chiếu SEA_EVENT_RULE §8). Node owned
  dùng kiếm/khiên/gift/biceps/trơn.

## 3. Mức effort trung bình

```
effort(X) = Điểm phe X trên BXH  /  |claimable(X)|   (tính cả node bị cắt)
```

- Dùng **toàn bộ điểm phe** ở tử số cho dễ nhẩm — đúng ra phải
  là tổng điểm chỉ trên các node claimable; sai số chấp nhận được và về phía
  cao (thiên về "đang bỏ nhiều").
- Nếu `|claimable(X)| = 0` hoặc tổng điểm BXH không dương, `effort(X)`
  **chưa xác định**. Bỏ qua điều kiện khiên/biceps của owner X và điều kiện
  gift dựa trên effort X; vẫn xét các icon khác. Không thay bằng 0 hay Infinity.
- Ý nghĩa: mặt bằng điểm phe X bỏ ra cho một node. Đây là mốc động cho việc xét node cần thủ, phản ánh mặt bằng của từng phe.
- Thang đọc trạng thái node owned theo điểm phe owner X tại node:

| Điểm X tại node            | Ý nghĩa                                                                         |
| -------------------------- | ------------------------------------------------------------------------------- |
| `< effort`                 | mỏng — dưới mặt bằng phe mình (ứng viên cần thủ, icon khiên)                    |
| `effort ≤ điểm < 3×effort` | chưa đạt ngưỡng biceps; xét các điều kiện khác ở §4, nếu không có thì node trơn |
| `≥ 3×effort`               | owner đầu tư đậm — ứng viên biceps (§4)                                         |

Gift xét riêng điểm của **đối thủ bị cắt** ở ngưỡng `≥ 2×effort` của đối
thủ đó; không suy ra gift từ band điểm của owner.

Node trung lập không dùng effort — kéo và kiếm đơn phân loại theo tính
claimable của các phe có mặt (§4).

## 4. Danh mục icon canvas

### Node chưa phe nào có điểm (chưa từng touch)

| Icon     | Điều kiện           | Ý nghĩa                       | Trạng thái |
| -------- | ------------------- | ----------------------------- | ---------- |
| Icon phe | node base           | lãnh thổ gốc, luôn giữ nguyên | đã làm     |
| Anchor   | đảo thường          | đảo hoang, chưa ai động tới   | đã làm     |
| Castle   | đảo trung tâm ("4") | trung tâm bản đồ              | đã làm     |

### Node trung lập (không ai owned) đã có điểm

| Icon             | Điều kiện                                                                                | Ý nghĩa                                                                                                                         | Trạng thái |
| ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Kéo (Scissors)   | mọi phe đủ ngưỡng claim tại node đều **bị cắt đường** (`cutOff`)                         | node "đóng băng": có người vượt ngưỡng nhưng điểm bị ngắt nên không ai được xét để claim — nối lại đường là node lập tức có chủ | đã làm     |
| Kiếm đơn (Sword) | node có điểm nhưng **không phe nào đủ ngưỡng claim** (mọi phe có mặt thuộc `belowClaim`) | đang tranh nhau dồn điểm, chưa ai chạm mốc                                                                                      | đã làm     |

Với snapshot nhất quán và không có hòa điểm, hai case phủ kín và loại nhau: kéo đòi có ít nhất một phe claimable, kiếm đơn
đòi không có phe nào claimable. Kéo **không đòi ngưỡng effort** — đánh dấu
mọi node đóng băng (khác với gift bên dưới vẫn giữ ≥ 2×effort).

Nếu node trung lập có phe claimable **còn nối đường** nhưng server vẫn chưa
cho own (hòa điểm hoặc snapshot lệch), giữ Anchor/Castle màu neutral làm
fallback. Không gắn kéo/kiếm đơn sai điều kiện và không tự suy ra owner.

### Node owned

| Icon                                    | Điều kiện                                                                                                                                      | Ý nghĩa                                                                                  | Trạng thái                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Kiếm chéo (Swords) + fill chocolate đậm | node giao tranh: phe nhì dồn ≥ 36% điểm phe claim tại node **và** phe nhì owns ít nhất một láng giềng (`frontlineNodes`)                       | phe claim đang bị dồn điểm ngay cửa node                                                 | đã làm — canvas, icon kiếm + pill "Tranh chấp" trong BXH cứ điểm |
| Khiên (ShieldAlert) + fill màu phe nhạt | node owned, điểm owner **mỏng** (< effort phe owner), giáp ranh phe khác, loại node đang giao tranh và base                                    | đảo đang giữ mà điểm mỏng chỗ giáp miệng địch                                            | đã làm                                                           |
| Gift (Gift)                             | node owned bởi phe Y nhưng **Y giữ nhờ cắt đường**: tồn tại phe X claimable-bị-cắt tại node với X.score ≥ 2×effort(X) **và** X.score > Y.score | effort gấp đôi mặt bằng của X đang bị Y "ăn nhờ" — nếu không bị ngắt, X đủ điểm vượt mặt | đã làm                                                           |
| Biceps (BicepsFlexed)                   | node owned, owner.score ≥ 3×effort(owner) **và không có** đối thủ bị cắt nào đứng trên owner                                                   | owner bỏ nhiều effort hơn mức cần thiết — tự mình đầu tư đậm, không phải nhờ ai          | đã làm                                                           |
| Trơn                                    | node owned không được chọn icon đặc biệt theo thứ tự ưu tiên                                                                                   | không icon trạng thái, không fill trạng thái — chỉ còn tô màu phe chuẩn của lãnh thổ     | đã làm                                                           |

### Màu và thứ tự ưu tiên

- Node owned: màu icon theo **phe owner**, kể cả gift và biceps. Fill theo
  màu owner, riêng kiếm chéo/khiên giữ kiểu fill trạng thái trong bảng trên.
  Kiếm chéo có quầng trắng mảnh để màu phe vẫn rõ trên nền chocolate.
- Node trung lập: kéo và kiếm đơn dùng **màu neutral**, giữ nền trung lập.
  Không chọn màu theo phe có điểm tại node, kể cả khi nhiều phe bị cắt.
- Kéo/kiếm đơn chỉ trên node trung lập, tự loại nhau theo có/không có phe
  claimable. Kéo không có ngưỡng effort; gift giữ ngưỡng `≥ 2×effort`.
- Gift và biceps tự loại nhau: gift cần đối thủ bị cắt có điểm cao hơn owner;
  biceps yêu cầu không có đối thủ bị cắt đứng trên owner.
- Khiên và gift có thể cùng đủ điều kiện vì xét điểm của hai phe khác nhau.
  Khi đó khiên thắng theo thứ tự ưu tiên. Khiên và biceps tự loại nhau theo
  điểm owner (`< effort` và `≥ 3×effort`).
- Base luôn giữ icon phe.

Thứ tự ưu tiên trên node owned: **kiếm chéo > khiên > gift / biceps > trơn**.

`blocked · outbid` không có icon riêng: nếu thỏa điều kiện giao tranh thì
hiện kiếm chéo; nếu owner đầu tư `≥ 3×effort` và thỏa điều kiện biceps thì
hiện biceps, vẫn theo thứ tự ưu tiên trên. Đủ ngưỡng nhưng thua điểm tự nó
không tạo thêm trạng thái icon.

Đối thủ bị cắt có điểm cao hơn owner nhưng chưa đạt `2×effort` không tạo
gift. Nếu node không thỏa điều kiện icon đặc biệt nào khác thì để trơn.

## 5. Bộ tên trong code

| Khái niệm     | Tên          | Ghi chú                                                                               |
| ------------- | ------------ | ------------------------------------------------------------------------------------- |
| P             | `touched`    | chữ `attacked` cũ mô tả đúng tập này hơn là tập "đang đánh"                           |
| A             | `claimable`  |                                                                                       |
| B             | `belowClaim` | có điểm nhưng chưa đủ ngưỡng claim                                                    |
| O             | `owned`      | khớp field `islands` ("chiếm") trên BXH Phe                                           |
| C             | `blocked`    | hai nguyên nhân: `cutOff` / `outbid`                                                  |
| effort        | `effort`     | per-faction, tính từ điểm BXH chia \|claimable\|                                      |
| node kéo      | `frozen`     | trung lập đóng băng vì mọi phe claimable bị cắt; nối lại đường thì điểm được xét tiếp |
| node kiếm đơn | `belowClaim` | node có điểm nhưng chưa phe nào đủ ngưỡng; icon Sword 1 cây                           |
| node gift     | `gifted`     | "được tặng node nhờ cắt đường"; icon Gift                                             |
| node biceps   | `overbuilt`  | owner đầu tư ≥ 3×effort; icon BicepsFlexed                                            |

## 6. Nguồn dữ liệu và triển khai

- `factionEfforts` lấy tổng điểm và số claimable từ cùng dữ liệu BXH Phe.
  Điểm từng node lấy từ `scoresForNode`: ưu tiên tổng phe server, fallback
  contributions cho dump cũ thiếu tổng phe.
- `canvasIcons` phân loại trạng thái theo thứ tự ở §4. Với kéo/gift/biceps,
  kiểm tra đường nối từ base qua các node owner cùng phe đến một láng giềng
  của node đích; không đi xuyên qua node trung lập hay phe khác. Kiểm tra
  này chỉ phục vụ icon, không tính lại hay thay đổi owner server.
- Kiếm chéo giữ quy tắc `frontlineNodes`: phe nhì là phe không own có điểm
  cao nhất; chính phe đó phải own một láng giềng. Khiên xét láng giềng có
  owner phe khác, không tính trung lập hay đầu route không tồn tại.
- Renderer giữ icon phe trên base; node owned trơn bỏ cả Anchor/Castle,
  vẫn giữ khung node, màu phe, tương tác chọn/ghim và popup điểm.
