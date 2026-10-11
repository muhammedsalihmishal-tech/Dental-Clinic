import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImportForm } from "./ImportForm";

export default function ImportPatientsPage() {
  return (
    <>
      <div className="mb-6">
        <Link href="/patients" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to patients
        </Link>
      </div>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Import patients</h1>
          <p className="mt-1 text-sm text-muted">
            Upload a CSV file to bulk-import patients. Existing patients matched by phone are skipped.
          </p>
        </div>
        <ImportForm />
      </div>
    </>
  );
}
