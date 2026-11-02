# Canvas Icons — Mô hình tập điểm phe và quy ước icon cứ điểm

## 1. Phạm vi tài liệu

Mô hình tập điểm của một phe và quy ước icon canvas. Tài liệu chỉ giữ quy ước hiện tại; khi thay
đổi, cập nhật trực tiếp nội dung, không lưu log thảo luận hay quyết định cũ.

Đây là tài liệu quy tắc chuẩn. [Bản HTML tương tác](CANVAS_ICONS.html) minh họa
phân loại tại một node bằng điểm giả lập; hình và màu minh họa không thay thế
quy ước hiển thị ở §4. Khi đổi quy tắc, cập nhật cả bản mô phỏng HTML.

## 2. Mô hình tập điểm của một phe

Mô hình và icon dùng điểm từng phe tại từng node do server trả về qua
`nodeFactionScores`, cùng owner server và ngưỡng claim của node. Mặt bằng
`mean`/`median` tính từ điểm trên tập node claimable của từng phe (§3),
không dùng tổng điểm BXH hay tổng điểm player trong node-board.

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
  outbid là thua điểm thuần túy. Cả hai không có icon riêng; node vẫn phân
  loại theo cây quyết định ở §4.
- Trên BXH Phe, ba cột **Đảo chiếm | Đủ điểm | Đánh** lần lượt là
  |O| / |A| / |P|; label ở hàng trên, giá trị ở hàng dưới.
  `claimable` chỉ xét điểm > 0 và đủ ngưỡng, không xét connection.
  `touched` là tập cha gồm mọi node phe có điểm > 0, kể cả node đang chiếm
  có điểm. Base được own mặc định nhưng 0 điểm không thuộc hai tập này.
- Node trung lập có phe claimable thì mọi phe claimable đều đang bị cắt
  đường: phe claimable còn nối đường thì server đã cho phe đó own
  (SEA_EVENT_RULE §2), trừ hoà điểm (chưa gặp, đối chiếu SEA_EVENT_RULE §8).

## 3. Mặt bằng điểm của phe: trung bình và trung vị

Với mỗi phe X, xét tập giá trị `{ điểm X tại node n | n ∈ claimable(X) }`
(tính cả node bị cắt và node bị outbid):

```
mean(X)   = tổng điểm X trên các node claimable(X)  /  |claimable(X)|
median(X) = trung vị của cùng tập giá trị đó
```

- Chỉ cộng điểm trên node claimable. Điểm trên node `belowClaim` (đánh dở,
  đánh hụt) không vào tử số vì các node đó không nằm trong mẫu số — cộng vào
  sẽ đẩy mặt bằng lên cao giả.
- Nếu `|claimable(X)| = 0`, `mean(X)` và `median(X)` **chưa xác định**: bỏ
  qua điều kiện biceps/khiên của owner X, vẫn xét các icon khác. Không thay
  bằng 0 hay Infinity. Node có chủ (không phải base) thì owner luôn
  claimable, nên trường hợp này chỉ còn là phòng hờ snapshot lệch.

### Vì sao cần cả hai số

Phân phối điểm của một phe trên các node claimable **lệch phải**: đa số node
chỉ dồn quanh ngưỡng claim, vài node "nóng" (đánh qua lại nhiều lần, trung
tâm, giáp ranh) hút điểm gấp nhiều lần. Đuôi dài phía điểm cao kéo trung
bình lên, còn trung vị đứng yên ở mức của một node điển hình.

Ví dụ 10 node claimable: 8 node ~5M, 2 node 60M → `mean` = 16M, `median` = 5M.
Tỉ số `mean / median` (ở đây 3.2) cho biết phân phối lệch mạnh cỡ nào.

- **Trung vị** là mức của một node bình thường → mốc cho node **mỏng** (khiên).
- **Trung bình** đã bị đuôi kéo lên trên trung vị → vượt trung bình là thật
  sự đầu tư **đậm** (biceps).

## 4. Danh mục icon canvas

### Base — quy tắc tuyệt đối

