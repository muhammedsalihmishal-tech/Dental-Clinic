import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { clinic } from "./config";

const pad = (n: number) => String(n).padStart(2, "0");

/** Absolute instant for a clinic-local date ("YYYY-MM-DD") and minutes from midnight. */
export function clinicDateAt(date: string, minuteOfDay: number, tz = clinic.timezone): Date {
  // "24:00" isn't a valid wall-clock time, so roll whole days into the date.
  if (minuteOfDay >= 24 * 60 || minuteOfDay < 0) {
    const days = Math.floor(minuteOfDay / (24 * 60));
    return clinicDateAt(addDays(date, days), minuteOfDay - days * 24 * 60, tz);
  }
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return fromZonedTime(`${date}T${pad(h)}:${pad(m)}:00`, tz);
}

/** 0 = Sunday ... 6 = Saturday, for a "YYYY-MM-DD" calendar date. */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function clinicDateString(d: Date, tz = clinic.timezone): string {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

export function todayString(tz = clinic.timezone): string {
  return clinicDateString(new Date(), tz);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Minutes from midnight in clinic time. */
export function clinicMinuteOfDay(d: Date, tz = clinic.timezone): number {
  const [h, m] = formatInTimeZone(d, tz, "HH:mm").split(":").map(Number);
  return h * 60 + m;
}

export function fmt(d: Date, pattern: string, tz = clinic.timezone): string {
  return formatInTimeZone(d, tz, pattern);
}

export const fmtTime = (d: Date) => fmt(d, "h:mm a");
export const fmtDate = (d: Date) => fmt(d, "EEE, d MMM yyyy");
export const fmtDateTime = (d: Date) => fmt(d, "EEE, d MMM · h:mm a");

export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function labelToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHHMM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
