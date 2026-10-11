import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const term = q.replace(/[^\d+]/g, "") || q;

  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: term } },
        {
          AND: q.includes(" ")
            ? q.split(" ").filter(Boolean).map((w) => ({
                OR: [
                  { firstName: { contains: w, mode: "insensitive" } },
                  { lastName: { contains: w, mode: "insensitive" } },
                ],
              }))
            : [{ firstName: { contains: q, mode: "insensitive" } }],
        },
      ],
    },
    select: { id: true, firstName: true, lastName: true, phone: true, status: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 8,
  });

  return NextResponse.json(patients);
}