Base luôn dùng một trong 4 icon đại diện phe: `ZodiacAries` (đông),
`Flame` (nam), `Sparkles` (bắc), `Snowflake` (tây). Quy tắc này được xét
đầu tiên và kết thúc phân loại tại đây.

### Cây quyết định cho các node còn lại

Ký hiệu tại node đang xét: `owner` là phe đang own; `top` là phe có điểm cao
nhất; `rival` là phe không own có điểm cao nhất (phe nhì). Điểm của phe X
tại node viết là `X.score`.

```
không owner
├─ không phe nào có điểm               → Anchor / Castle
├─ không phe nào đủ ngưỡng claim       → kiếm đơn
└─ có phe đủ ngưỡng claim
    ├─ mọi phe đủ ngưỡng bị cắt đường  → kéo
    └─ có phe đủ ngưỡng còn nối đường  → Anchor / Castle (fallback)
có owner, owner = top
├─ rival.score / owner.score ≥ 0.4
│   ├─ rival own ≥ 1 láng giềng        → kiếm chéo
│   └─ ngược lại                       → flag
└─ owner.score ≥ mean(owner)           → biceps
có owner, owner ≠ top   (top chắc chắn đang bị cắt đường)
├─ owner.score / top.score ≤ 0.3       → gift
└─ owner.score / top.score ≥ 0.4       → flag
còn lại (mọi nhánh có owner chưa ra icon)
├─ giáp láng giềng do phe khác own
│   và owner.score < median(owner)     → khiên
└─ ngược lại                           → trơn
```

### Node có chủ

| Icon                                    | Điều kiện                                                                                                                    | Ý nghĩa                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Kiếm chéo (Swords) + fill chocolate đậm | owner là top, rival ≥ 40% điểm owner, **và** rival own ít nhất một láng giềng                                                | đang giao tranh: phe nhì dồn điểm ngay cửa node                                                     |
| Flag (Flag)                    | (a) owner là top, rival ≥ 40% điểm owner nhưng **không** own láng giềng; hoặc (b) owner không phải top, owner ≥ 40% điểm top | vết tích một trận tranh chấp lớn: chiến trường đã đẩy sang node khác, điểm hai bên vẫn còn sát nhau |
| Biceps (BicepsFlexed)                   | owner là top, không thuộc hai icon trên, owner.score ≥ mean(owner)                                                           | owner đầu tư đậm hơn mặt bằng của chính phe mình                                                    |
| Gift (Gift)                             | owner không phải top, owner.score ≤ 30% top.score                                                                            | owner "ăn không": giữ node chỉ nhờ phe top bị cắt đường; nối lại đường là mất                       |
| Khiên (ShieldAlert) + fill màu phe nhạt | chưa ra icon nào ở trên, giáp láng giềng do phe khác own, owner.score < median(owner)                                        | đảo đang giữ mà điểm mỏng hơn một node bình thường của phe, ngay chỗ giáp miệng địch                |
| Trơn                                    | không thỏa điều kiện nào ở trên                                                                                              | không icon trạng thái, không fill trạng thái — chỉ còn tô màu phe chuẩn của lãnh thổ                |

- Thứ tự ưu tiên khi owner là top: **kiếm chéo / flag > biceps > khiên > trơn**.
  Kiếm chéo và flag (a) tự loại nhau theo việc rival có own láng giềng
  hay không.
- Thứ tự ưu tiên khi owner không phải top: **gift / flag > khiên > trơn**.
  Gift và flag (b) tự loại nhau theo ratio.
- **Khoảng trống `0.3 < owner/top < 0.4` là cố ý**: owner bị vượt điểm nhưng
  không đủ nghiêng hẳn về phía nào để gắn nhãn. Node rơi xuống xét khiên, nếu
  không đạt thì để trơn.
- "Láng giềng do phe khác own" chỉ tính node có owner khác owner hiện tại,
  không tính trung lập hay đầu route không tồn tại.

### Node trung lập (không ai owned) đã có điểm

