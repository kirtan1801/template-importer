import * as XLSX from "xlsx";

export type ParsedComment = { name: string; bodyHtml: string; kind: string | null; extra: Record<string, string> | null };
export type ParsedItem = { name: string; comments: ParsedComment[] };
export type ParsedSection = { name: string; items: ParsedItem[] };
export type ImportReport = {
  rows: number;
  sections: number;
  items: number;
  comments: number;
  skipped: { row: number; reason: string; raw: string[] }[];
  mappedColumns: Record<string, string>;
  unmappedColumns: string[]; // present in file, had values, kept in Comment.extra
  emptyColumns: string[]; // present in file, no values in any row
};
export type Parsed = { name: string; sections: ParsedSection[]; report: ImportReport };

// Header aliases, matched case-insensitively after trimming. First match wins.
// ponytail: alias list grows as new Spectora export variants show up.
const ALIASES: Record<"section" | "item" | "comment" | "body" | "kind", string[]> = {
  section: ["section", "section name"],
  item: ["item", "item name", "subsection"],
  comment: ["comment", "comment name", "name", "title"],
  body: ["comment text", "text", "html", "body", "description", "comment html"],
  kind: ["comment type (info, limit, defect)", "comment type", "type"],
};

const norm = (s: unknown) => String(s ?? "").trim();
// Spectora entity-encodes names ("Siding, Flashing &amp; Trim"). Bodies are HTML and stay as-is.
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(parseInt(e[1] === "x" ? e.slice(2) : e.slice(1), e[1] === "x" ? 16 : 10)) : (ENT[e.toLowerCase()] ?? m),
  );

function findHeader(rows: unknown[][]): { idx: number; cols: Record<string, number> } | null {
  // Header row = first row within first 10 that has both a section and body-ish column.
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cols: Record<string, number> = {};
    rows[i].forEach((c, j) => {
      const h = norm(c).toLowerCase();
      if (h) cols[h] = j;
    });
    const has = (k: keyof typeof ALIASES) => ALIASES[k].some((a) => a in cols);
    if (has("section") && has("body")) return { idx: i, cols };
  }
  return null;
}

export function parseSpectora(buf: Buffer | ArrayBuffer, fileName = "import.xlsx"): Parsed {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: buf instanceof ArrayBuffer ? "array" : "buffer" });
  } catch {
    throw new Error("Could not read file as a spreadsheet (.xlsx/.csv expected).");
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Spreadsheet has no sheets.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
  if (rows.length === 0) throw new Error("Spreadsheet is empty.");

  const header = findHeader(rows);
  if (!header) {
    const seen = rows[0].map(norm).filter(Boolean).join(", ") || "(none)";
    throw new Error(
      `Not a Spectora HTML-text export: need a Section column and a Comment Text column. Found headers: ${seen}`,
    );
  }

  const pick = (k: keyof typeof ALIASES) => {
    const a = ALIASES[k].find((x) => x in header.cols);
    return a === undefined ? -1 : header.cols[a];
  };
  const col = { section: pick("section"), item: pick("item"), comment: pick("comment"), body: pick("body"), kind: pick("kind") };
  const headerNames = rows[header.idx].map(norm);
  const mapped: Record<string, string> = {};
  const usedIdx = new Set<number>();
  (Object.keys(col) as (keyof typeof col)[]).forEach((k) => {
    if (col[k] >= 0) {
      mapped[k] = headerNames[col[k]];
      usedIdx.add(col[k]);
    }
  });
  const dataRows = rows.slice(header.idx + 1);
  const hasValue = (j: number) => dataRows.some((r) => norm(r[j]));
  const unmapped = headerNames.filter((h, j) => h && !usedIdx.has(j) && hasValue(j));
  const emptyCols = headerNames.filter((h, j) => h && !usedIdx.has(j) && !hasValue(j));

  const sections: ParsedSection[] = [];
  const report: ImportReport = {
    rows: 0,
    sections: 0,
    items: 0,
    comments: 0,
    skipped: [],
    mappedColumns: mapped,
    unmappedColumns: unmapped,
    emptyColumns: emptyCols,
  };
  let curSection: ParsedSection | null = null;
  let curItem: ParsedItem | null = null;

  for (let r = header.idx + 1; r < rows.length; r++) {
    const row = rows[r].map(norm);
    if (row.every((c) => !c)) continue;
    report.rows++;
    const get = (i: number) => (i >= 0 ? row[i] ?? "" : "");
    const sName = decode(get(col.section));
    const iName = decode(get(col.item));
    const cName = decode(get(col.comment));
    const body = get(col.body);
    const kind = get(col.kind) || null;

    // Blank section/item cells continue the previous one (spreadsheet-style export).
    if (sName && (!curSection || curSection.name !== sName)) {
      curSection = { name: sName, items: [] };
      sections.push(curSection);
      curItem = null;
    }
    if (!curSection) {
      report.skipped.push({ row: r + 1, reason: "Row before any section", raw: row });
      continue;
    }
    if (iName && (!curItem || curItem.name !== iName)) {
      curItem = { name: iName, comments: [] };
      curSection.items.push(curItem);
    }
    if (!cName && !body) {
      // Section/item-only row: structure captured above, nothing else to store.
      if (!sName && !iName) report.skipped.push({ row: r + 1, reason: "No content in row", raw: row });
      continue;
    }
    if (!curItem) {
      // Comment directly under a section. Keep it under an unnamed item so nothing is lost.
      curItem = { name: "(no item)", comments: [] };
      curSection.items.push(curItem);
    }
    const extra: Record<string, string> = {};
    headerNames.forEach((h, j) => {
      if (h && !usedIdx.has(j) && row[j]) extra[h] = row[j];
    });
    curItem.comments.push({ name: cName || body.replace(/<[^>]+>/g, "").slice(0, 80) || "(untitled)", bodyHtml: body, kind, extra: Object.keys(extra).length ? extra : null });
  }

  report.sections = sections.length;
  report.items = sections.reduce((n, s) => n + s.items.length, 0);
  report.comments = sections.reduce((n, s) => n + s.items.reduce((m, i) => m + i.comments.length, 0), 0);
  if (report.comments === 0) throw new Error("No comments found under any section. Nothing to import.");

  return { name: fileName.replace(/\.[^.]+$/, ""), sections, report };
}
