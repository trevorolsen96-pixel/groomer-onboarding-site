"use client";

import { useRef, useState } from "react";

type Pet = { name: string; breed: string | null };

type ParsedRow = {
  firstName: string;
  lastName: string;
  email: string | null;
  primaryPhone: string | null;
  additionalPhone: string | null;
  address: string;
  notes: string | null;
  status: string;
  pets: Pet[];
  createDate: string | null;
};

type ImportResult = {
  imported: { wagzlyId: string; name: string; petCount: number }[];
  duplicates: { wagzlyId: string; name: string; phone: string; petCount: number }[];
  skipped: { name: string; reason: string }[];
};

type Software = "moego" | null;

const REQUIRED_MOEGO_COLUMNS = ["first name", "last name", "primary contact", "pet(breed)", "status"];

function validateMoeGoHeaders(headers: string[]): string | null {
  const normalized = headers.map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  const missing = REQUIRED_MOEGO_COLUMNS.filter((col) => !normalized.includes(col));
  if (missing.length > 0) return `This doesn't look like a MoeGo client export. Make sure you export from Clients & Pets → Options → Export clients, not from another section.`;
  return null;
}

function parsePets(raw: string): Pet[] {
  if (!raw?.trim()) return [];
  const pets: Pet[] = [];
  const parts = raw.split(/,(?![^(]*\))/);
  for (const part of parts) {
    const trimmed = part.trim();
    const match = trimmed.match(/^(.+?)\((.+)\)$/);
    if (match) {
      pets.push({ name: match[1].trim(), breed: match[2].trim() || null });
    } else if (trimmed) {
      pets.push({ name: trimmed, breed: null });
    }
  }
  return pets;
}

function parseCSVRecords(text: string): string[][] {
  const records: string[][] = [];
  let fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else if (!inQuotes && (ch === "\n" || (ch === "\r" && next === "\n"))) {
      if (ch === "\r") i++;
      fields.push(current.trim());
      current = "";
      if (fields.some((f) => f)) records.push(fields);
      fields = [];
    } else if (!inQuotes && ch === "\r") {
      fields.push(current.trim());
      current = "";
      if (fields.some((f) => f)) records.push(fields);
      fields = [];
    } else {
      current += ch;
    }
  }

  fields.push(current.trim());
  if (fields.some((f) => f)) records.push(fields);

  return records;
}

type ParseCSVResult = { rows: ParsedRow[]; validationError: string | null };

function parseCSV(text: string): ParseCSVResult {
  const records = parseCSVRecords(text);
  if (records.length < 2) return { rows: [], validationError: null };

  const headers = records[0].map((h) => h.toLowerCase().replace(/\s+/g, " ").trim());
  const validationError = validateMoeGoHeaders(headers);
  if (validationError) return { rows: [], validationError };

  const col = (name: string) => headers.findIndex((h) => h === name);

  const iFirstName = col("first name");
  const iLastName = col("last name");
  const iEmail = col("email");
  const iPhone = col("primary contact");
  const iAdditional = col("additional contact");
  const iAddress = col("address");
  const iNotes = col("notes");
  const iStatus = col("status");
  const iPets = col("pet(breed)");
  const iCreateDate = col("create date");

  if (iFirstName === -1 && iLastName === -1) return [];

  const rows: ParsedRow[] = [];

  for (let i = 1; i < records.length; i++) {
    const f = records[i];
    const get = (idx: number) => (idx >= 0 ? f[idx]?.trim() ?? "" : "");

    const firstName = get(iFirstName);
    const lastName = get(iLastName);
    if (!firstName && !lastName) continue;

    rows.push({
      firstName,
      lastName,
      email: get(iEmail) || null,
      primaryPhone: get(iPhone) || null,
      additionalPhone: get(iAdditional) || null,
      address: get(iAddress),
      notes: get(iNotes) || null,
      status: get(iStatus) || "inactive",
      pets: parsePets(get(iPets)),
      createDate: get(iCreateDate) || null,
    });
  }

  return { rows, validationError: null };
}