| Icon             | Điều kiện                                      | Ý nghĩa                                                                                                                       |
| ---------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Kéo (Scissors)   | có ít nhất một phe đủ ngưỡng claim tại node    | node "đóng băng": có phe vượt ngưỡng nhưng điểm bị ngắt nên không ai được xét để claim — nối lại đường là node lập tức có chủ |
| Kiếm đơn (Sword) | node có điểm nhưng **không phe nào đủ ngưỡng** | đang tranh nhau dồn điểm, chưa ai chạm mốc                                                                                    |

- Hai case phủ kín và loại nhau theo có/không có phe claimable. Không xét
  effort.
- Nếu snapshot lệch làm node trung lập có phe claimable **còn nối đường**,
  giữ Anchor/Castle màu neutral làm fallback, không tự suy ra owner.

### Node chưa phe nào có điểm (chưa từng touch)

| Icon   | Điều kiện           | Ý nghĩa                     |
| ------ | ------------------- | --------------------------- |
| Anchor | đảo thường          | đảo hoang, chưa ai động tới |
| Castle | đảo trung tâm ("4") | trung tâm bản đồ            |

### Màu

- Node có chủ: màu icon theo **phe owner** với mọi icon. Fill theo màu
  owner, riêng kiếm chéo (chocolate đậm, quầng trắng mảnh để màu phe vẫn rõ)
  và khiên (màu phe nhạt) giữ fill trạng thái.
- Node trung lập: kéo và kiếm đơn dùng **màu neutral**, giữ nền trung lập.
  Popup điểm của node trung lập có phe đủ ngưỡng (node kéo) dùng nền sọc chéo
  màu phe điểm cao nhất.

## 5. Bộ tên trong code

| Khái niệm      | Tên          | Ghi chú                                                                               |
| -------------- | ------------ | ------------------------------------------------------------------------------------- |
| P              | `touched`    | chữ `attacked` cũ mô tả đúng tập này hơn là tập "đang đánh"                           |
| A              | `claimable`  |                                                                                       |
| B              | `belowClaim` | có điểm nhưng chưa đủ ngưỡng claim                                                    |
| O              | `owned`      | khớp field `islands` ("chiếm") trên BXH Phe                                           |
| C              | `blocked`    | hai nguyên nhân: `cutOff` / `outbid`                                                  |
| mặt bằng điểm  | `effort`     | per-faction `{ mean, median }` trên điểm các node claimable                           |
| node kéo       | `frozen`     | trung lập đóng băng vì mọi phe claimable bị cắt; nối lại đường thì điểm được xét tiếp |
| node kiếm đơn  | `belowClaim` | node có điểm nhưng chưa phe nào đủ ngưỡng; icon Sword 1 cây                           |
| node kiếm chéo | `frontline`  | rival ≥ 40% owner và own láng giềng                                                   |
| node flag | `aftermath`  | vết tích tranh chấp lớn; icon Flag                                                |
| node gift      | `gifted`     | owner ≤ 30% top, giữ node nhờ top bị cắt đường; icon Gift                             |
| node biceps    | `overbuilt`  | owner là top và ≥ mean(owner); icon BicepsFlexed                                      |
| node khiên     | `defend`     | giáp phe khác và < median(owner); icon ShieldAlert                                    |

## 6. Nguồn dữ liệu và triển khai

- Điểm từng node lấy từ `scoresForNode`: ưu tiên tổng phe server, fallback
  contributions khi dump thiếu tổng phe. `factionEfforts` tính
  `mean`/`median` của mỗi phe từ chính điểm từng node này, lọc theo ngưỡng
  claim của node — không dùng tổng điểm BXH.
- `frontlineNodes` dùng chung cho kiếm chéo và pill "Tranh chấp" trong BXH cứ
  điểm: ngưỡng áp lực 0.4, rival phải own một láng giềng.
- `canvasIcons` phân loại theo cây ở §4. Owner luôn lấy nguyên từ server;
  kiểm tra đường nối cho fallback kéo đi từ base qua các node cùng phe đến
  một láng giềng của node đích, không đi xuyên node trung lập hay phe khác.
- Renderer với node có chủ trơn bỏ cả Anchor/Castle,
  vẫn giữ khung node, màu phe, tương tác chọn/ghim và popup điểm.
