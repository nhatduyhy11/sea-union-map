import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  battleCountdown,
  currentRoundOf,
  dayLabel,
  dayOfMonth,
  eventDayOf,
  roundDays,
  roundLabel,
  roundOf,
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
  assert.equal(roundLabel("261026"), "26/10 – 01/11");
  assert.equal(roundLabel("261116"), "16/11 – 22/11");
});

test("rounds span 7 days from their first day", () => {
  assert.equal(addDays("261031", 1), "261101");
  assert.equal(addDays("261231", 1), "270101");
  assert.deepEqual(roundDays("261026"), [
    "261026",
    "261027",
    "261028",
    "261029",
    "261030",
    "261031",
    "261101",
  ]);
  assert.equal(roundOf("261101"), "261026");
  assert.equal(roundOf("261102"), null);
  assert.equal(roundOf("261116"), "261116");
  assert.equal(roundOf("261122"), "261116");
  assert.equal(currentRoundOf("261020"), "261026");
  assert.equal(currentRoundOf("261110"), "261026");
  assert.equal(currentRoundOf("261118"), "261116");
  assert.equal(currentRoundOf("261130"), "261116");
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
  assert.deepEqual(at("2026-11-01T22:00:00+07:00"), {
    phase: "ended",
    round: "261026",
  });
  assert.deepEqual(at("2026-11-02T09:00:00+07:00"), {
    phase: "ended",
    round: "261026",
  });
  // Đợt kế tiếp còn trong vòng 7 ngày → đếm tới 10:00 ngày đầu đợt.
  assert.deepEqual(at("2026-11-12T15:00:00+07:00"), {
    phase: "closed",
    target: target("2026-11-16T10:00:00+07:00"),
  });
  assert.deepEqual(at("2026-11-16T10:30:00+07:00"), {
    phase: "open",
    target: target("2026-11-16T22:00:00+07:00"),
  });
  assert.deepEqual(at("2026-11-22T22:00:00+07:00"), {
    phase: "ended",
    round: "261116",
  });
});
