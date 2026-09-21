// Runnable preservation check: parse the committed fixture and assert structure survived.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseSpectora } from "../src/lib/parse";

const dir = join(__dirname, "..", "fixtures");
const file = process.argv[2] ?? readdirSync(dir).find((f) => /\.(xlsx|xls|csv)$/i.test(f))!;
const buf = readFileSync(join(dir, file));
const { sections, report } = parseSpectora(buf, file);

assert.ok(report.sections > 0, "at least one section");
assert.ok(report.comments > 0, "at least one comment");

// Every non-empty body cell in the sheet must appear verbatim in the parsed tree.
const ws = XLSX.read(buf).Sheets[XLSX.read(buf).SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "" });
const bodyCol = rows.findIndex((r) => r.some((c) => /^comment text$/i.test(String(c).trim())));
const bodyIdx = rows[bodyCol].findIndex((c) => /^comment text$/i.test(String(c).trim()));
const bodies = new Set(sections.flatMap((s) => s.items.flatMap((i) => i.comments.map((c) => c.bodyHtml))));
let missing = 0;
rows.slice(bodyCol + 1).forEach((r) => { const b = String(r[bodyIdx] ?? "").trim(); if (b && !bodies.has(b)) missing++; });
assert.equal(missing, 0, "all comment bodies preserved verbatim");

// Order preserved: first and last section in sheet match parsed order.
const secIdx = rows[bodyCol].findIndex((c) => /^section/i.test(String(c)));
const sheetSections = rows.slice(bodyCol + 1).map((r) => String(r[secIdx] ?? "").trim().replace(/&amp;/g, "&")).filter(Boolean);
// Every comment name in the sheet survives (entity-decoded), and row count == comment count when no rows skipped.
const nameIdx = rows[bodyCol].findIndex((c) => /^comment name$/i.test(String(c).trim()));
const names = new Set(sections.flatMap((s) => s.items.flatMap((i) => i.comments.map((c) => c.name))));
const missingNames = rows.slice(bodyCol + 1).filter((r) => String(r[nameIdx] ?? "").trim() && !names.has(String(r[nameIdx]).trim().replace(/&amp;/g, "&"))).length;
assert.equal(missingNames, 0, "all comment names preserved");
assert.equal(sections[0].name, sheetSections[0], "first section matches");
assert.equal(sections.at(-1)!.name, sheetSections.at(-1), "last section matches");

// Failure cases surface clear errors, not crashes.
assert.throws(() => parseSpectora(Buffer.from("hello, not a spreadsheet"), "x.txt"), /Not a Spectora|Could not read|empty/i);
const empty = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(empty, XLSX.utils.aoa_to_sheet([["Foo", "Bar"], ["1", "2"]]));
assert.throws(() => parseSpectora(XLSX.write(empty, { type: "buffer", bookType: "xlsx" }), "bad.xlsx"), /Not a Spectora/);

console.log("OK", file, report);
