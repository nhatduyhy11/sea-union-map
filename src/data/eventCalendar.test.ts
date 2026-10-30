import test from "node:test";
import assert from "node:assert/strict";
import {
  battleCountdown,
  dayLabel,
  dayOfMonth,
  eventDayOf,
} from "./eventCalendar";

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

// Trong khung 10:00~22:00 → đếm tới 22:00; ngoài khung → 10:00 kế tiếp nếu
// còn ngày event; hết ngày event → ended.
test("battleCountdown targets close, next open, or ended", () => {
  const at = (iso: string) => battleCountdown(new Date(iso));
  const target = (iso: string) => new Date(iso);
  assert.deepEqual(at("2026-10-28T10:00:00+07:00"), {
    phase: "open",
    target: target("2026-10-28T22:00:00+07:00"),
  });
  assert.deepEqual(at("2026-10-28T21:59:59+07:00"), {
    phase: "open",
    target: target("2026-10-28T22:00:00+07:00"),
  });
  assert.deepEqual(at("2026-10-28T22:00:00+07:00"), {
    phase: "closed",
    target: target("2026-10-29T10:00:00+07:00"),
  });
  assert.deepEqual(at("2026-10-29T03:00:00+07:00"), {
    phase: "closed",
    target: target("2026-10-29T10:00:00+07:00"),
  });
  assert.deepEqual(at("2026-10-24T15:00:00+07:00"), {
    phase: "closed",
    target: target("2026-10-26T10:00:00+07:00"),
  });
  assert.deepEqual(at("2026-11-01T15:00:00+07:00"), {
    phase: "open",
    target: target("2026-11-01T22:00:00+07:00"),
  });
  assert.deepEqual(at("2026-11-01T22:00:00+07:00"), { phase: "ended" });
  assert.deepEqual(at("2026-11-02T09:00:00+07:00"), { phase: "ended" });
});
