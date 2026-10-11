import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/utils";

function escape(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(values: (string | null | undefined)[]): string {
  return values.map(escape).join(",");
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      messages: {
        include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let conversions = new Set<string>();
  if (campaign.status === "SENT" && campaign.sentAt) {
    const cutoff = new Date(campaign.sentAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const recipientIds = campaign.messages.map((m) => m.patientId);
    const bookers = await prisma.appointment.findMany({
      where: {
        patientId: { in: recipientIds },
        createdAt: { gte: campaign.sentAt, lte: cutoff },
        status: { not: "HELD" },
      },
      select: { patientId: true },
      distinct: ["patientId"],
    });
    conversions = new Set(bookers.map((b) => b.patientId));
  }

  const header = row(["Name", "Phone", "Channel", "Sent", "Error", "Booked within 14d"]);
  const lines = campaign.messages.map((m) =>
    row([
      fullName(m.patient),
      m.patient.phone,
      campaign.channel,
      m.sent ? "Yes" : "No",
      m.error,
      conversions.has(m.patientId) ? "Yes" : "No",
    ])
  );

  const csv = [header, ...lines].join("\r\n");
  const slug = campaign.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const filename = `campaign-${slug}-recipients.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
