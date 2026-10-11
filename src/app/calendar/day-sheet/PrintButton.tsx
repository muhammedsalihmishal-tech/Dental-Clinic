"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-ghost print:hidden gap-1.5">
      <Printer className="h-4 w-4" /> Print
    </button>
  );
}
