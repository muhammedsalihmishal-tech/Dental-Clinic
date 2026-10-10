"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/messaging";
import { clinic } from "@/lib/config";
import { fullName } from "@/lib/utils";

export async function addToWaitlist(form: FormData) {
  const patientId = String(form.get("patientId") ?? "");
  const treatmentTypeId = String(form.get("treatmentTypeId") ?? "");
  const doctorId = form.get("doctorId") ? String(form.get("doctorId")) : null;
  const notes = form.get("notes") ? String(form.get("notes")) : null;
  if (!patientId || !treatmentTypeId) return;
  await prisma.waitlist.create({ data: { patientId, treatmentTypeId, doctorId: doctorId || null, notes } });
  revalidatePath("/waitlist");
}

export async function removeFromWaitlist(form: FormData) {
  const id = String(form.get("id") ?? "");
  await prisma.waitlist.delete({ where: { id } });
  revalidatePath("/waitlist");
}

export async function notifyWaitlistPatient(form: FormData) {
  const id = String(form.get("id") ?? "");
  const entry = await prisma.waitlist.findUnique({
    include: { patient: true, treatmentType: true, doctor: true },
    where: { id },
  });
  if (!entry) return;

  const { patient, treatmentType, doctor } = entry;
  const body = `Hi ${patient.firstName}, great news! A slot has opened up for your ${treatmentType.name}${doctor ? ` with ${doctor.name}` : ""}. Reply or call us at ${clinic.phone} to book before it's taken. – ${clinic.name}`;

  await sendMessage(patient.preferredChannel, patient.phone, body);
  await prisma.waitlist.update({ where: { id }, data: { notified: true } });
  revalidatePath("/waitlist");
}
