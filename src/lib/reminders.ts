import type { Appointment, Prisma, ReminderRule, TreatmentRecord } from "@prisma/client";
import { prisma } from "./prisma";
import { clinic, QUIET_HOURS } from "./config";
import { addDays, clinicDateAt, clinicDateString, clinicMinuteOfDay, fmtDate, fmtTime } from "./time";
import { sendMessage } from "./messaging";
import { fullName } from "./utils";
import { generatePersonalisedMessage } from "./ai-messages";

/** Local time of day that day-based reminders go out (10:00). */
const DAY_REMINDER_MINUTE = 10 * 60;

export function renderTemplate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** Push a send time that lands in quiet hours to the next allowed morning. */
export function outsideQuietHours(at: Date, tz = clinic.timezone): Date {
  const minute = clinicMinuteOfDay(at, tz);
  const date = clinicDateString(at, tz);
  if (minute < QUIET_HOURS.end * 60) return clinicDateAt(date, QUIET_HOURS.resumeAt * 60, tz);
  if (minute >= QUIET_HOURS.start * 60) return clinicDateAt(addDays(date, 1), QUIET_HOURS.resumeAt * 60, tz);
  return at;
}

/** Send time for "N days (+ H hours) after <event>": that day at 10:00 clinic time. */
export function daysAfter(event: Date, rule: Pick<ReminderRule, "offsetDays" | "offsetHours">): Date {
  const base = clinicDateAt(addDays(clinicDateString(event), rule.offsetDays), DAY_REMINDER_MINUTE);
  return new Date(base.getTime() + rule.offsetHours * 3_600_000);
}

export function hoursBefore(start: Date, rule: Pick<ReminderRule, "offsetDays" | "offsetHours">): Date {
  return new Date(start.getTime() - (rule.offsetDays * 24 + rule.offsetHours) * 3_600_000);
}

async function createReminders(
  rows: { rule: ReminderRule; scheduledFor: Date; patientId: string; appointmentId?: string; treatmentRecordId?: string; dedupeKey: string }[],
) {
  if (rows.length === 0) return;
  await prisma.reminder.createMany({
    data: rows.map((r) => ({
      patientId: r.patientId,
      ruleId: r.rule.id,
      appointmentId: r.appointmentId,
      treatmentRecordId: r.treatmentRecordId,
      channel: r.rule.channel,
      scheduledFor: r.scheduledFor,
      dedupeKey: r.dedupeKey,
    })),
    skipDuplicates: true,
  });
}

/** Queue "before appointment" reminders (e.g. 24h and 2h before). */
export async function scheduleAppointmentReminders(appt: Appointment) {
  const rules = await prisma.reminderRule.findMany({
    where: {
      active: true,
      trigger: "BEFORE_APPOINTMENT",
      OR: [{ treatmentTypeId: null }, { treatmentTypeId: appt.treatmentTypeId }],
    },
  });
  const now = new Date();
  await createReminders(
    rules
      .map((rule) => ({ rule, scheduledFor: hoursBefore(appt.start, rule) }))
      .filter((r) => r.scheduledFor > now)
      .map((r) => ({
        ...r,
        patientId: appt.patientId,
        appointmentId: appt.id,
        // start is part of the key so a rescheduled appointment gets fresh reminders
        dedupeKey: `rule:${r.rule.id}:appt:${appt.id}:${appt.start.getTime()}`,
      })),
  );
}

/** Queue follow-ups after a completed treatment (e.g. the 15-day check-in). */
export async function scheduleTreatmentFollowUps(record: TreatmentRecord) {
  const rules = await prisma.reminderRule.findMany({
    where: {
      active: true,
      trigger: "AFTER_TREATMENT",
      OR: [{ treatmentTypeId: null }, { treatmentTypeId: record.treatmentTypeId }],
    },
  });
  await createReminders(
    rules.map((rule) => ({
      rule,
      scheduledFor: daysAfter(record.performedAt, rule),
      patientId: record.patientId,
      treatmentRecordId: record.id,
      dedupeKey: `rule:${rule.id}:record:${record.id}`,
    })),
  );
}

