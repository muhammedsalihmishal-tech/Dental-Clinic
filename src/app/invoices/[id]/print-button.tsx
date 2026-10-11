"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button className="btn-primary gap-1.5" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> Print / Save PDF
    </button>
  );
}
