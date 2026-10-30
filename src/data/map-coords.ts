// Raw traced data — do not edit without re-tracing from specs/map-*.PNG.
// The logic that turns these into nodes/routes/bounds lives in map-layout.ts.
//
// Traced from specs/map-{left,mid,right}.PNG, in the middle screenshot's coordinates.
// Left image offset: (-818,-30); right: (+710,-30). Names and scores are not transcribed.
// ID 4 is the central landmark; 3-1 to 3-8 are the central axis landmarks.
// Nodes on a landmark's x form a vertical column; the owner confirmed the
// groups on 2026-10-21, so traced x's are snapped onto exact columns:
// {2-41,2-50,2-21,2-24} -> -150, mirrored {2-45,2-37,2-2,2-26} -> 974,
// {2-15,2-22} -> 3-3's column, {2-19,2-44} -> 3-4's, {2-33,2-3} -> 3-8 (884).
// Locked by the "island columns" test in domain/data.test.ts.

// [index, x, y] -> id `1-${index}`
export const outer: [number, number, number][] = [
  [1, -548, 970],
  [2, 1452, 865],
  [3, -548, 1160],
  [4, 1112, 485],
  [5, 1452, 1070],
  [6, 330, 1640],
  [7, 493, 1640],
  [8, 412, 1575],
  [9, -548, 775],
  [10, 493, 305],
  [11, 412, 370],
  [12, 200, 370],
  [13, 623, 1575],
  [14, 200, 1575],
  [15, 1112, 1465],
  [16, 623, 370],
  [17, -628, 1070],
  [18, 1372, 1160],
  [19, 1372, 970],
  [20, 1372, 775],
  [21, -628, 865],
  [22, -288, 1465],
  [23, 330, 305],
  [24, -288, 485],
];
// [index, x, y] -> id `2-${index}`
export const inner: [number, number, number][] = [
  [1, 770, 1445],
  [2, 974, 1085],
  [3, 884, 1175],
  [4, 1112, 1250],
  [5, 1112, 1085],
  [6, 1242, 970],
  [7, 412, 1495],
  [8, 54, 1265],
  [9, 770, 1100],
  [10, 493, 1100],
  [11, 54, 500],
  [12, 493, 1265],
  [13, 412, 565],
  [14, 412, 455],
  [15, 168, 840],
  [16, 770, 500],
  [17, -60, 1175],
  [18, 1112, 970],
  [19, 656, 1100],
  [20, 330, 1265],
  [21, -150, 1085],
  [22, 168, 1100],
  [23, 330, 1100],
  [24, -150, 1295],
  [25, -288, 1250],
  [26, 974, 1295],
  [27, 770, 1265],
  [28, -288, 1085],
  [29, 412, 1380],
  [30, -418, 970],
  [31, 54, 1100],
  [32, -288, 970],
  [33, 884, 770],
  [34, 493, 680],
  [35, 330, 680],
  [36, 1112, 865],
  [37, 974, 865],
  [38, 330, 840],
  [39, 54, 840],
  [40, 54, 680],
  [41, -150, 645],
  [42, 770, 680],
  [43, 770, 840],
  [44, 656, 840],
  [45, 974, 645],
  [46, -60, 770],
  [47, 493, 840],
  [48, 54, 1445],
  [49, -288, 700],
  [50, -150, 865],
  [51, -288, 865],
  [52, 1112, 700],
];
// [id, x]; all sit on the central axis (y = MAP_ORIGIN.y), ordered west -> east.
export const center: [string, number][] = [
  ["3-7", -60],
  ["3-5", 54],
  ["3-3", 168],
  ["3-1", 282],
  ["4", 412],
  ["3-2", 542],
  ["3-4", 656],
  ["3-6", 770],
  ["3-8", 884],
];
// Landmark 4 (map center); positions are made relative to it.
export const MAP_ORIGIN = { x: 412, y: 970 };
// Base names are the in-game camp names (dump.baseDir); dump.camp overrides
// them with the same strings when a live snapshot matches.
// [faction, name, x, y]
export const bases: [string, string, number, number][] = [
  ["north", "Thần Tự Lấp Lánh", 412, 208],
  ["east", "Vịnh Thao Thiết", 1584, 970],
  ["south", "Long Khư U Ám", 412, 1735],
  ["west", "Thánh Đảo Lạnh Giá", -758, 970],
];
// Each chain links consecutive ids into routes.
export const chains: string[][] = [
  // Bases and the six-island branches on each side.
  ["base-north", "1-23", "1-12"],
  ["base-north", "1-10", "1-16"],
  ["1-23", "1-11", "1-10"],
  ["base-west", "1-21", "1-9"],
  ["base-west", "1-17", "1-3"],
  ["1-21", "1-1", "1-17"],
  ["base-east", "1-2", "1-20"],
  ["base-east", "1-5", "1-18"],
  ["1-2", "1-19", "1-5"],
  ["base-south", "1-6", "1-14"],
  ["base-south", "1-7", "1-13"],
  ["1-6", "1-8", "1-7"],
  // The four corner islands and outer approaches.
  ["1-24", "1-11", "1-4", "1-19", "1-15", "1-8", "1-22", "1-1", "1-24"],
  ["1-24", "2-49", "2-51", "2-32", "2-28", "2-25", "1-22"],
  ["1-4", "2-52", "2-36", "2-18", "2-5", "2-4", "1-15"],
  ["1-24", "2-41", "2-46", "2-50", "2-51"],
  ["2-46", "2-39"],
  ["2-49", "2-30", "2-32"],
  ["2-30", "2-25"],
  ["1-22", "2-24", "2-17", "2-21", "2-28"],
  ["2-17", "2-31"],
  ["1-22", "2-8"],
  ["1-4", "2-45", "2-33", "2-37", "2-36"],
  ["2-33", "2-43"],
  ["2-52", "2-6", "2-18"],
  ["2-4", "2-6"],
  ["2-5", "2-2"],
  ["1-15", "2-26", "2-3", "2-9"],
  ["1-15", "2-27"],
  // The four inner sectors, transcribed without rotating or generating new IDs.
  ["1-24", "2-40", "2-11", "2-13", "2-16", "2-42", "1-4"],
  ["2-11", "2-14", "2-16"],
  ["2-40", "2-35", "2-38", "2-15", "2-39", "2-40"],
  ["2-11", "2-40"],
  ["2-42", "2-34", "2-47", "2-44", "2-43", "2-42"],
  ["2-31", "2-22", "2-23"],
  ["2-31", "2-8", "2-20"],
  ["2-31", "2-48"],
  ["2-9", "2-19", "2-10", "2-12", "2-27", "2-9"],
  ["2-27", "2-1"],
  ["2-48", "2-29", "2-1"],
  ["2-48", "2-7", "2-1"],
  // Extra links confirmed by the project owner (2026-10-21).
  ["2-2", "2-3"],
  ["2-20", "2-23"],
  // Nine landmarks on the central axis, including the actual center (4).
  ["2-32", ...center.map(([id]) => id), "2-18"],
  ["2-15", "3-7", "2-22"],
  ["2-44", "3-8", "2-19"],
];
