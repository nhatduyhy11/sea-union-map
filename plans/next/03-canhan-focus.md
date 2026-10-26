# 03 — Tab Cá nhân accordion + vai focus

Mô hình tương tác chung xem `../NEXT_SPEC.md`. Chốt phân vai camera: Cứ điểm
là nơi duy nhất focus đảo.

## Mục tiêu

Tab Cá nhân vào cùng mô hình accordion = filter với tab Phe; camera chỉ phản
hội tab Cứ điểm.

## Scope

- **Tab Cá nhân** — accordion, một player mở tại một thời điểm; player được
  mở chính là filter canvas (cùng một logic filter với member-click ở tab
  Phe — một logic, hai đường bấm UI). Đảo trong expand thành row tĩnh
  (liệt kê + điểm, bỏ focus).
- **Tab Cứ điểm** — mở expand của một đảo = focus đảo trên map: camera pan +
  đảo thành selected (highlight node). Panel **giữ nguyên ở bảng** — không
  `setTab("node")` như `focusIsland` hiện tại (owner chốt 2026-10-26: BXH xoay
  quanh highlight node; muốn NodeDetails thì tự bấm tab Cứ điểm của panel).
  Bỏ nút "Xem đảo trên map"; chỉ focus khi toggle mở, không focus khi đóng.
- **Reset view** áp dụng như tab Phe — đổi tab BXH / rời ranking / collapse →
  filter `all` + đóng expansion.

## Phụ thuộc

- **01** (filter engine: filter player + command reset). Nên làm sau 02 để
  hai tab drill-down đi cùng một nhịp UX, nhưng code độc lập với 02.
