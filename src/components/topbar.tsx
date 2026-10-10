"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Moon, Plus, Search, Settings, Sun } from "lucide-react";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";

export function Topbar() {
  const router = useRouter();
  const path = usePathname();
  const { data: session } = useSession();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-8">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q");
            router.push(`/patients?q=${encodeURIComponent(String(q ?? ""))}`);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" placeholder="Search patients by name or phone…" className="input max-w-md pl-9" />
        </form>
        <button onClick={toggle} className="btn-ghost h-9 w-9 p-0" aria-label="Toggle theme">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <Link href="/appointments/new" className="btn-primary">
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New appointment</span>
        </Link>
        {session?.user && (
          <div className="flex items-center gap-1">
            {(session.user as { role?: string }).role === "ADMIN" && (
              <Link href="/settings/users" className="btn-ghost h-9 w-9 p-0" title="Settings">
                <Settings className="h-4 w-4" />
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="btn-ghost h-9 w-9 p-0"
              title={`Sign out (${session.user.name ?? session.user.email})`}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
        {NAV.map(({ href, label }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium", active ? "bg-brand-soft text-brand" : "text-muted")}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
