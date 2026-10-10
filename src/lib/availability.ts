import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { SLOT_STEP_MINUTES } from "./config";
import { clinicDateAt, dayOfWeek } from "./time";

export type Interval = { start: Date; end: Date };

type Db = PrismaClient | Prisma.TransactionClient;

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** True when [start, start+length) sits inside one working block and touches no busy interval. */
export function slotFits(slot: Interval, working: Interval[], busy: Interval[]): boolean {
  const inside = working.some((w) => slot.start >= w.start && slot.end <= w.end);
  return inside && !busy.some((b) => overlaps(slot, b));
}

/**
 * Pure slot generator: every `step`-aligned start inside the working blocks where an
 * appointment of `lengthMinutes` (treatment + buffer) fits without touching busy time.
 */
export function computeFreeSlots(opts: {
  working: Interval[];
  busy: Interval[];
  lengthMinutes: number;
  stepMinutes?: number;
  notBefore?: Date;
}): Date[] {
  const step = (opts.stepMinutes ?? SLOT_STEP_MINUTES) * 60_000;
  const length = opts.lengthMinutes * 60_000;
  const slots: Date[] = [];
  for (const block of opts.working) {
    for (let t = block.start.getTime(); t + length <= block.end.getTime(); t += step) {
      const slot = { start: new Date(t), end: new Date(t + length) };
      if (opts.notBefore && slot.start < opts.notBefore) continue;
      if (!opts.busy.some((b) => overlaps(slot, b))) slots.push(slot.start);
    }
  }
  return slots;
}

/** Statuses that occupy a doctor's time. HELD only counts until its hold expires. */
export function busyWhere(now: Date): Prisma.AppointmentWhereInput {
  return {
    OR: [
      { status: { in: ["SCHEDULED", "CONFIRMED", "COMPLETED"] } },
      { status: "HELD", holdExpiresAt: { gt: now } },
    ],
  };
}

/** Working blocks and busy intervals for one doctor on one clinic-local date. */
export async function doctorDay(db: Db, doctorId: string, date: string, opts: { excludeAppointmentId?: string } = {}) {
  const dayStart = clinicDateAt(date, 0);
  const dayEnd = clinicDateAt(date, 24 * 60);
  const now = new Date();

  const [hours, timeOff, appts] = await Promise.all([
    db.workingHours.findMany({ where: { doctorId, dayOfWeek: dayOfWeek(date) }, orderBy: { startMinute: "asc" } }),
    db.timeOff.findMany({ where: { doctorId, start: { lt: dayEnd }, end: { gt: dayStart } } }),
    db.appointment.findMany({
      where: {
        doctorId,
        start: { lt: dayEnd },
        end: { gt: dayStart },
        ...busyWhere(now),
        ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}),
      },
      select: { start: true, end: true },
    }),
  ]);

  const working = hours.map((h) => ({ start: clinicDateAt(date, h.startMinute), end: clinicDateAt(date, h.endMinute) }));
  const busy: Interval[] = [...timeOff.map((t) => ({ start: t.start, end: t.end })), ...appts];
  return { working, busy };
}

export type DoctorSlots = { doctor: { id: string; name: string; specialty: string; color: string }; slots: Date[] };

/** Free start times for a treatment on a date, per qualified doctor (optionally one doctor). */
export async function getAvailability(opts: {
  treatmentTypeId: string;
  date: string;
  doctorId?: string;
}): Promise<DoctorSlots[]> {
  const treatment = await prisma.treatmentType.findUniqueOrThrow({
    where: { id: opts.treatmentTypeId },
    include: { doctors: { where: { active: true, ...(opts.doctorId ? { id: opts.doctorId } : {}) } } },
  });
  const length = treatment.durationMinutes + treatment.bufferMinutes;
  const now = new Date();

  return Promise.all(
    treatment.doctors.map(async (doctor) => {
      const { working, busy } = await doctorDay(prisma, doctor.id, opts.date);
      return {
        doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty, color: doctor.color },
        slots: computeFreeSlots({ working, busy, lengthMinutes: length, notBefore: now }),
      };
    }),
  );
}
