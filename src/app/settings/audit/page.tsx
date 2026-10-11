import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const ENTITY_TONES: Record<string, "teal" | "indigo" | "amber" | "rose" | "gray"> = {
  Patient: "teal",
  Appointment: "indigo",
  Invoice: "amber",
  User: "rose",
};

const ACTION_TONES: Record<string, "teal" | "indigo" | "gray"> = {
  CREATE: "teal",
  UPDATE: "indigo",
  DELETE: "gray",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; userId?: string; from?: string; to?: string; page?: string }>;
}) {
  const { entity, userId, from, to, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {};
  if (entity) where.entity = entity;
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59Z`) } : {}),
    };
  }

  const [logs, total, users, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ select: { entity: true }, distinct: ["entity"], orderBy: { entity: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const vals = { entity, userId, from, to, page: "1", ...overrides };
    for (const [k, v] of Object.entries(vals)) {
      if (v) params.set(k, v);
    }
    return `/settings/audit?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={`${total} event${total !== 1 ? "s" : ""}`}
        icon={ClipboardList}
      />

      {/* Filters */}
      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Entity type</label>
            <select name="entity" defaultValue={entity ?? ""} className="input min-w-[140px]">
              <option value="">All types</option>
              {entities.map((e) => (
                <option key={e.entity} value={e.entity}>{e.entity}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Staff member</label>
            <select name="userId" defaultValue={userId ?? ""} className="input min-w-[160px]">
              <option value="">All staff</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">From</label>
            <input type="date" name="from" defaultValue={from ?? ""} className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">To</label>
            <input type="date" name="to" defaultValue={to ?? ""} className="input" />
          </div>
          <button type="submit" className="btn-primary">Filter</button>
          <Link href="/settings/audit" className="btn-ghost">Reset</Link>
        </form>
      </Card>

      {/* Log table */}
      <Card>
        {logs.length === 0 ? (
          <Empty>No audit events match your filters.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Staff</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-2/50">
                    <td className="whitespace-nowrap px-5 py-3 text-muted">
                      {fmtDateTime(log.createdAt)}
                    </td>
                    <td className="px-5 py-3 font-medium">{log.user.name}</td>
                    <td className="px-5 py-3">
                      <Badge tone={ACTION_TONES[log.action] ?? "gray"}>{log.action}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={ENTITY_TONES[log.entity] ?? "gray"}>{log.entity}</Badge>
                    </td>
                    <td className="max-w-xs truncate px-5 py-3 text-muted">{log.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={buildHref({ page: String(page - 1) })} className="btn-ghost text-xs">
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={buildHref({ page: String(page + 1) })} className="btn-ghost text-xs">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
