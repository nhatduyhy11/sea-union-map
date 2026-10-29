import { create } from "zustand";
import { showToast } from "./toast";

// In-game id của dev — watermark header và easter egg BXH cá nhân dùng chung.
export const EASTER_EGG_PLAYER_ID = "51921435";

// State phục vụ debug/tinh chỉnh giao diện trong môi trường DEV.
// Tách khỏi mapView để giữ mapView thuần lọc/hiển thị bản đồ cho người dùng.
interface DebugState {
  // Overlay dev (tâm node, trục giữa) — nút bật chỉ tồn tại ở DEV.
  debug: boolean;
  // Màu nền canvas — chỉnh qua color picker debug (DEV hoặc easter egg), có thể
  // mang alpha #rrggbbaa; prod chạy nguyên giá trị mặc định.
  canvasBg: string;
  // Màu chung nhóm trung lập (edge không thuộc phe + đảo chưa chiếm) — cùng
  // cơ chế picker debug như canvasBg. Opacity 0..1 áp chung cả nhóm.
  neutralColor: string;
  neutralOpacity: number;
  // Easter egg mở 2 picker màu ở prod (nút debug tâm node vẫn chỉ DEV).
  // Không persist — F5 là khóa lại.
  paletteUnlocked: boolean;
  toggleDebug: () => void;
  setCanvasBg: (bg: string) => void;
  setNeutralColor: (color: string) => void;
  setNeutralOpacity: (opacity: number) => void;
}

export const useDebug = create<DebugState>()((set) => ({
  debug: false,
  canvasBg: "#fefdfa",
  neutralColor: "#9caeb9",
  neutralOpacity: 0.4,
  paletteUnlocked: false,
  toggleDebug: () => set((state) => ({ debug: !state.debug })),
  setCanvasBg: (canvasBg) => set({ canvasBg }),
  setNeutralColor: (neutralColor) => set({ neutralColor }),
  setNeutralOpacity: (neutralOpacity) => set({ neutralOpacity }),
}));

// Click liên tiếp (cách nhau < TAP_GAP_MS) vào dòng EASTER_EGG_PLAYER_ID trên
// BXH cá nhân: hơn 5 lần thì mở khóa picker màu. Chỉ là biến đếm module-level
// — không listener toàn cục.
const UNLOCK_TAPS = 6;
const TAP_GAP_MS = 1500;
let taps = 0;
let lastTapAt = 0;

export function tapEasterEgg() {
  if (useDebug.getState().paletteUnlocked) return;
  const now = Date.now();
  taps = now - lastTapAt < TAP_GAP_MS ? taps + 1 : 1;
  lastTapAt = now;
  if (taps < UNLOCK_TAPS) return;
  useDebug.setState({ paletteUnlocked: true });
  showToast("info", "🎨 HUNTERS mode — đã mở khóa bảng chỉnh màu");
}
