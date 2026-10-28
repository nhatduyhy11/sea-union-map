export const number = (value: number): string =>
  new Intl.NumberFormat("vi-VN").format(value);

export const compact = (value: number): string =>
  value >= 1000000
    ? `${(value / 1000000).toFixed(2)}M`
    : `${(value / 1000).toFixed(1)}k`;
