"use client";

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { runReactivationCampaign } from "../actions";

export function ReactivateButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sent: number; skipped: number } | null>(null);

  function run() {
    startTransition(async () => {
      const r = await runReactivationCampaign();
      setResult(r);
    });
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-xs text-muted">
          Sent {result.sent}, skipped {result.skipped}
        </span>
      )}
      <button className="btn-ghost" onClick={run} disabled={pending}>
        <Users className="h-4 w-4" /> {pending ? "Running…" : "Reactivation campaign"}
      </button>
    </div>
  );
}