export async function scheduleMissedFollowUps(appt: Appointment) {
  const rules = await prisma.reminderRule.findMany({
    where: { active: true, trigger: "AFTER_MISSED", OR: [{ treatmentTypeId: null }, { treatmentTypeId: appt.treatmentTypeId }] },
  });
  const now = new Date();
  await createReminders(
    rules.map((rule) => {
      const at = rule.offsetDays === 0 ? new Date(now.getTime() + rule.offsetHours * 3_600_000) : daysAfter(appt.start, rule);
      return { rule, scheduledFor: at, patientId: appt.patientId, appointmentId: appt.id, dedupeKey: `rule:${rule.id}:missed:${appt.id}` };
    }),
  );
}

export async function cancelPendingAppointmentReminders(appointmentId: string) {
  await prisma.reminder.updateMany({
    where: { appointmentId, status: "PENDING", rule: { trigger: "BEFORE_APPOINTMENT" } },
    data: { status: "CANCELLED" },
  });
}

const dueInclude = {
  patient: true,
  rule: true,
  appointment: { include: { doctor: true, treatmentType: true } },
  treatmentRecord: { include: { doctor: true, treatmentType: true } },
} satisfies Prisma.ReminderInclude;

/** Send every reminder that is due. Safe to call concurrently: each row is claimed before sending. */
export async function processDueReminders(now = new Date()) {
  const due = await prisma.reminder.findMany({
    where: { status: "PENDING", scheduledFor: { lte: now } },
    include: dueInclude,
    orderBy: { scheduledFor: "asc" },
    take: 100,
  });

  const summary = { sent: 0, failed: 0, skipped: 0, deferred: 0, cancelled: 0 };

  for (const r of due) {
    const allowedAt = outsideQuietHours(now);
    if (allowedAt > now) {
      await prisma.reminder.update({ where: { id: r.id }, data: { scheduledFor: allowedAt } });
      summary.deferred++;
      continue;
    }
    if (r.patient.optOut) {
      await prisma.reminder.update({ where: { id: r.id }, data: { status: "SKIPPED", error: "Patient opted out" } });
      summary.skipped++;
      continue;
    }
    const appt = r.appointment;
    if (r.rule?.trigger === "BEFORE_APPOINTMENT" && (!appt || !["SCHEDULED", "CONFIRMED"].includes(appt.status) || appt.start <= now)) {
      await prisma.reminder.update({ where: { id: r.id }, data: { status: "CANCELLED", error: "Appointment no longer active" } });
      summary.cancelled++;
      continue;
    }

    const ctx = appt ?? r.treatmentRecord;
    const when = appt?.start ?? r.treatmentRecord?.performedAt;
    const templateFallback = renderTemplate(r.rule?.template ?? r.message ?? "", {
      firstName: r.patient.firstName,
      fullName: fullName(r.patient),
      clinicName: clinic.name,
      clinicPhone: clinic.phone,
      doctorName: ctx?.doctor.name,
      treatment: ctx?.treatmentType.name,
      date: when ? fmtDate(when) : undefined,
      time: when ? fmtTime(when) : undefined,
    });
    const message = await generatePersonalisedMessage({
      firstName: r.patient.firstName,
      fullName: fullName(r.patient),
      language: r.patient.language,
      preferredChannel: r.channel,
      medicalAlerts: r.patient.medicalAlerts,
      treatmentName: ctx?.treatmentType.name,
      doctorName: ctx?.doctor.name,
      date: when ? fmtDate(when) : undefined,
      clinicName: clinic.name,
      clinicPhone: clinic.phone,
      ruleName: r.rule?.name ?? "follow-up",
      templateFallback,
    });

    // Claim the row so a parallel run can't send it twice.
    const claimed = await prisma.reminder.updateMany({
      where: { id: r.id, status: "PENDING" },
      data: { status: "SENT", sentAt: now, message },
    });
    if (claimed.count === 0) continue;

    const result = await sendMessage(r.channel, r.patient.phone, message).catch((e: unknown) => ({
      ok: false,
      simulated: false,
      error: e instanceof Error ? e.message : String(e),
    }));
    if (result.ok) {
      summary.sent++;
      if (result.simulated) await prisma.reminder.update({ where: { id: r.id }, data: { error: "Simulated (no provider configured)" } });
    } else {
      summary.failed++;
      await prisma.reminder.update({ where: { id: r.id }, data: { status: "FAILED", sentAt: null, error: result.error } });
    }
  }
  return summary;
}
