import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const csv = [
    "First Name,Last Name,Phone,Email,Date of Birth,Gender,Address,Status,Language,Preferred Channel,Medical Alerts,Allergies,Insurance,Tags,Notes",
    'Jane,Doe,+919876543210,jane@example.com,1990-05-15,Female,"123 Main St, City",NEW,English,WHATSAPP,,,,,',
  ].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="patients-import-template.csv"',
    },
  });
}
