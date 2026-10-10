import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions, icon: Icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 fade-in">
      <div className="flex items-center gap-3">
        {Icon && <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><Icon className="h-5 w-5" /></div>}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card fade-in min-w-0", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const tones = {
  gray: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  teal: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Avatar({ name, color, size = "md" }: { name: string; color?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-xl" };
  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold text-white", sizes[size])}
      style={{ background: color ?? `linear-gradient(135deg, #2dd4bf, #6366f1)` }}
    >
      {initials(name)}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "teal" }: { label: string; value: ReactNode; hint?: string; icon: LucideIcon; tone?: Tone }) {
  return (
    <div className="card fade-in p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-muted">{children}</div>;
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
