import Link from "next/link";
import type { PatientStatus, Prisma } from "@prisma/client";
import { Download, Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/time";
import { cn, fullName, titleCase } from "@/lib/utils";
import { Avatar, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { PatientBadge } from "@/components/badges";
import { noShowRiskScore } from "@/lib/risk";

export const dynamic = "force-dynamic";

const STATUSES: PatientStatus[] = ["LEAD", "NEW", "ACTIVE", "NEEDS_FOLLOW_UP", "INACTIVE"];

export default async function PatientsPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const q = searchParams.q?.trim() ?? "";
  const status = STATUSES.includes(searchParams.status as PatientStatus) ? (searchParams.status as PatientStatus) : undefined;
  const now = new Date();

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

  const [patients, counts] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        appointments: {
          orderBy: { start: "desc" },
          select: { status: true, start: true },
        },
        records: { orderBy: { performedAt: "desc" }, take: 1, include: { treatmentType: true } },
      },
    }),
    prisma.patient.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: PatientStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const link = (s?: PatientStatus) => `/patients?${new URLSearchParams({ ...(q ? { q } : {}), ...(s ? { status: s } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={q ? `Results for "${q}"` : "Every patient, their history and what's next."}
        actions={
          <div className="flex gap-2">
            <a
              href={`/api/patients/export?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) })}`}
              className="btn-ghost"
              download
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
            <Link href="/patients/import" className="btn-ghost">
              <Upload className="h-4 w-4" /> Import CSV
            </Link>
            <Link href="/patients/new" className="btn-primary">
              <Plus className="h-4 w-4" /> New patient
            </Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={link()} className={cn("btn-ghost btn-sm", !status && "border-brand text-brand")}>All</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={link(s)} className={cn("btn-ghost btn-sm", status === s && "border-brand text-brand")}>
            {titleCase(s)} <span className="text-muted">{countOf(s)}</span>
          </Link>
        ))}
      </div>
      <Card>
        {patients.length === 0 ? (
          <Empty>No patients found.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="table-head">Patient</th>
                  <th className="table-head">Status</th>
                  <th className="table-head hidden md:table-cell">Last treatment</th>
                  <th className="table-head hidden lg:table-cell">Next visit</th>
                  <th className="table-head hidden xl:table-cell">Risk</th>
                  <th className="table-head hidden lg:table-cell">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patients.map((p) => (
                  <tr key={p.id} className="transition hover:bg-surface-2/60">
                    <td className="table-cell">
                      <Link href={`/patients/${p.id}`} className="flex items-center gap-3">
                        <Avatar name={fullName(p)} size="sm" />
                        <div>
                          <div className="font-medium hover:text-brand">{fullName(p)}</div>
                          <div className="text-xs text-muted">{p.phone}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="table-cell"><PatientBadge status={p.status} /></td>
                    <td className="table-cell hidden text-muted md:table-cell">
                      {p.records[0] ? `${p.records[0].treatmentType.name} · ${fmtDate(p.records[0].performedAt)}` : "—"}
                    </td>
                    <td className="table-cell hidden text-muted lg:table-cell">
                      {(() => {
                        const next = p.appointments.filter((a) => ["SCHEDULED", "CONFIRMED"].includes(a.status) && a.start > now).sort((a, b) => a.start.getTime() - b.start.getTime())[0];
                        return next ? fmtDate(next.start) : "—";
                      })()}
                    </td>
                    <td className="table-cell hidden xl:table-cell">
                      {(() => { const r = noShowRiskScore(p); return r.score > 0 ? <span className="text-xs font-medium" style={{ color: r.color }}>{r.label}</span> : <span className="text-muted">—</span>; })()}
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {p.medicalAlerts && <Badge tone="rose">⚠ Alert</Badge>}
                        {p.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
