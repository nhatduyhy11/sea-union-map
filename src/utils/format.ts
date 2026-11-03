export const number = (value: number): string =>
  new Intl.NumberFormat("vi-VN").format(value);

export const compact = (value: number): string =>
  value >= 1000000
    ? `${(value / 1000000).toFixed(2)}M`
    : `${(value / 1000).toFixed(1)}k`;

const ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

// Số la mã cho hạng (1 → I, 4 → IV); số nguyên dương.
export const roman = (value: number): string =>
  ROMAN.reduce((out, [unit, symbol]) => {
    while (value >= unit) {
      out += symbol;
      value -= unit;
    }
    return out;
  }, "");
