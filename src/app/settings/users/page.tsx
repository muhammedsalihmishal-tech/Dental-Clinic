import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ShieldCheck, UserCog } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";
import { createUser, toggleUser, resetPassword } from "@/app/settings/actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { ADMIN: "Admin", DOCTOR: "Doctor", RECEPTIONIST: "Receptionist" };
const ROLE_TONE = { ADMIN: "violet", DOCTOR: "indigo", RECEPTIONIST: "emerald" } as const;

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const auditLogs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader title="User management" subtitle="Staff accounts and access control" icon={UserCog} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title={`Staff accounts (${users.length})`}>
            {users.length === 0 ? (
              <Empty>No users yet.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-indigo-400 text-sm font-bold text-white">
                      {u.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{u.name}</span>
                        <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                        {!u.active && <Badge tone="rose">Inactive</Badge>}
                      </div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </div>
                    <div className="flex gap-2">
                      <form action={toggleUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(!u.active)} />
                        <button className="btn-ghost btn-sm">{u.active ? "Disable" : "Enable"}</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Audit log">
            {auditLogs.length === 0 ? (
              <Empty>No audit entries yet.</Empty>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {auditLogs.map((log) => (
                  <li key={log.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{log.user.name}</span>
                      <span className="text-xs text-muted">{fmtDateTime(log.createdAt)}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {log.action} · {log.entity}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}
                      {log.detail && ` · ${log.detail}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /> Add staff account</span>}>
            <form action={createUser} className="space-y-3 p-5">
              <div>
                <label className="label">Full name</label>
                <input name="name" required className="input mt-1" placeholder="Dr. Jane Smith" />
              </div>
              <div>
                <label className="label">Email</label>
                <input name="email" type="email" required className="input mt-1" placeholder="jane@clinic.com" />
              </div>
              <div>
                <label className="label">Role</label>
                <select name="role" className="input mt-1">
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="label">Temporary password</label>
                <input name="password" type="password" required minLength={8} className="input mt-1" placeholder="Min 8 characters" />
              </div>
              <button className="btn-primary w-full">Create account</button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
