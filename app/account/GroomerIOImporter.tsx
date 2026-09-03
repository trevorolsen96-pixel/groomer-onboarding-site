"use client";

import { useRef, useState } from "react";
import { parseCSVRecords } from "./csvParser";

export type GroomerIOPet = {
  name: string;
  birthday: string | null;
  sex: "male" | "female" | null;
  notes: string | null;
};

export type ParsedRow = {
  firstName: string;
  lastName: string;
  email: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  address: string;
  notes: string | null;
  pets: GroomerIOPet[];
  createDate: string | null;
  lastAppt: string | null;
};

type ImportResult = {
  imported: { wagzlyId: string; name: string; petCount: number }[];
  duplicates: { wagzlyId: string; name: string; phone: string; petCount: number }[];
  skipped: { name: string; reason: string }[];
};

// Groomer.io's own export is called a "Client Summary" -- these are the
// columns unique enough to that report to tell it apart from some other
// CSV someone drags in by mistake.
const REQUIRED_GROOMERIO_COLUMNS = ["customer_id", "first_name", "last_name", "pets", "full address"];

function validateGroomerIOHeaders(headers: string[]): string | null {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const missing = REQUIRED_GROOMERIO_COLUMNS.filter((col) => !normalized.includes(col));
  if (missing.length > 0) {
    return `This doesn't look like a Groomer.io Client Summary export. Make sure you're uploading that report, not another one.`;
  }
  return null;
}

function normalizeSex(raw: string): "male" | "female" | null {
  const value = raw.trim().toLowerCase();
  if (value === "m") return "male";
  if (value === "f") return "female";
  return null;
}

// "Bonita: 2021-04-18,Champion: 2021-04-18,Coco: N/A" -> name -> date map,
// skipping "N/A"/blank dates. Matched to pet names by name rather than by
// position, since a handful of rows have a birthday entry missing or
// extra for one of their pets.
function parseBirthdayMap(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw.trim()) return map;
  for (const part of raw.split(",")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const date = part.slice(idx + 1).trim();
    if (name && date && date.toUpperCase() !== "N/A" && !Number.isNaN(Date.parse(date))) {
      map.set(name, date);
    }
  }
  return map;
}

// "pets" is a flat comma list ("Lulu,Luna") with no per-pet delimiter for
// name vs. anything else, unlike MoeGo's "Name(Breed)" -- groomer.io just
// doesn't export breed at all.
function parsePets(petsRaw: string, birthdayRaw: string, genderRaw: string, petNotesRaw: string): GroomerIOPet[] {
  const names = petsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) return [];

  const birthdays = parseBirthdayMap(birthdayRaw);
  // Both gender and the care-notes field are one column per CLIENT ROW,
  // not per pet -- only safe to attribute either to the pet when there's
  // exactly one on the row. With more than one, the notes go on the
  // customer record instead (see buildCustomerNotes) so they aren't lost.
  const singlePet = names.length === 1;
  const sex = singlePet ? normalizeSex(genderRaw) : null;
  const notes = singlePet ? petNotesRaw.trim() || null : null;

  return names.map((name) => ({
    name,
    birthday: birthdays.get(name) ?? null,
    sex,
    notes,
  }));
}

// "Charidan Morales\n546 Maydee Street \nDuarte, CA 91010" -- first line
// always repeats the client's own name, so drop it and join what's left.
function parseAddress(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return lines.join(", ");
  return lines.slice(1).join(", ");
}

// mobile > home > work; first non-empty is primary, next non-empty AND
// DIFFERENT number becomes the secondary contact number -- several rows
// in real exports have the same number entered in more than one column,
// which would otherwise turn into a bogus "secondary contact" that's
// actually just the primary number again.
function pickPhones(mobile: string, home: string, work: string): { primaryPhone: string | null; secondaryPhone: string | null } {
  const candidates = [mobile, home, work].map((v) => v.trim()).filter(Boolean);
  const primaryPhone = candidates[0] ?? null;
  const primaryDigits = primaryPhone?.replace(/\D/g, "");
  const secondaryPhone = candidates.slice(1).find((v) => v.replace(/\D/g, "") !== primaryDigits) ?? null;
  return { primaryPhone, secondaryPhone };
}

// Groomer.io's summary has no free-form "client notes only" split the way
// Wagzly does -- it has client notes, pet-care notes (one field covering
// every pet on the row), and lifetime stats. All of it lands on the
// customer's notes field, since a multi-pet row has nowhere else to put
// per-pet care notes unambiguously; a single-pet row's care notes go on
// that pet instead (see buildPets below) and aren't duplicated here.
function buildCustomerNotes({
  clientNotes,
  petNotes,
  singlePet,
  apptCount,
  spend,
  lastAppt,
}: {
  clientNotes: string;
  petNotes: string;
  singlePet: boolean;
  apptCount: string;
  spend: string;
  lastAppt: string;
}): string | null {
  const parts: string[] = [];
  if (clientNotes) parts.push(clientNotes);
  if (petNotes && !singlePet) parts.push(`Pet notes: ${petNotes}`);

  const summary: string[] = [];
  const apptCountNum = parseInt(apptCount, 10);
  if (apptCountNum > 0) summary.push(`${apptCountNum} past appointment${apptCountNum === 1 ? "" : "s"}`);
  const spendNum = parseFloat(spend);
  if (spendNum > 0) summary.push(`$${spendNum.toFixed(2)} total spend`);
  if (lastAppt && lastAppt.toLowerCase() !== "never serviced") summary.push(`last serviced ${lastAppt}`);
  if (summary.length > 0) parts.push(`Imported from Groomer.io: ${summary.join(", ")}.`);

  return parts.length > 0 ? parts.join("\n\n") : null;
}

