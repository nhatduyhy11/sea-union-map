// Thiết bị có con trỏ hover thật (chuột/trackpad). Màn cảm ứng (iOS) vẫn bắn
// mouseenter giả khi tap; nếu handler làm hiện nội dung mới (popup điểm),
// Safari coi tap đó chỉ là hover và nuốt click — phải tap lần hai mới mở node.
// Trên cảm ứng, popup đi theo node đang chọn thay cho hover.
export function canHover(): boolean {
  return window.matchMedia("(hover: hover)").matches;
}
