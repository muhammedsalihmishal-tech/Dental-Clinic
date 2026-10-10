import { describe, expect, it } from "vitest";
import { computeFreeSlots, slotFits } from "@/lib/availability";

const at = (hhmm: string) => new Date(`2026-10-12T${hhmm}:00Z`);
const times = (slots: Date[]) => slots.map((s) => s.toISOString().slice(11, 16));

describe("computeFreeSlots", () => {
  const working = [
    { start: at("09:00"), end: at("13:00") },
    { start: at("14:00"), end: at("16:00") },
  ];

  it("offers 15-minute starts that fit fully inside a working block", () => {
    const slots = computeFreeSlots({ working: [{ start: at("09:00"), end: at("10:00") }], busy: [], lengthMinutes: 30 });
    expect(times(slots)).toEqual(["09:00", "09:15", "09:30"]);
  });

  it("never spans the lunch break", () => {
    const slots = computeFreeSlots({ working, busy: [], lengthMinutes: 60 });
    expect(times(slots)).toContain("12:00");
    expect(times(slots)).not.toContain("12:15");
    expect(times(slots)).toContain("14:00");
  });

  it("skips anything overlapping an existing booking, touching edges allowed", () => {
    const busy = [{ start: at("10:00"), end: at("11:00") }];
    const slots = times(computeFreeSlots({ working, busy, lengthMinutes: 30 }));
    expect(slots).toContain("09:30"); // ends exactly at 10:00
    expect(slots).not.toContain("09:45");
    expect(slots).not.toContain("10:30");
    expect(slots).toContain("11:00");
  });

  it("drops slots before notBefore", () => {
    const slots = computeFreeSlots({ working, busy: [], lengthMinutes: 30, notBefore: at("15:00") });
    expect(times(slots)).toEqual(["15:00", "15:15", "15:30"]);
  });

  it("returns nothing on a day off", () => {
    expect(computeFreeSlots({ working: [], busy: [], lengthMinutes: 30 })).toEqual([]);
  });
});

describe("slotFits", () => {
  const working = [{ start: at("09:00"), end: at("13:00") }];
  it("rejects slots outside working hours or overlapping busy time", () => {
    expect(slotFits({ start: at("09:00"), end: at("09:30") }, working, [])).toBe(true);
    expect(slotFits({ start: at("12:45"), end: at("13:15") }, working, [])).toBe(false);
    expect(slotFits({ start: at("09:00"), end: at("09:30") }, working, [{ start: at("09:15"), end: at("09:45") }])).toBe(false);
  });
});
