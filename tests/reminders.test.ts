import { describe, expect, it } from "vitest";
import { daysAfter, hoursBefore, outsideQuietHours, renderTemplate } from "@/lib/reminders";

// Clinic timezone defaults to Asia/Kolkata (UTC+05:30).
const ist = (iso: string) => new Date(`${iso}+05:30`);

describe("renderTemplate", () => {
  it("fills variables and blanks unknown ones", () => {
    expect(renderTemplate("Hi {{ firstName }}, see {{doctorName}}{{missing}}!", { firstName: "Meera", doctorName: "Dr. Aisha" })).toBe(
      "Hi Meera, see Dr. Aisha!",
    );
  });
});

describe("daysAfter", () => {
  it("sends N days later at 10:00 clinic time", () => {
    const sent = daysAfter(ist("2026-10-01T16:30:00"), { offsetDays: 15, offsetHours: 0 });
    expect(sent.toISOString()).toBe(ist("2026-10-16T10:00:00").toISOString());
  });
});

describe("hoursBefore", () => {
  it("subtracts days and hours", () => {
    expect(hoursBefore(ist("2026-10-16T10:00:00"), { offsetDays: 1, offsetHours: 2 }).toISOString()).toBe(ist("2026-10-15T08:00:00").toISOString());
  });
});

describe("outsideQuietHours", () => {
  it("keeps daytime sends", () => {
    const t = ist("2026-10-16T14:00:00");
    expect(outsideQuietHours(t)).toEqual(t);
  });
  it("moves early-morning sends to 9 AM the same day", () => {
    expect(outsideQuietHours(ist("2026-10-16T06:00:00")).toISOString()).toBe(ist("2026-10-16T09:00:00").toISOString());
  });
  it("moves late-night sends to 9 AM the next day", () => {
    expect(outsideQuietHours(ist("2026-10-16T22:30:00")).toISOString()).toBe(ist("2026-10-17T09:00:00").toISOString());
  });
});
