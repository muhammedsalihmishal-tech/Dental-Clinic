"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Moon, Plus, Search, Settings, Sun } from "lucide-react";
import { NAV } from "./nav";
import { CommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";

export function Topbar() {
  const path = usePathname();
  const { data: session } = useSession();
  const [dark, setDark] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  useEffect(() => {
    const handler = () => setPaletteOpen(true);
    window.addEventListener("cmd-k", handler);
    return () => window.removeEventListener("cmd-k", handler);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-8">
        <button
          onClick={() => setPaletteOpen(true)}
          className="relative flex flex-1 max-w-md items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-muted transition hover:bg-surface hover:text-fg"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search patients…</span>
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-medium sm:block">⌘K</kbd>
        </button>
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
    </>
  );
}
