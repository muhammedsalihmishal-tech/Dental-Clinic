"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, User } from "lucide-react";

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  NEW: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  LEAD: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  NEEDS_FOLLOW_UP: "bg-rose-500/15 text-rose-500",
  INACTIVE: "bg-muted/30 text-muted",
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open on ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!open) {
          // Opening is triggered from the topbar button which sets open=true
          // If not yet open, dispatch a custom event for the topbar to catch
          window.dispatchEvent(new CustomEvent("cmd-k"));
        } else {
          onClose();
        }
      }
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data: Patient[] = await res.json();
        setResults(data);
        setActive(0);
      } finally {
        setLoading(false);
      }
    }, 180);
  }, []);

  const navigate = useCallback((id: string) => {
    onClose();
    router.push(`/patients/${id}`);
  }, [router, onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && results[active]) navigate(results[active].id);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl mx-4">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
            onKeyDown={onKeyDown}
            placeholder="Search patients by name or phone…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted sm:block">ESC</kbd>
        </div>

        {/* Results */}
        {query.length >= 2 && (
          <ul className="max-h-72 overflow-y-auto py-2">
            {loading && (
              <li className="px-4 py-3 text-sm text-muted">Searching…</li>
            )}
            {!loading && results.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted">No patients found for &ldquo;{query}&rdquo;</li>
            )}
            {!loading && results.map((p, i) => (
              <li key={p.id}>
                <button
                  className={[
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition",
                    i === active ? "bg-surface-2" : "hover:bg-surface-2/60",
                  ].join(" ")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => navigate(p.id)}
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.firstName} {p.lastName}</div>
                    <div className="text-xs text-muted">{p.phone}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[p.status] ?? "bg-muted/20 text-muted"}`}>
                    {p.status.replace("_", " ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Footer hint */}
        {query.length < 2 && (
          <div className="px-4 py-3 text-xs text-muted">
            Type at least 2 characters to search · <kbd className="rounded border border-border px-1 py-0.5">↑</kbd> <kbd className="rounded border border-border px-1 py-0.5">↓</kbd> navigate · <kbd className="rounded border border-border px-1 py-0.5">↵</kbd> open
          </div>
        )}
      </div>
    </div>
  );
}
