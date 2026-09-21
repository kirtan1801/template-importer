import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseSpectora } from "../src/lib/parse";
import { saveParsed } from "../src/lib/import";
import { db } from "../src/lib/db";

const dir = join(__dirname, "..", "fixtures");
const file = process.argv[2] ?? readdirSync(dir).find((f) => /\.(xlsx|xls|csv)$/i.test(f));
if (!file) throw new Error("No fixture found in fixtures/");
const parsed = parseSpectora(readFileSync(join(dir, file)), file);
saveParsed(parsed, file)
  .then((t) => console.log(`Seeded template ${t.id} from ${file}:`, parsed.report))
  .finally(() => db.$disconnect());
