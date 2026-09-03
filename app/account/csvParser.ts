// Minimal hand-rolled CSV tokenizer -- handles quoted fields (with escaped
// "" inside them) and embedded newlines inside a quoted field, which is
// all these client-export CSVs need. Shared by every importer under
// app/account so parsing quirks only need fixing in one place.
export function parseCSVRecords(text: string): string[][] {
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
