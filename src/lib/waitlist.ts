import { prisma } from "./prisma";
import { getClinic } from "./config";
import { sendMessage } from "./messaging";

/** When a slot opens, notify the first matching unnotified waitlist entry. */
export async function notifyWaitlistForSlot(treatmentTypeId: string, doctorId: string) {
  const entry = await prisma.waitlist.findFirst({
    where: {
      treatmentTypeId,
      notified: false,
      OR: [{ doctorId: null }, { doctorId }],
    },
    orderBy: { createdAt: "asc" },
    include: { patient: true, treatmentType: true },
  });
  if (!entry) return;

  const c = await getClinic();
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const bookUrl = `${base}/book?t=${treatmentTypeId}`;
  const body = `Hi ${entry.patient.firstName}, a slot has opened for ${entry.treatmentType.name} at ${c.name}. Book online: ${bookUrl} or call ${c.phone}. – ${c.name}`;

  await sendMessage(entry.patient.preferredChannel as "SMS" | "WHATSAPP", entry.patient.phone, body).catch(() => null);
  await prisma.waitlist.update({ where: { id: entry.id }, data: { notified: true } });
}