function MoeGoImportFlow({ accessToken, onBack }: { accessToken: string; onBack: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  function readFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, validationError } = parseCSV(text);
      if (validationError) {
        setError(validationError);
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      setPreview(rows);
    };
    reader.readAsText(file);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  async function handleImport() {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    setError("");

    try {
      const response = await fetch("/api/import/moego", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ rows: preview }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Import failed.");
      setResult(data);
      setPreview(null);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setPreview(null);
    setResult(null);
    setError("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const totalPets = preview?.reduce((sum, r) => sum + r.pets.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className="soft-card p-6">
        <button
          type="button"
          onClick={result ? handleReset : onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {result ? "Import another file" : "Back to software selection"}
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
          Import from MoeGo
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Clients &amp; Pets
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Upload a MoeGo client export CSV to import your clients and pets into Wagzly.
          This importer brings in <strong>client profiles and pet information only</strong> — grooming history
          and notes are not included. Duplicate clients are matched by phone number and reported, not duplicated.
          Both active and inactive clients will be imported.
        </p>

        {/* How to export instructions */}
        <div className="mt-5 rounded-2xl border border-[var(--divider-soft)] bg-[var(--soft-surface)] overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            onClick={() => setInstructionsOpen((o) => !o)}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 text-[var(--rose-primary)]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              How to export your clients from MoeGo
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-4 w-4 text-[var(--text-secondary)] transition-transform ${instructionsOpen ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {instructionsOpen && (
            <div className="border-t border-[var(--divider-soft)] px-5 pb-5 pt-4">
              <ol className="space-y-3">
                {[
                  { step: "1", text: <>Log in to MoeGo at <strong>app.moego.pet</strong> in your web browser (not the mobile app).</> },
                  { step: "2", text: <>In the left sidebar, expand <strong>Customer Center</strong> and click <strong>Clients &amp; Pets</strong>.</> },
                  { step: "3", text: <>Click the <strong>checkbox</strong> at the top of the client list to select all clients.</> },
                  { step: "4", text: <>Click the <strong>Options</strong> dropdown at the top of the page and select <strong>Export clients</strong>.</> },
                  { step: "5", text: <>A CSV file will download to your computer. <strong>Drag it into the upload area below</strong>, or click to browse for it.</> },
                ].map(({ step, text }) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rose-primary)]/10 text-xs font-bold text-[var(--rose-primary)]">
                      {step}
                    </span>
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">{text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {!result ? (
          <div
            className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging
                ? "border-[var(--rose-primary)] bg-[var(--rose-primary)]/5"
                : "border-[var(--divider-soft)] bg-[var(--soft-surface)] hover:border-[var(--rose-primary)] hover:bg-[var(--rose-primary)]/5"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileRef.current?.click()}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={`h-10 w-10 transition-colors ${dragging ? "text-[var(--rose-primary)]" : "text-[var(--text-secondary)]"}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V6a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 text-sm font-bold text-[var(--text-primary)]">
              {fileName ? fileName : "Drop your MoeGo CSV here"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              or <span className="font-semibold text-[var(--rose-primary)]">click to browse</span>
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFile}
            />
          </div>
        ) : null}
      </section>

      {/* Error */}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {/* Preview */}
      {preview && preview.length > 0 && !result ? (
        <section className="soft-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--divider-soft)] px-6 py-4">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                Preview — {preview.length} clients · {totalPets} pets
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Review before importing. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" className="secondary-button" onClick={handleReset}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? "Importing..." : `Import ${preview.length} clients`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--divider-soft)] bg-[var(--soft-surface)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Address</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Pets</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--divider-soft)] last:border-0 hover:bg-[var(--soft-surface)]"
                  >
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      {[row.firstName, row.lastName].filter(Boolean).join(" ")}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.primaryPhone || <span className="opacity-50">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.address ? (
                        <span className="max-w-[200px] truncate block">{row.address}</span>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {row.pets.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--soft-surface)] px-2 py-0.5 text-xs font-bold text-[var(--text-primary)]">
                          🐾 {row.pets.length}
                        </span>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          row.status?.toLowerCase() === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-[var(--soft-surface)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {row.status || "inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {preview && preview.length === 0 && !result ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700">
          No clients found in this file. Make sure you exported a MoeGo client CSV.
        </div>
      ) : null}

      {/* Results */}
      {result ? (
        <section className="soft-card overflow-hidden">
          <div className="border-b border-[var(--divider-soft)] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
              Import complete
            </p>
            <h3 className="mt-1 text-xl font-bold text-[var(--text-primary)]">
              Results
            </h3>
          </div>

          <div className="grid grid-cols-3 divide-x divide-[var(--divider-soft)] border-b border-[var(--divider-soft)]">
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Imported</p>
              <p className="mt-1 text-3xl font-bold text-green-600">{result.imported.length}</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {result.imported.reduce((s, r) => s + r.petCount, 0)} pets
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Duplicates</p>
              <p className="mt-1 text-3xl font-bold text-amber-500">{result.duplicates.length}</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">matched to existing</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Skipped</p>
              <p className="mt-1 text-3xl font-bold text-red-500">{result.skipped.length}</p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">errors / missing data</p>
            </div>
          </div>

          {result.duplicates.length > 0 ? (
            <div className="px-6 py-5">
              <p className="text-sm font-bold text-[var(--text-primary)]">
                Duplicate clients — matched to existing Wagzly records
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                These clients were not re-imported. Their existing Wagzly IDs are shown below for reference when importing future data.
              </p>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--divider-soft)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--divider-soft)] bg-[var(--soft-surface)]">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Wagzly ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Pets in file</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.duplicates.map((d, i) => (
                      <tr key={i} className="border-b border-[var(--divider-soft)] last:border-0">
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{d.name}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{d.phone}</td>
                        <td className="px-4 py-3">
                          <code className="rounded bg-[var(--soft-surface)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                            {d.wagzlyId}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{d.petCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {result.skipped.length > 0 ? (
            <div className="px-6 pb-5">
              <p className="text-sm font-bold text-[var(--text-primary)]">Skipped rows</p>
              <div className="mt-3 space-y-2">
                {result.skipped.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 shrink-0 text-red-500">
                      <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                    </svg>
                    <p className="text-sm text-red-700">
                      <strong>{s.name}</strong> — {s.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-[var(--divider-soft)] px-6 py-4">
            <button type="button" className="secondary-button" onClick={onBack}>
              Back to software selection
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function MoeGoImporter({ accessToken }: { accessToken: string }) {
  const [selected, setSelected] = useState<Software>(null);

  if (selected === "moego") {
    return <MoeGoImportFlow accessToken={accessToken} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      <section className="soft-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--rose-primary)]">
          Data Import
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Import your data
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Select the software you are migrating from. Wagzly will guide you through importing
          your clients and pets. More import types will be added over time.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* MoeGo — available */}
        <button
          type="button"
          onClick={() => setSelected("moego")}
          className="soft-card group flex flex-col gap-4 p-6 text-left transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rose-primary)]/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-[var(--rose-primary)]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
              Available
            </span>
          </div>
          <div>
            <p className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--rose-primary)] transition-colors">
              Import from MoeGo
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Clients &amp; pets from a MoeGo CSV export
            </p>
          </div>
        </button>

        {/* GroomMore — coming soon */}
        <div className="soft-card flex flex-col gap-4 p-6 opacity-60">
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--soft-surface)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-[var(--text-secondary)]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <span className="inline-flex items-center rounded-full bg-[var(--soft-surface)] px-2.5 py-0.5 text-xs font-bold text-[var(--text-secondary)]">
              Coming soon
            </span>
          </div>
          <div>
            <p className="text-base font-bold text-[var(--text-primary)]">
              Import from GroomMore
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Clients &amp; pets from a GroomMore export
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
