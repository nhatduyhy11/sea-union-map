// Giá trị ngưỡng điểm: snap khi kéo, nhãn hiển thị, parse ô nhập.

const UNITS: [number, string][] = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "k"],
];

// Snap khi kéo: số nguyên theo đơn vị hiển thị (k / M / B), bước 1 dưới 100
// đơn vị và bước 10 từ 100 trở lên — nhãn luôn gọn (34M, 120k, 250M).
export function snapThreshold(value: number): number {
  if (value <= 0) return 0;
  const [unit] = UNITS.find(([size]) => value >= size) ?? [1];
  const count = value / unit;
  const step = count >= 100 ? 10 : 1;
  return Math.max(step, Math.round(count / step) * step) * unit;
}

// Nhãn ngưỡng: đơn vị k / M / B, tối đa 2 số lẻ và bỏ số 0 thừa (giá trị gõ
// tay như 1.5M vẫn hiện đúng; giá trị kéo luôn là số nguyên).
export function formatThreshold(value: number): string {
  const found = UNITS.find(([size]) => value >= size);
  if (!found) return `${Math.round(value)}`;
  const [size, suffix] = found;
  return `${Number((value / size).toFixed(2))}${suffix}`;
}

const SUFFIX_SCALE: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  tr: 1e6,
  b: 1e9,
  tỷ: 1e9,
  tỉ: 1e9,
  ty: 1e9,
};

// Parse ô nhập (không phân biệt hoa thường, bỏ khoảng trắng):
// - Có đơn vị k / m / tr / b / tỷ: dấu , hoặc . là phần thập phân ("1,5m").
//   Đơn vị lạ (T, l…) → null.
// - Không đơn vị: dạng phân cách nghìn ("34.000.000") = điểm nguyên; còn lại
//   < 1000 hiểu là M vì điểm phe ở mức triệu ("34" = 34M, "1.5" = 1.5M),
//   >= 1000 là điểm nguyên ("34000000").
// Số âm vẫn trả về để clampThreshold đưa về 0; không ra số → null.
export function parseThreshold(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "");
  const match = /^(-?)([\d.,]+)(\p{L}*)$/u.exec(text);
  if (!match) return null;
  const [, minus, digits, suffix] = match;
  const sign = minus ? -1 : 1;
  if (suffix) {
    const scale = SUFFIX_SCALE[suffix];
    const number = decimal(digits);
    if (!scale || number === null) return null;
    return sign * Math.round(number * scale);
  }
  if (/^\d{1,3}([.,]\d{3})+$/.test(digits))
    return sign * Number(digits.replace(/[.,]/g, ""));
  const number = decimal(digits);
  if (number === null) return null;
  return sign * Math.round(number < 1000 ? number * 1e6 : number);
}

function decimal(digits: string): number | null {
  if (!/^\d+([.,]\d+)?$/.test(digits)) return null;
  return Number(digits.replace(",", "."));
}

// Kẹp ngưỡng gõ tay vào trục log của đồ thị: vượt đỉnh trục → đỉnh trục; âm
// hoặc dưới mốc thấp nhất → 0.
export function clampThreshold(
  value: number,
  { min, max }: { min: number; max: number }
): number {
  if (value < min) return 0;
  return Math.min(value, max);
}
