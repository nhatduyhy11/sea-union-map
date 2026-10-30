import { create } from "zustand";
import {
  EVENT_DAYS,
  battleCountdown,
  dayLabel,
  eventDayOf,
} from "../data/eventCalendar";
import { liveDump } from "../data/sea-live";
import {
  LIVE_SERVER,
  hasSnapshot,
  latestSnapshotDay,
  loadSnapshot,
} from "../data/snapshots";
import { buildMapData, type MapData } from "../domain/mapData";
import { resetRankingView } from "./commands";
import { showToast } from "./toast";

// Bộ dữ liệu đang xem: cụm server × ngày event. Mọi tab (canvas, BXH phe /
// cá nhân / cứ điểm, chi tiết node) đọc data qua useMapData() nên đổi cụm /
// ngày là cả UI render lại theo bộ mới.
//
// Nguồn: ngày hiện tại + LIVE_SERVER → live dump, trừ khi ngoài khung chiến
// trường (10:00~22:00) mà ngày đó đã có snapshot — snapshot chốt sau war là
// bản đầy đủ nhất, live dump có thể bake giữa war → ưu tiên snapshot, không
// có mới dùng live; còn lại → snapshot
// src/data/snapshots/<day>/<server>.json. Cụm khác LIVE_SERVER ở ngày hiện
// tại chưa hỗ trợ live → fallback snapshot gần nhất của cụm đó.
export type DataSource = "live" | "snapshot";

interface DatasetState {
  server: string;
  // null = đang xem live ngoài lịch event (trước/sau 7 ngày event).
  day: string | null;
  source: DataSource;
  data: MapData;
  loading: boolean;
}

const liveData = buildMapData(liveDump);

export const today = () => eventDayOf(new Date());
const inEvent = (day: string) =>
  (EVENT_DAYS as readonly string[]).includes(day);

export const useDataset = create<DatasetState>()(() => ({
  server: LIVE_SERVER,
  day: inEvent(today()) ? today() : null,
  source: "live",
  data: liveData,
  loading: false,
}));

export const useMapData = () => useDataset((state) => state.data);

// Đọc ngoài React (command/callback) — luôn là bản đang hiển thị.
export const currentMapData = () => useDataset.getState().data;

// Re-resolve nguồn của bộ (cụm, ngày) đang xem theo đồng hồ: ngoài khung chiến
// trường today + LIVE_SERVER ưu tiên snapshot hôm nay (xem resolve). Chỉ đụng
// khi đang xem đúng ngày hiện tại mà nguồn đang hiển thị khác nguồn resolve
// yêu cầu — mở trang lúc 22:05 hay vừa qua mốc 22:00/10:00 đều tự chỉnh; đang
// xem ngày cũ thì bỏ qua, không giật người dùng khỏi lịch sử.
export function syncSourceWithClock() {
  const { server, day, source } = useDataset.getState();
  if (day === null || day !== today()) return;
  const want = resolve(server, day);
  if (want && want !== source) void apply(server, day, want);
}

// Nguồn của (cụm, ngày) nếu có data; null = không có.
function resolve(server: string, day: string): DataSource | null {
  if (day === today() && server === LIVE_SERVER) {
    // Ngoài khung chiến trường (kể cả sau khi event kết thúc) snapshot của
    // ngày hiện tại là bản chốt sau war → ưu tiên hơn live dump.
    if (battleCountdown(new Date()).phase !== "open" && hasSnapshot(day, server))
      return "snapshot";
    return "live";
  }
  return hasSnapshot(day, server) ? "snapshot" : null;
}

// Token chống race: click nhanh nhiều ngày thì chỉ response cuối được áp.
let requestId = 0;

async function apply(server: string, day: string, source: DataSource) {
  const id = ++requestId;
  if (source === "live") {
    useDataset.setState({
      server,
      day,
      source,
      data: liveData,
      loading: false,
    });
    return;
  }
  useDataset.setState({ loading: true });
  try {
    const data = buildMapData(await loadSnapshot(day, server));
    if (id !== requestId) return;
    useDataset.setState({ server, day, source, data, loading: false });
  } catch (error) {
    if (id !== requestId) return;
    useDataset.setState({ loading: false });
    console.error(error);
    showToast(
      "error",
      `Không tải được snapshot ${dayLabel(day)} của cụm ${server}`
    );
  }
}

// Fallback khi (cụm, ngày) không có data: snapshot gần nhất tới hôm nay.
function applyLatest(server: string, reason: string) {
  const fallback = latestSnapshotDay(server, today());
  if (!fallback) {
    showToast("error", `Cụm ${server} chưa có snapshot nào`);
    return false;
  }
  showToast("info", `${reason} — đang xem snapshot ${dayLabel(fallback)}`);
  void apply(server, fallback, "snapshot");
  return true;
}

// Click nút ngày (thanh snapshot dưới canvas). Ngày chưa tới bị disable ở UI;
// ngày thiếu snapshot → toast lỗi, giữ nguyên màn hình hiện tại.
export function selectDay(day: string) {
  const { server } = useDataset.getState();
  if (day > today()) return;
  const source = resolve(server, day);
  if (source) {
    void apply(server, day, source);
    return;
  }
  if (day === today()) {
    applyLatest(server, `Cụm ${server} chưa hỗ trợ data ngày hiện tại`);
    return;
  }
  showToast(
    "error",
    `Lịch sử lưu bị thiếu: chưa có snapshot ${dayLabel(day)} của cụm ${server}`
  );
}

// Đổi cụm (cạnh tiêu đề map): giữ ngày đang xem nếu cụm mới có data ngày đó,
// không thì fallback (LIVE_SERVER → live hôm nay; cụm khác → snapshot gần
// nhất). Filter BXH theo guild/player của cụm cũ không còn nghĩa → reset view.
export function selectServer(server: string) {
  const state = useDataset.getState();
  if (state.server === server) return;
  const day = state.day ?? today();
  const source = resolve(server, day);
  if (source) void apply(server, day, source);
  else if (server === LIVE_SERVER && inEvent(today()))
    void apply(server, today(), "live");
  else if (
    !applyLatest(server, `Cụm ${server} chưa có data ngày ${dayLabel(day)}`)
  )
    return;
  resetRankingView();
}
