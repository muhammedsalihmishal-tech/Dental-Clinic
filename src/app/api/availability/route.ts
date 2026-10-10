import { NextResponse } from "next/server";
import { getAvailability } from "@/lib/availability";
import { fmtTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const treatmentTypeId = url.searchParams.get("treatmentTypeId");
  const date = url.searchParams.get("date");
  const doctorId = url.searchParams.get("doctorId") || undefined;
  if (!treatmentTypeId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "treatmentTypeId and date (YYYY-MM-DD) are required" }, { status: 400 });
  }
  const result = await getAvailability({ treatmentTypeId, date, doctorId });
  return NextResponse.json(
    result.map((r) => ({ doctor: r.doctor, slots: r.slots.map((s) => ({ start: s.toISOString(), label: fmtTime(s) })) })),
  );
}
