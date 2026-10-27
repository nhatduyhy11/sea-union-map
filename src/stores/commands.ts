// Cross-slice commands — tương tác người dùng chạm nhiều store cùng lúc.
// Gọi qua getState() để là hàm thuần (tham chiếu ổn, dùng được trong useMemo
// mà không cần thêm vào dependency).
import { useMapView } from "./mapView";
import { usePanel, type MapTab, type RankingBoard } from "./panel";
import { useSelection } from "./selection";
import type { MapFilter } from "../types";

// Mở đảo từ canvas: bật chi tiết + kéo panel về tab cứ điểm. Rời ranking
// (nếu đang ở đó) cũng reset view BXH.
export function openIsland(id: string) {
  useSelection.getState().open(id);
  setPanelTab("node");
}

// Đổi tab panel: đi khỏi ranking thì reset view BXH (filter all + đóng hết
// expansion). Vào/tiếp tục tab khác không đụng gì.
export function setPanelTab(tab: MapTab) {
  if (usePanel.getState().tab === "ranking" && tab !== "ranking")
    resetRankingView();
  usePanel.getState().setTab(tab);
}

// Đổi board BXH: reset view — mỗi tab drill-down bắt đầu từ all, đóng hết.
export function setRankingBoard(board: RankingBoard) {
  if (usePanel.getState().board !== board) resetRankingView();
  usePanel.getState().setBoard(board);
}

// Reset view BXH: filter canvas về all + đóng hết expansion. filterMode giữ
// nguyên (state panel, không reset theo view).
export function resetRankingView() {
  useMapView.getState().resetFilter();
  const panel = usePanel.getState();
  panel.setOpenGuild(null);
  panel.setSelectedMember(null);
  panel.setOpenPlayer(null);
  panel.setOpenFaction(null);
}

// Filter guild/player của canvas — nguồn chân lý là BXH (accordion đang mở),
// command ở đây để chip ✕ và các nhịp reset view về sau dùng chung tham chiếu.
export function setCanvasFilter(filter: MapFilter | null) {
  useMapView.getState().setFilter(filter);
}

export function toggleCanvasFilter(filter: MapFilter) {
  useMapView.getState().toggleFilter(filter);
}

export function resetCanvasFilter() {
  useMapView.getState().resetFilter();
}

// Bật/tắt Filter mode: tắt = BXH thuần đọc, canvas reset về all.
export function setFilterMode(on: boolean) {
  usePanel.getState().setFilterMode(on);
  if (!on) resetRankingView();
}

// Mở/đóng guild ở tab Phe (filter mode): guild mở chính là filter canvas;
// collapse guild đang mở = gỡ filter + thu gọn accordion, giữ nguyên faction
// đang mở và các trạng thái khác của BXH (không reset view toàn phần).
export function toggleGuildFilter(guild: string) {
  if (usePanel.getState().openGuild === guild) {
    const panel = usePanel.getState();
    panel.setOpenGuild(null);
    panel.setSelectedMember(null);
    setCanvasFilter(null);
    return;
  }
  const panel = usePanel.getState();
  panel.setOpenGuild(guild);
  panel.setSelectedMember(null);
  setCanvasFilter({ kind: "guild", id: guild });
}

// Click thành viên trong guild đang mở: chọn → filter player; chọn lại →
// về filter guild cha. Guild vẫn mở.
export function selectGuildMember(guild: string, member: string) {
  const panel = usePanel.getState();
  if (panel.selectedMember === member) {
    panel.setSelectedMember(null);
    setCanvasFilter({ kind: "guild", id: guild });
  } else {
    panel.setSelectedMember(member);
    setCanvasFilter({ kind: "player", id: member });
  }
}

// Mở/đóng faction row — thuần view (accordion một faction tại một thời điểm,
// không filter). Ngoại lệ: thao tác làm guild đang mở biến mất khỏi view
// (đóng faction chứa nó, hoặc mở faction khác) → reset view toàn phần.
export function toggleFactionView(factionId: string, guildNames: string[]) {
  const panel = usePanel.getState();
  const orphansGuild =
    panel.openGuild !== null && guildNames.includes(panel.openGuild);
  if (orphansGuild) {
    resetRankingView();
    if (panel.openFaction !== factionId) panel.setOpenFaction(factionId);
    return;
  }
  panel.setOpenFaction(panel.openFaction === factionId ? null : factionId);
}

// Mở/đóng player ở tab Cá nhân (filter mode): cùng một logic filter với
// member-click ở tab Phe — mở = filter player, collapse = reset view.
export function togglePlayerFilter(playerId: string) {
  if (usePanel.getState().openPlayer === playerId) {
    resetRankingView();
    return;
  }
  const panel = usePanel.getState();
  panel.setOpenPlayer(playerId);
  panel.setSelectedMember(null);
  setCanvasFilter({ kind: "player", id: playerId });
}
