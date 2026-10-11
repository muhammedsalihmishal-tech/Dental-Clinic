import Link from "next/link";
import { CheckCircle2, CheckSquare, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { completeTask, createTask, deleteTask } from "@/app/actions";

export const dynamic = "force-dynamic";

type Filter = "all" | "urgent" | "done";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: rawFilter } = await searchParams;
  const filter: Filter = (rawFilter as Filter) ?? "all";

  const where =
    filter === "urgent"
      ? { done: false, priority: "URGENT" as const }
      : filter === "done"
        ? { done: true }
        : { done: false };

  const [tasks, openCount, urgentCount] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    prisma.task.count({ where: { done: false } }),
    prisma.task.count({ where: { done: false, priority: "URGENT" } }),
  ]);

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "Open", count: openCount },
    { key: "urgent", label: "Urgent", count: urgentCount },
    { key: "done", label: "Completed" },
  ];

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${openCount} open task${openCount !== 1 ? "s" : ""} · ${urgentCount} urgent`}
        icon={CheckSquare}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          {/* Filter tabs */}
          <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/tasks?filter=${t.key}`}
                className={[
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  filter === t.key ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                ].join(" ")}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                    t.key === "urgent" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-brand/15 text-brand",
                  ].join(" ")}>
                    {t.count}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Task list */}
          <Card>
            {tasks.length === 0 ? (
              <Empty>
                {filter === "done" ? "No completed tasks yet." : filter === "urgent" ? "No urgent tasks." : "All caught up ✨"}
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-3.5">
                    {!t.done && (
                      <form action={completeTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="mt-0.5 text-muted transition hover:text-emerald-500" aria-label="Mark done">
                          <CheckCircle2 className="h-5 w-5" />
                        </button>
                      </form>
                    )}
                    {t.done && (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={["text-sm", t.done ? "line-through text-muted" : ""].join(" ")}>{t.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span>{fmtDateTime(t.createdAt)}</span>
                        {t.patient && (
                          <Link href={`/patients/${t.patient.id}`} className="hover:text-brand">
                            {fullName(t.patient)}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.priority === "URGENT" && <Badge tone="rose">Urgent</Badge>}
                      {t.priority === "LOW" && <Badge tone="gray">Low</Badge>}
                      <form action={deleteTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="text-muted transition hover:text-rose-500" aria-label="Delete task">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Add task sidebar */}
        <Card title="New task">
          <form action={createTask} className="space-y-3 p-5">
            <input name="title" placeholder="Task title…" required className="input" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Priority</label>
                <select name="priority" className="input">
                  <option value="NORMAL">Normal</option>
                  <option value="URGENT">Urgent</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>
            <button className="btn-primary w-full">Add task</button>
          </form>
        </Card>
      </div>
    </>
  );
}
