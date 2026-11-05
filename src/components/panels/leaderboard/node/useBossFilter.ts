import { useMemo, useState } from "react";
import { KNOWN_BOSS_IDS } from "../../../../data/nodeBosses";
import type { NodeBoardEntry } from "../../../../domain/selectors/board/types";

export type BossOption = { id: number; count: number };

// Boss của cứ điểm; căn cứ không bị đánh nên không tính boss.
const bossOf = (entry: NodeBoardEntry) =>
  entry.island.base ? undefined : entry.island.monsterId;

// Lọc boss trên tập `candidates` (cứ điểm còn lại sau các bộ lọc trước, vd
// pill phe / trạng thái); `nodes` là toàn map, chỉ để biết map có boss nào.
// Lưới boss và số đếm tính trên `candidates`: boss không còn cứ điểm nào thì
// khoá. Boss đã chọn mà `candidates` mới loại hết thì tạm bỏ qua (candidates
// có lại thì vẫn còn chọn); bấm boss thì tính trên tập hiệu lực nên các boss
// đang bị ẩn đó bị bỏ hẳn. Tập hiệu lực rỗng = không lọc, chọn đủ mọi boss
// còn khả dụng cũng quy về rỗng. State local, rời board là reset.
export function useBossFilter(
  nodes: NodeBoardEntry[],
  candidates: NodeBoardEntry[]
) {
  const [bossIds, setBossIds] = useState<ReadonlySet<number>>(new Set());
  // Mọi boss đã biết + boss lạ có trên map, theo monsterId tăng dần, kèm số
  // cứ điểm mang boss đó trong `candidates`; count 0 = không chọn được.
  const options = useMemo<BossOption[]>(() => {
    const counts = new Map<number, number>(KNOWN_BOSS_IDS.map((id) => [id, 0]));
    for (const entry of nodes) {
      const boss = bossOf(entry);
      if (boss && !counts.has(boss)) counts.set(boss, 0);
    }
    for (const entry of candidates) {
      const boss = bossOf(entry);
      if (boss) counts.set(boss, (counts.get(boss) ?? 0) + 1);
    }
    return [...counts]
      .sort(([a], [b]) => a - b)
      .map(([id, count]) => ({ id, count }));
  }, [nodes, candidates]);
  const available = useMemo(
    () => new Set(options.filter((o) => o.count > 0).map((o) => o.id)),
    [options]
  );
  const selected = useMemo<ReadonlySet<number>>(
    () => new Set([...bossIds].filter((id) => available.has(id))),
    [bossIds, available]
  );
  const filtered = useMemo(() => {
    if (selected.size === 0) return candidates;
    return candidates.filter((entry) => {
      const boss = bossOf(entry);
      return boss !== undefined && selected.has(boss);
    });
  }, [candidates, selected]);
  return {
    // Map không có dữ liệu boss (cụm thiếu file) thì ẩn nút lọc boss;
    // candidates hết boss thì nút vẫn hiện, lưới khoá toàn bộ.
    mapHasBosses: useMemo(() => nodes.some((e) => bossOf(e)), [nodes]),
    options,
    selected,
    active: selected.size > 0,
    toggle: (id: number) => {
      const next = new Set(selected);
      if (!next.delete(id)) next.add(id);
      setBossIds(next.size >= available.size ? new Set() : next);
    },
    clear: () => setBossIds(new Set()),
    filtered,
  };
}
