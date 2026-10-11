import Link from "next/link";
import { CheckSquare, CircleDashed, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate, todayString } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { completeTask, deleteTask } from "@/app/actions";

export const dynamic = "force-dynamic";

const PRIORITY_TONE = {
  URGENT: "text-rose-500 font-semibold",
  NORMAL: "text-fg",
  LOW: "text-muted",
} as const;

const PRIORITY_LABEL = { URGENT: "Urgent", NORMAL: "Normal", LOW: "Low" } as const;

export default async function TasksPage() {
  const today = todayString();
  const todayStart = new Date(`${today}T00:00:00`);

  const [tasks, totalDone] = await Promise.all([
    prisma.task.findMany({
      where: { done: false },
      include: { patient: true },
      orderBy: [{ priority: "asc" }, { dueAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.task.count({ where: { done: true } }),
  ]);

  // Group by bucket: overdue / due today / upcoming / no due date
  const overdue = tasks.filter((t) => t.dueAt && t.dueAt < todayStart);
  const dueToday = tasks.filter((t) => t.dueAt && t.dueAt >= todayStart && fmtDate(t.dueAt) === fmtDate(todayStart));
  const upcoming = tasks.filter((t) => t.dueAt && t.dueAt > todayStart && fmtDate(t.dueAt) !== fmtDate(todayStart));
  const noDueDate = tasks.filter((t) => !t.dueAt);

  const urgent = tasks.filter((t) => t.priority === "URGENT").length;

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="All open tasks across every patient."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Open tasks" value={tasks.length} hint={`${urgent} urgent`} icon={CircleDashed} tone="indigo" />
        <StatCard label="Overdue" value={overdue.length} hint="Past due date" icon={AlertCircle} tone={overdue.length > 0 ? "rose" : "gray"} />
        <StatCard label="Completed (all time)" value={totalDone} icon={CheckSquare} tone="emerald" />
      </div>

      {tasks.length === 0 ? (
        <Card><Empty>No open tasks. Add tasks from a patient&apos;s profile.</Empty></Card>
      ) : (
        <div className="space-y-6">
          {[
            { label: "Overdue", items: overdue, labelClass: "text-rose-500" },
            { label: "Due today", items: dueToday, labelClass: "text-amber-500" },
            { label: "Upcoming", items: upcoming, labelClass: "text-fg" },
            { label: "No due date", items: noDueDate, labelClass: "text-muted" },
          ]
            .filter((g) => g.items.length > 0)
            .map(({ label, items, labelClass }) => (
              <div key={label}>
                <h2 className={`mb-2 text-xs font-semibold uppercase tracking-wider ${labelClass}`}>
                  {label} · {items.length}
                </h2>
                <Card>
                  <ul className="divide-y divide-border">
                    {items.map((t) => (
                      <li key={t.id} className="flex items-start gap-3 px-5 py-3.5">
                        {/* Complete button */}
                        <form action={completeTask} className="mt-0.5 shrink-0">
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            title="Mark done"
                            className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-border text-muted transition hover:border-brand hover:text-brand"
                          >
                            <CheckSquare className="h-3 w-3" />
                          </button>
                        </form>

                        {/* Task body */}
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${PRIORITY_TONE[t.priority]}`}>{t.title}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                            {t.patient && (
                              <Link href={`/patients/${t.patient.id}`} className="hover:text-brand">
                                {fullName(t.patient)}
                              </Link>
                            )}
                            {t.dueAt && <span>Due {fmtDate(t.dueAt)}</span>}
                            <span className={t.priority === "URGENT" ? "text-rose-500" : ""}>{PRIORITY_LABEL[t.priority]}</span>
                          </div>
                        </div>

                        {/* Delete button */}
                        <form action={deleteTask} className="shrink-0">
                          <input type="hidden" name="id" value={t.id} />
                          <button className="text-xs text-muted hover:text-rose-500 transition">×</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            ))}
        </div>
      )}
    </>
  );
}
