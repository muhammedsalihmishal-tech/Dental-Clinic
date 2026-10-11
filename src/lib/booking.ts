import type { AppointmentStatus, BookingSource, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { doctorDay, slotFits } from "./availability";
import { HOLD_MINUTES } from "./config";
import { clinicDateString } from "./time";
import { notifyWaitlistForSlot } from "./waitlist";
import {
  cancelPendingAppointmentReminders,
  scheduleAppointmentReminders,
  scheduleCompletedFollowUps,
  scheduleMissedFollowUps,
  scheduleTreatmentFollowUps,
} from "./reminders";

export class BookingError extends Error {}

/**
 * Serialise bookings per doctor and verify the slot is still free.
 * The advisory lock is held until the surrounding transaction ends, so two callers
 * can never both pass this check for overlapping times.
 */
async function assertSlotFree(
  tx: Prisma.TransactionClient,
  doctorId: string,
  start: Date,
  end: Date,
  excludeAppointmentId?: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${doctorId}))`;
  const date = clinicDateString(start);
  const { working, busy } = await doctorDay(tx, doctorId, date, { excludeAppointmentId });
  if (!slotFits({ start, end }, working, busy)) {
    throw new BookingError("That time is no longer available for this doctor.");
  }
}

async function loadTreatment(tx: Prisma.TransactionClient, treatmentTypeId: string, doctorId: string) {
  const treatment = await tx.treatmentType.findUnique({
    where: { id: treatmentTypeId },
    include: { doctors: { where: { id: doctorId, active: true }, select: { id: true } } },
  });
  if (!treatment) throw new BookingError("Unknown treatment.");
  if (treatment.doctors.length === 0) throw new BookingError("This doctor does not perform that treatment.");
  return treatment;
}

export async function bookAppointment(input: {
  patientId: string;
  doctorId: string;
  treatmentTypeId: string;
  start: Date;
  source?: BookingSource;
  notes?: string;
  /** Reserve the slot for HOLD_MINUTES instead of booking it outright. */
  hold?: boolean;
}) {
  if (input.start <= new Date()) throw new BookingError("Appointments must be in the future.");
  const appt = await prisma.$transaction(async (tx) => {
    const treatment = await loadTreatment(tx, input.treatmentTypeId, input.doctorId);
    const end = new Date(input.start.getTime() + (treatment.durationMinutes + treatment.bufferMinutes) * 60_000);
    await assertSlotFree(tx, input.doctorId, input.start, end);
    return tx.appointment.create({
      data: {
        patientId: input.patientId,
        doctorId: input.doctorId,
        treatmentTypeId: input.treatmentTypeId,
        start: input.start,
        end,
        source: input.source ?? "STAFF",
        notes: input.notes,
        status: input.hold ? "HELD" : "SCHEDULED",
        holdExpiresAt: input.hold ? new Date(Date.now() + HOLD_MINUTES * 60_000) : null,
      },
    });
  });
  if (!input.hold) await scheduleAppointmentReminders(appt);
  return appt;
}

/** Turn a voice-agent hold into a real booking. */
export async function confirmHold(holdId: string, patientId: string) {
  const appt = await prisma.$transaction(async (tx) => {
    const hold = await tx.appointment.findUnique({ where: { id: holdId } });
    if (!hold || hold.status !== "HELD" || hold.patientId !== patientId) throw new BookingError("Hold not found.");
    // An expired hold may still be bookable if nobody took the slot meanwhile.
    if (!hold.holdExpiresAt || hold.holdExpiresAt <= new Date()) {
      await assertSlotFree(tx, hold.doctorId, hold.start, hold.end, hold.id);
    }
    return tx.appointment.update({ where: { id: holdId }, data: { status: "SCHEDULED", holdExpiresAt: null } });
  });
  await scheduleAppointmentReminders(appt);
  return appt;
}

export async function rescheduleAppointment(id: string, start: Date, doctorId?: string) {
  if (start <= new Date()) throw new BookingError("Appointments must be in the future.");
  const appt = await prisma.$transaction(async (tx) => {
    const current = await tx.appointment.findUnique({ where: { id } });
    if (!current || !["SCHEDULED", "CONFIRMED", "HELD"].includes(current.status)) {
      throw new BookingError("Only upcoming appointments can be rescheduled.");
    }
    const newDoctor = doctorId ?? current.doctorId;
    const treatment = await loadTreatment(tx, current.treatmentTypeId, newDoctor);
    const end = new Date(start.getTime() + (treatment.durationMinutes + treatment.bufferMinutes) * 60_000);
    await assertSlotFree(tx, newDoctor, start, end, id);
    return tx.appointment.update({
      where: { id },
      data: { start, end, doctorId: newDoctor, status: current.status === "HELD" ? "HELD" : "SCHEDULED" },
    });
  });
  await cancelPendingAppointmentReminders(id);
  if (appt.status !== "HELD") await scheduleAppointmentReminders(appt);
  return appt;
}

export async function cancelAppointment(id: string, reason?: string) {
  const appt = await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED", ...(reason ? { notes: reason } : {}) },
  });
  await cancelPendingAppointmentReminders(id);
  await notifyWaitlistForSlot(appt.treatmentTypeId, appt.doctorId);
  return appt;
}

/** Status changes from the calendar. Completing creates the treatment record and its follow-ups. */
export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  if (status === "CANCELLED") return cancelAppointment(id);
  const appt = await prisma.appointment.update({ where: { id }, data: { status } });

  if (status === "COMPLETED") {
    const existing = await prisma.treatmentRecord.findUnique({ where: { appointmentId: id } });
    if (!existing) {
      const treatment = await prisma.treatmentType.findUniqueOrThrow({ where: { id: appt.treatmentTypeId } });
      const record = await prisma.treatmentRecord.create({
        data: {
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          treatmentTypeId: appt.treatmentTypeId,
          appointmentId: id,
          performedAt: appt.start,
          cost: treatment.price,
        },
      });
      await scheduleTreatmentFollowUps(record);
    }
    await scheduleCompletedFollowUps(appt);
    await prisma.patient.update({ where: { id: appt.patientId }, data: { status: "ACTIVE" } });
  }
  if (status === "NO_SHOW") {
    await cancelPendingAppointmentReminders(id);
    await scheduleMissedFollowUps(appt);
  }
  return appt;
}
