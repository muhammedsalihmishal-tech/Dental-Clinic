import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PatientStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: PatientStatus[] = ["LEAD", "NEW", "ACTIVE", "NEEDS_FOLLOW_UP", "INACTIVE"];

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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const statusParam = req.nextUrl.searchParams.get("status") ?? "";
  const status = STATUSES.includes(statusParam as PatientStatus) ? (statusParam as PatientStatus) : undefined;

  const where: Prisma.PatientWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          AND: q.split(/\s+/).map((term) => ({
            OR: [
              { firstName: { contains: term, mode: "insensitive" as const } },
              { lastName: { contains: term, mode: "insensitive" as const } },
              { phone: { contains: term.replace(/[^\d+]/g, "") || term } },
              { email: { contains: term, mode: "insensitive" as const } },
            ],
          })),
        }
      : {}),
  };

  const patients = await prisma.patient.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      status: true,
      language: true,
      preferredChannel: true,
      medicalAlerts: true,
      allergies: true,
      insurance: true,
      tags: true,
      notes: true,
      optOut: true,
      createdAt: true,
    },
  });

  const header = row([
    "First Name", "Last Name", "Phone", "Email", "Date of Birth", "Gender",
    "Address", "Status", "Language", "Preferred Channel", "Medical Alerts",
    "Allergies", "Insurance", "Tags", "Notes", "Opt Out", "Created At",
  ]);

  const lines = patients.map((p) =>
    row([
      p.firstName,
      p.lastName,
      p.phone,
      p.email,
      p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
      p.gender,
      p.address,
      p.status,
      p.language,
      p.preferredChannel,
      p.medicalAlerts,
      p.allergies,
      p.insurance,
      p.tags.join("; "),
      p.notes,
      p.optOut ? "Yes" : "No",
      p.createdAt.toISOString().slice(0, 10),
    ])
  );

  const csv = [header, ...lines].join("\r\n");
  const filename = `patients-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
