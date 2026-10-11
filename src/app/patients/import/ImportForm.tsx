"use client";

import { useState, useRef } from "react";
import { Upload, Download, AlertTriangle, Check } from "lucide-react";
import { importPatients, type ImportRow, type ImportResult } from "@/app/actions";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let inQuote = false;
    let cur = "";
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuote) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQuote = false;
        else cur += c;
      } else {
        if (c === '"') inQuote = true;
        else if (c === ",") { cols.push(cur); cur = ""; }
        else cur += c;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

type ParsedRow = ImportRow & { _valid: boolean; _error?: string; _duplicate?: boolean };

export function ImportForm() {
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setFileError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const matrix = parseCSV(text);
      if (matrix.length < 2) {
        setFileError("CSV appears to be empty or has only a header row.");
        return;
      }
      const header = matrix[0].map((h) => h.trim().toLowerCase());
      const get = (row: string[], name: string) => {
        const i = header.indexOf(name.toLowerCase());
        return i >= 0 ? (row[i] ?? "").trim() : "";
      };

      const seenPhones = new Set<string>();
      const parsed: ParsedRow[] = matrix.slice(1).map((row) => {
        const phone = get(row, "phone");
        const firstName = get(row, "first name");
        let error: string | undefined;
        let duplicate = false;
        if (!firstName) error = "First Name required";
        else if (!phone) error = "Phone required";
        if (phone && !error) {
          if (seenPhones.has(phone)) duplicate = true;
          else seenPhones.add(phone);
        }
        return {
          firstName,
          lastName: get(row, "last name"),
          phone,
          email: get(row, "email"),
          dateOfBirth: get(row, "date of birth"),
          gender: get(row, "gender"),
          address: get(row, "address"),
          status: get(row, "status"),
          language: get(row, "language"),
          preferredChannel: get(row, "preferred channel"),
          medicalAlerts: get(row, "medical alerts"),
          allergies: get(row, "allergies"),
          insurance: get(row, "insurance"),
          tags: get(row, "tags"),
          notes: get(row, "notes"),
          _valid: !error && !duplicate,
          _error: error,
          _duplicate: duplicate,
        };
      });
      setRows(parsed);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!rows) return;
    const valid = rows.filter((r) => r._valid);
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const res = await importPatients(valid.map(({ _valid, _error, _duplicate, ...r }) => r));
    setResult(res);
    setLoading(false);
    setRows(null);
  }

  if (result) {
    return (
      <div className="card p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <div className="text-lg font-semibold">{result.created} patient{result.created !== 1 ? "s" : ""} imported</div>
          {result.skipped > 0 && (
            <div className="text-sm text-muted mt-1">{result.skipped} skipped (duplicates or invalid)</div>
          )}
        </div>
        {result.errors.length > 0 && (
          <div className="text-left rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800 p-4 space-y-1">
            {result.errors.slice(0, 10).map((e, i) => (
              <div key={i} className="text-xs text-rose-700 dark:text-rose-400">{e}</div>
            ))}
            {result.errors.length > 10 && (
              <div className="text-xs text-muted">…and {result.errors.length - 10} more</div>
            )}
          </div>
        )}
        <div className="flex justify-center gap-3">
          <a href="/patients" className="btn-primary">View patients</a>
          <button
            onClick={() => { setResult(null); if (inputRef.current) inputRef.current.value = ""; }}
            className="btn-ghost"
          >
            Import more
          </button>
        </div>
      </div>
    );
  }

  if (rows) {
    const valid = rows.filter((r) => r._valid);
    const invalid = rows.filter((r) => !r._valid);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted">
            {rows.length} rows —{" "}
            <span className="text-emerald-600 font-medium">{valid.length} valid</span>
            {invalid.length > 0 && (
              <>, <span className="text-rose-600 font-medium">{invalid.length} will be skipped</span></>
            )}
          </div>
          <button
            onClick={() => { setRows(null); if (inputRef.current) inputRef.current.value = ""; }}
            className="btn-ghost btn-sm"
          >
            Choose different file
          </button>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="table-head">#</th>
                <th className="table-head">First Name</th>
                <th className="table-head">Last Name</th>
                <th className="table-head">Phone</th>
                <th className="table-head hidden sm:table-cell">Email</th>
                <th className="table-head">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={i} className={r._valid ? "" : "bg-rose-50 dark:bg-rose-950/20"}>
                  <td className="table-cell text-muted">{i + 2}</td>
                  <td className="table-cell font-medium">
                    {r.firstName || <span className="text-rose-500">—</span>}
                  </td>
                  <td className="table-cell text-muted">{r.lastName}</td>
                  <td className="table-cell">
                    {r.phone || <span className="text-rose-500">—</span>}
                  </td>
                  <td className="table-cell hidden sm:table-cell text-muted">{r.email}</td>
                  <td className="table-cell">
                    {r._error ? (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-600">
                        <AlertTriangle className="h-3 w-3" />{r._error}
                      </span>
                    ) : r._duplicate ? (
                      <span className="text-xs text-amber-600">Duplicate phone</span>
                    ) : (
                      <span className="text-xs text-emerald-600">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {valid.length > 0 ? (
          <button onClick={handleImport} disabled={loading} className="btn-primary">
            {loading ? "Importing…" : `Import ${valid.length} patient${valid.length !== 1 ? "s" : ""}`}
          </button>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-400">
            No valid rows to import. Please check your file and try again.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="card flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border p-12 text-center cursor-pointer hover:border-brand/50 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
          <Upload className="h-6 w-6 text-muted" />
        </div>
        <div>
          <div className="font-semibold">Drop your CSV here or click to browse</div>
          <div className="mt-1 text-sm text-muted">First Name and Phone are required columns</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      {fileError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 p-4 text-sm text-rose-700 dark:text-rose-400">
          {fileError}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Download className="h-4 w-4 shrink-0" />
        <span>Not sure about the format?</span>
        <a href="/api/patients/import-template" download className="text-brand hover:underline">
          Download template CSV
        </a>
      </div>
    </div>
  );
}
