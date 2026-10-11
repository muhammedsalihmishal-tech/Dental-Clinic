export const clinic = {
  name: process.env.CLINIC_NAME ?? "Smile Studio Dental",
  timezone: process.env.CLINIC_TIMEZONE ?? "Asia/Kolkata",
  phone: process.env.CLINIC_PHONE ?? "",
  address: process.env.CLINIC_ADDRESS ?? "",
};

/** Reads live clinic settings from DB, falling back to env/defaults. */
export async function getClinic() {
  try {
    const { prisma } = await import("./prisma");
    const row = await prisma.clinicSettings.findUnique({ where: { id: "default" } });
    if (row) return { name: row.name, phone: row.phone, address: row.address, timezone: row.timezone };
  } catch {}
  return { ...clinic };
}

/** Reminders are never sent between these local hours; they slide to QUIET_HOURS.resumeAt. */
export const QUIET_HOURS = { start: 21, end: 8, resumeAt: 9 };

/** How long a voice-agent hold keeps a slot reserved. */
export const HOLD_MINUTES = 5;

/** Granularity of offered appointment start times. */
export const SLOT_STEP_MINUTES = 15;
