import { create } from "zustand";
import { dayLabel } from "../data/eventCalendar";
import { nodeBossesOf } from "../data/nodeBosses";
import { hasSnapshot, loadSnapshot } from "../data/snapshots";
import { buildMapData, type MapData } from "../domain/mapData";
import { historyDays, validateHistoryDump } from "../domain/historyPlayback";
import { acquireHistoryDataset, today, useDataset } from "./dataset";
import { showToast } from "./toast";

export interface HistoryFrame {
  day: string;
  data: MapData;
}
interface HistoryState {
  status: "idle" | "loading" | "playing" | "paused" | "ended";
  frames: HistoryFrame[];
  missing: string[];
  index: number;
  duration: number;
  elapsed: number;
  metrics?: { p95: number; frames: number; slow: number };
}

export const useHistoryPlayback = create<HistoryState>()(() => ({
  status: "idle",
  frames: [],
  missing: [],
  index: 0,
  duration: 3000,
  elapsed: 0,
}));

let lease: ReturnType<typeof acquireHistoryDataset> | undefined;
let context: { server: string; round: string } | undefined;

export function stopHistory() {
  lease?.release();
  lease = undefined;
  context = undefined;
  useHistoryPlayback.setState({
    status: "idle",
    frames: [],
    index: 0,
    elapsed: 0,
  });
}

export async function startHistory() {
  if (useDataset.getState().loading) return;
  stopHistory();
  const { server, round } = useDataset.getState();
  const playlist = historyDays(round, today(), (day) =>
    hasSnapshot(day, server)
  );
  if (playlist.days.length < 2) {
    showToast("info", "Cần ít nhất 2 bản lưu trong cùng đợt để phát");
    return;
  }
  const session = acquireHistoryDataset(stopHistory);
  lease = session;
  context = { server, round };
  useHistoryPlayback.setState({
    status: "loading",
    missing: playlist.missing,
    metrics: undefined,
  });
  try {
    const dumps = await Promise.all(
      playlist.days.map((day) => loadSnapshot(day, server))
    );
    if (!session.valid()) return;
    const mappings = dumps.map((dump) =>
      validateHistoryDump(dump, server, round)
    );
    if (mappings.some((mapping) => mapping !== mappings[0]))
      throw new Error("Ánh xạ căn cứ thay đổi giữa các bản lưu");
    const frames = dumps.map((dump, i) => ({
      day: playlist.days[i],
      data: buildMapData(dump, nodeBossesOf(server, round)),
    }));
    session.commit(server, round, frames[0].day, frames[0].data);
    useHistoryPlayback.setState({
      frames,
      index: 0,
      elapsed: 0,
      status: document.hidden ? "paused" : "playing",
    });
  } catch (error) {
    if (!session.valid()) return;
    stopHistory();
    showToast(
      "error",
      `Không phát được lịch sử: ${error instanceof Error ? error.message : "lỗi bản lưu"}`
    );
  }
}

export function toggleHistory() {
  const { status } = useHistoryPlayback.getState();
  if (status === "playing") useHistoryPlayback.setState({ status: "paused" });
  else if (status === "paused")
    useHistoryPlayback.setState({ status: "playing" });
  else if (status !== "loading") void startHistory();
}

export function completeHistorySlot() {
  const state = useHistoryPlayback.getState();
  const target = state.frames[state.index];
  if (!lease?.valid() || !context || !target) return;
  lease.commit(context.server, context.round, target.day, target.data);
  if (state.index === state.frames.length - 1) {
    useHistoryPlayback.setState({ status: "ended", elapsed: state.duration });
  } else useHistoryPlayback.setState({ index: state.index + 1, elapsed: 0 });
}

export function inspectHistory() {
  const state = useHistoryPlayback.getState();
  const target = state.frames[state.index];
  if (lease?.valid() && context && target)
    lease.commit(context.server, context.round, target.day, target.data);
  stopHistory();
}

export function historyLabel(state: HistoryState) {
  if (state.status === "loading") return "Đang tải bản lưu…";
  const to = state.frames[state.index];
  if (!to) return "";
  if (state.status === "ended") return `Đã phát hết · ${dayLabel(to.day)}`;
  const from = state.frames[state.index - 1];
  const gap =
    from && state.missing.some((day) => day > from.day && day < to.day);
  return `${from ? `${dayLabel(from.day)} → ` : "Căn cứ → "}${dayLabel(to.day)} · ${state.index + 1}/${state.frames.length}${gap ? " · thiếu ngày ở giữa" : ""}${state.status === "paused" ? " · tạm dừng" : ""}`;
}
