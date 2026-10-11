import { NextResponse } from "next/server";
import type { Channel } from "@prisma/client";
import { isCronRequestAuthorized } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClinic } from "@/lib/config";
import { processDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/** Call once per day (e.g. at 09:00 clinic time) to send birthday greetings. */
async function handle(req: Request) {
  if (!isCronRequestAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();

  const patients = await prisma.$queryRaw<{ id: string; firstName: string; preferredChannel: Channel }[]>`
    SELECT id, "firstName", "preferredChannel"
    FROM "Patient"
    WHERE "dateOfBirth" IS NOT NULL
      AND "optOut" = false
      AND EXTRACT(MONTH FROM "dateOfBirth") = ${month}
      AND EXTRACT(DAY FROM "dateOfBirth") = ${day}
  `;

  if (patients.length === 0) return NextResponse.json({ queued: 0, ...await processDueReminders() });

  const clinic = await getClinic();

  await prisma.reminder.createMany({
    data: patients.map((p) => ({
      patientId: p.id,
      channel: p.preferredChannel,
      scheduledFor: now,
      message: `Happy birthday, {{firstName}}! 🎂 Wishing you great health from all of us at {{clinicName}}. – {{clinicName}}`,
      dedupeKey: `birthday:${p.id}:${year}`,
    })),
    skipDuplicates: true,
  });

  void clinic; // getClinic warms the cache; template vars are resolved by processDueReminders
  const summary = await processDueReminders(now);
  return NextResponse.json({ queued: patients.length, ...summary });
}

export { handle as GET, handle as POST };
