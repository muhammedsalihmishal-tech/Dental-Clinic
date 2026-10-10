import { describe, expect, it } from "vitest";
import { clinicDateAt, dayOfWeek } from "@/lib/time";

describe("clinicDateAt", () => {
  it("converts clinic-local wall time to an instant", () => {
    expect(clinicDateAt("2026-10-12", 10 * 60, "Asia/Kolkata").toISOString()).toBe("2026-10-12T04:30:00.000Z");
  });
  it("treats minute 1440 as midnight at the end of the day", () => {
    expect(clinicDateAt("2026-10-12", 24 * 60, "Asia/Kolkata").toISOString()).toBe("2026-10-12T18:30:00.000Z");
  });
});

describe("dayOfWeek", () => {
  it("is 1 for a Monday", () => expect(dayOfWeek("2026-10-12")).toBe(1));
});