type ParseCSVResult = { rows: ParsedRow[]; validationError: string | null };

function parseCSV(text: string): ParseCSVResult {
  const records = parseCSVRecords(text);
  if (records.length < 2) return { rows: [], validationError: null };

  const rawHeaders = records[0];
  const headers = rawHeaders.map((h) => h.toLowerCase().trim());
  const validationError = validateGroomerIOHeaders(headers);
  if (validationError) return { rows: [], validationError };

  const col = (name: string) => headers.findIndex((h) => h === name);

  const iCreatedAt = col("created_at");
  const iPets = col("pets");
  const iFirstName = col("first_name");
  const iLastName = col("last_name");
  const iPhoneMobile = col("phone_mobile");
  const iPhoneHome = col("phone_home");
  const iPhoneWork = col("phone_work");
  const iEmail = col("email");
  const iClientNotes = col("client notes");
  const iBirthday = col("pets birthday");
  const iGender = col("gender");
  const iPetNotes = col("pet notes");
  const iSpend = col("spend");
  const iApptCount = col("number of appointments");
  const iLastAppt = col("last appt");
  const iAddress = col("full address");

  const rows: ParsedRow[] = [];

  for (let i = 1; i < records.length; i++) {
    const f = records[i];
    const get = (idx: number) => (idx >= 0 ? f[idx]?.trim() ?? "" : "");

    const firstName = get(iFirstName);
    const lastName = get(iLastName);
    if (!firstName && !lastName) continue;

    const petsRaw = get(iPets);
    const petNotesRaw = get(iPetNotes);
    const pets = parsePets(petsRaw, get(iBirthday), get(iGender), petNotesRaw);
    const lastAppt = get(iLastAppt);

    rows.push({
      firstName,
      lastName,
      email: get(iEmail) || null,
      ...pickPhones(get(iPhoneMobile), get(iPhoneHome), get(iPhoneWork)),
      address: parseAddress(get(iAddress)),
      notes: buildCustomerNotes({
        clientNotes: get(iClientNotes),
        petNotes: petNotesRaw,
        singlePet: pets.length === 1,
        apptCount: get(iApptCount),
        spend: get(iSpend),
        lastAppt,
      }),
      pets,
      createDate: get(iCreatedAt) || null,
      lastAppt: lastAppt || null,
    });
  }

  return { rows, validationError: null };
}

function GroomerIOImportFlow({ accessToken, onBack }: { accessToken: string; onBack: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
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

    const BATCH_SIZE = 50;
    const batches: ParsedRow[][] = [];
    for (let i = 0; i < preview.length; i += BATCH_SIZE) {
      batches.push(preview.slice(i, i + BATCH_SIZE));
    }

    setImportTotal(preview.length);
    setImportProgress(0);

    const accumulated: ImportResult = { imported: [], duplicates: [], skipped: [] };
    let processed = 0;

    try {
      for (const batch of batches) {
        const response = await fetch("/api/import/groomerio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ rows: batch }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Import failed.");

        accumulated.imported.push(...data.imported);
        accumulated.duplicates.push(...data.duplicates);
        accumulated.skipped.push(...data.skipped);

        processed += batch.length;
        setImportProgress(processed);
      }

      setResult(accumulated);
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
          Import from Groomer.io
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
          Clients &amp; Pets
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Upload a Groomer.io Client Summary export to import your clients and pets into Wagzly.
          This importer brings in <strong>client profiles and pet information only</strong> — past appointment
          spend/visit counts are added as a note on each client instead, since Groomer.io doesn&apos;t export full
          appointment history. Duplicate clients are matched by phone number and reported, not duplicated.
          Every imported client comes in as Active (Groomer.io&apos;s summary doesn&apos;t export an active/inactive status).
        </p>

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
              How to export your clients from Groomer.io
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
              <ol className="space-y-5">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rose-primary)]/10 text-xs font-bold text-[var(--rose-primary)]">1</span>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">Log in to Groomer.io in your web browser.</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rose-primary)]/10 text-xs font-bold text-[var(--rose-primary)]">2</span>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">Go to your <strong>Clients</strong> list and run the <strong>Client Summary</strong> report.</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rose-primary)]/10 text-xs font-bold text-[var(--rose-primary)]">3</span>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">Export/download it as a <strong>CSV</strong>.</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rose-primary)]/10 text-xs font-bold text-[var(--rose-primary)]">4</span>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">Drag the CSV into the upload area below, or click to browse for it.</p>
                </li>
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
              {fileName ? fileName : "Drop your Groomer.io CSV here"}
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

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

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
            {importing ? (
              <div className="flex min-w-[220px] flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
                  <span>Importing...</span>
                  <span>{importProgress} / {importTotal}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--soft-surface)]">
                  <div
                    className="h-full rounded-full bg-[var(--rose-primary)] transition-all duration-300"
                    style={{ width: importTotal > 0 ? `${Math.round((importProgress / importTotal) * 100)}%` : "0%" }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button type="button" className="secondary-button" onClick={handleReset}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleImport}
                >
                  {`Import ${preview.length} clients`}
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--divider-soft)] bg-[var(--soft-surface)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Address</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Pets</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Last Appt</th>
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
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--soft-surface)] px-2 py-0.5 text-xs font-bold text-[var(--text-primary)]"
                          title={row.pets.map((p) => p.name).join(", ")}
                        >
                          🐾 {row.pets.length}
                        </span>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          row.lastAppt && row.lastAppt.toLowerCase() !== "never serviced"
                            ? "bg-green-100 text-green-700"
                            : "bg-[var(--soft-surface)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {row.lastAppt || "never serviced"}
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
          No clients found in this file. Make sure you exported a Groomer.io Client Summary CSV.
        </div>
      ) : null}

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

export default GroomerIOImportFlow;
