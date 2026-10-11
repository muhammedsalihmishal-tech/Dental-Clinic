"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyBookingToken, signBookingToken } from "@/lib/tokens";
import { cancelPendingAppointmentReminders } from "@/lib/reminders";
import { notifyWaitlistForSlot } from "@/lib/waitlist";

export async function cancelBookingByToken(f: FormData) {
  const token = String(f.get("token") ?? "");
  const appointmentId = verifyBookingToken(token);
  if (!appointmentId) redirect(`/book/manage?token=${token}&err=invalid`);

  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || !["SCHEDULED", "CONFIRMED"].includes(appt.status) || appt.start <= new Date()) {
    redirect(`/book/manage?token=${token}&err=expired`);
  }

  await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "CANCELLED" } });
  await cancelPendingAppointmentReminders(appointmentId);
  await notifyWaitlistForSlot(appt.treatmentTypeId, appt.doctorId);

  redirect(`/book/manage?token=${signBookingToken(appointmentId)}&cancelled=1`);
}
