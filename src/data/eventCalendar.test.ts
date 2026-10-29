import test from "node:test";
import assert from "node:assert/strict";
import { dayLabel, dayOfMonth, eventDayOf } from "./eventCalendar";

// Rule quy ngày snapshot: 22:00 → trước 10:00 hôm sau tính là ngày trước;
// 10:00~22:00 là ngày hôm đó (giờ VN, +07:00).
test("eventDayOf maps VN time onto event days via the 10:00 cutoff", () => {
  const at = (iso: string) => eventDayOf(new Date(iso));
  assert.equal(at("2026-10-28T10:00:00+07:00"), "261028");
  assert.equal(at("2026-10-28T21:59:00+07:00"), "261028");
  assert.equal(at("2026-10-28T23:30:00+07:00"), "261028");
  assert.equal(at("2026-10-29T07:40:00+07:00"), "261028");
  assert.equal(at("2026-10-29T09:59:59+07:00"), "261028");
  assert.equal(at("2026-10-29T10:00:00+07:00"), "261029");
  assert.equal(at("2026-11-01T08:00:00+07:00"), "261031");
  assert.equal(at("2026-11-01T12:00:00+07:00"), "261101");
});

test("day labels", () => {
  assert.equal(dayOfMonth("261101"), "01");
  assert.equal(dayLabel("261028"), "28/10");
});
