"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-indigo-500 text-lg text-white shadow-lg shadow-teal-500/20">
          🦷
        </div>
        <div>
          <div className="text-sm font-semibold">Smile Studio</div>
          <div className="text-xs text-muted">Dental CRM</div>
        </div>
      </Link>
      <nav className="space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-border bg-gradient-to-br from-teal-500/10 to-indigo-500/10 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-brand" /> AI receptionist
        </div>
        <p className="mt-1 text-xs text-muted">Answering calls and booking 24/7 from live doctor availability.</p>
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Online
        </div>
      </div>
    </aside>
  );
}
