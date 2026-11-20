import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampThreshold,
  formatThreshold,
  parseThreshold,
  snapThreshold,
  keepsPoints,
} from "./thresholdValue";

test("snapThreshold: integer per display unit, step 10 from 100 units", () => {
  assert.equal(snapThreshold(0), 0);
  assert.equal(snapThreshold(-5), 0);
  assert.equal(snapThreshold(347), 350);
  assert.equal(snapThreshold(12_345), 12_000);
  assert.equal(snapThreshold(123_456), 120_000);
  assert.equal(snapThreshold(1_490_000), 1_000_000);
  assert.equal(snapThreshold(33_690_000), 34_000_000);
  assert.equal(snapThreshold(254_000_000), 250_000_000);
  // Làm tròn lên ngưỡng đơn vị kế tiếp vẫn ra số gọn.
  assert.equal(snapThreshold(999_700), 1_000_000);
});

test("formatThreshold: unit suffix, no trailing zeros", () => {
  assert.equal(formatThreshold(0), "0");
  assert.equal(formatThreshold(350), "350");
  assert.equal(formatThreshold(120_000), "120k");
  assert.equal(formatThreshold(34_000_000), "34M");
  assert.equal(formatThreshold(1_500_000), "1.5M");
  assert.equal(formatThreshold(2_000_000_000), "2B");
});

test("parseThreshold: unit suffixes", () => {
  assert.equal(parseThreshold("34m"), 34_000_000);
  assert.equal(parseThreshold(" 1.5M "), 1_500_000);
  assert.equal(parseThreshold("1,5m"), 1_500_000);
  assert.equal(parseThreshold("120K"), 120_000);
  assert.equal(parseThreshold("34 tr"), 34_000_000);
  assert.equal(parseThreshold("2tỷ"), 2_000_000_000);
  assert.equal(parseThreshold("1b"), 1_000_000_000);
});

test("parseThreshold: bare number < 1000 is M, else raw points", () => {
  assert.equal(parseThreshold("34"), 34_000_000);
  assert.equal(parseThreshold("1.5"), 1_500_000);
  assert.equal(parseThreshold("1,5"), 1_500_000);
  assert.equal(parseThreshold("0"), 0);
  assert.equal(parseThreshold("34000000"), 34_000_000);
  assert.equal(parseThreshold("34.000.000"), 34_000_000);
  assert.equal(parseThreshold("34,000,000"), 34_000_000);
});

test("parseThreshold: negative passes through, garbage is null", () => {
  assert.equal(parseThreshold("-5m"), -5_000_000);
  assert.equal(parseThreshold(""), null);
  assert.equal(parseThreshold("abc"), null);
  assert.equal(parseThreshold("5T"), null);
  assert.equal(parseThreshold("5l"), null);
  assert.equal(parseThreshold("1.2.3m"), null);
  assert.equal(parseThreshold("m"), null);
  assert.equal(parseThreshold("1..5"), null);
});

test("clampThreshold: cap at axis top, below axis → 0", () => {
  const range = { min: 1_000_000, max: 1_000_000_000 };
  assert.equal(clampThreshold(5_000_000_000, range), 1_000_000_000);
  assert.equal(clampThreshold(-5_000_000, range), 0);
  assert.equal(clampThreshold(500, range), 0);
  assert.equal(clampThreshold(0, range), 0);
  assert.equal(clampThreshold(34_000_000, range), 34_000_000);
});

test("keepsPoints: single line >= / <=, range keeps inside or outside", () => {
  assert.equal(keepsPoints(5, 5, false, null), true);
  assert.equal(keepsPoints(4, 5, false, null), false);
  assert.equal(keepsPoints(4, 5, true, null), true);
  // Kẹp cạnh, thứ tự hai vạch không quan trọng.
  for (const [value, upper] of [[10, 100], [100, 10]]) {
    assert.equal(keepsPoints(50, value, false, upper), true);
    assert.equal(keepsPoints(10, value, false, upper), true);
    assert.equal(keepsPoints(5, value, false, upper), false);
    assert.equal(keepsPoints(500, value, false, upper), false);
    assert.equal(keepsPoints(50, value, true, upper), false);
    assert.equal(keepsPoints(5, value, true, upper), true);
    assert.equal(keepsPoints(100, value, true, upper), true);
  }
});
