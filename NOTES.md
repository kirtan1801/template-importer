# NOTES

## What this is

Minimum version of the brief, built in roughly two hours. Baseline rules 1–5 covered; everything else cut on purpose.

## Data model

`Template → Section → Item → Comment`, each child with a `position` integer preserving export order. `Comment.bodyHtml` holds the HTML from the export as-is. `Comment.extra` (JSON) holds every spreadsheet column the importer does not model, verbatim, so nothing is dropped silently. `Template.report` stores the import report (counts, skipped rows, column mapping, unmapped columns). `Template.copiedFromId` records provenance of copies.

## Import mapping

`src/lib/parse.ts`. Deterministic, no LLM: the export is tabular and the mapping is a handful of column names, so a model would add failure modes (invented sections, dropped rows) without adding value.

- Header row detected within the first 10 rows: needs a *Section* column and a *Comment Text*-like column, matched case-insensitively against a short alias list.
- Blank Section/Item cells continue the previous one (spreadsheet-style export).
- A row with a comment but no item yet goes under an item named `(no item)` rather than being lost.
- Rows before any section, or rows with no content, are listed in the report as skipped with their raw content.
- Unmapped columns are listed in the report and stored per comment in `extra`, shown read-only in the editor.

### Supported input
Spectora "Export to spreadsheet → Export HTML Text" (`.xls`, first sheet; `.xlsx`/`.csv` also read). Any sheet with *Section Name* + *Comment Text* columns works; *Item Name*, *Comment Name*, *Comment Type* are picked up when present.

The committed export (`fixtures/residential.xls`, InterNACHI Residential from a Spectora trial) has 42 columns and 392 rows: 13 sections, 69 items, 392 comments. Mapped: Section Name, Item Name, Comment Name, Comment Text, Comment Type. Names are HTML-entity encoded in the export (`Siding, Flashing &amp; Trim`) and are decoded on import; comment bodies stay as HTML. 198 bodies contain HTML (`p`, `a`, `strong`, `div`), 111 are plain text, 83 are empty (info items whose content is a multiple-choice list).

### Missing from the export (not the importer's fault)
Spectora writes 26 columns that are empty in every row of this template — Default Photo 1–10 + captions, Default Location, Locked, Simple Format, Disable Photos, etc. The report lists them under "empty columns" so a reviewer can tell "not in the file" from "not imported". Photos themselves are never in this export format (only a photo URL column, which was empty).

### Not supported by the importer (deliberate)
- 11 columns with values are preserved per comment in `extra` but not modelled or editable: Category, Multiple Choice Options, Unit Type Options, Recommendation, Order (w/i item), Answer Type, Default Value, Default Estimate Min/Max, Uses, Last Modified. The biggest real loss for an inspector is *Multiple Choice Options* (72 rows) and *Answer Type* — those drive the form UI in Spectora and would need their own fields to be editable. Shown read-only in the editor so nothing is hidden.
- Order comes from row order, not the *Order (w/i item)* column. Verified they agree on this export; the column is kept in `extra`.
- HTML is stored untouched; the preview is sanitized (links, bold, lists kept; scripts/styles stripped). Editing is raw HTML in a textarea — no WYSIWYG.
- Reordering, adding, or deleting sections/items/comments.

## Editor performance

First cut rendered the whole template on one page: 392 comments × (textarea + sanitized preview + RSC payload) ≈ 1.6 MB, ~3 s. Now one section per page (`/t/[id]?s=<sectionId>`) with a section nav, fetched in a single Prisma query (all section names, items+comments only for the selected one): 51–121 KB per page. Pure server-side change, no client state. Remaining time is DB round trip; Vercel functions pinned to the Neon region. Next step if a single section outgrows that: collapse items with `<details>` or click-to-edit comments.

## Failure cases handled
- Non-spreadsheet file → "Could not read file as a spreadsheet".
- Spreadsheet without Section/Comment Text headers → "Not a Spectora HTML-text export … Found headers: …".
- Empty sheet, or no comments under any section → clear message, nothing written to DB.
Import is one nested `create`, so a failure mid-way leaves no partial template.

## How I checked
- `npm run check`: asserts every comment name and every non-empty comment body cell in the sheet appears verbatim in the parsed tree, first/last section order matches, and the two failure cases above throw the expected errors. Output on the committed export: 392 rows → 392 comments, 0 skipped.
- Manually on the live app: import → rename section → reload → persists; copy → edit copy → open original → unchanged; upload a `.txt` → error shown.

## Cut, and why
- Login: reviewers need zero-friction access; nothing here is private.
- Drag reorder / add / delete nodes: the brief's baseline is edit-and-save; reorder is the next thing an inspector would ask for.
- WYSIWYG editor: raw HTML + live preview was 10 minutes; a rich editor is an afternoon.
- Binsr comparison: time.
- Client-side state: every edit is a plain `<form>` posting to a server action; page re-renders. Slower UX, zero bugs to debug.
- Ids: UUIDv7 as text (see README for the native-uuid detour). Readable integer URLs would have been nicer for a demo; app-generated keys made the single nested insert simpler.

## Time spent
~2h including product signups, build, deploy, and video.

## Credits
`create-next-app` scaffold, Prisma, SheetJS (`xlsx`), `sanitize-html`. Everything in `src/` and `scripts/` written for this exercise with Claude Code; the parser logic and schema are mine to defend.
