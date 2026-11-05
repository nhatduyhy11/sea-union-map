// Trạng thái hiển thị của icon node — mỗi phần tử tự gắn class trạng thái lên
// chính nó (CSS module không viết được selector theo class của module khác).
export type MarkerState = {
  hovered: boolean;
  linked: boolean;
  active: boolean;
  hot: boolean;
  frontline: boolean;
  defend: boolean;
};

// Class của các trạng thái đang bật, lấy từ CSS module truyền vào.
export function stateClasses(
  css: Record<string, string>,
  state: MarkerState
): string[] {
  return (Object.keys(state) as (keyof MarkerState)[])
    .filter((key) => state[key] && css[key])
    .map((key) => css[key]);
}
