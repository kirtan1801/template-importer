# Spectora → Template Importer

Import a Spectora "Export HTML Text" spreadsheet, keep it structured (template → sections → items → comments), edit names and comment HTML, duplicate templates, all persisted in Postgres.

Stack: Next.js 16 (App Router, server actions), Prisma 6, Postgres (Neon), SheetJS for xlsx, sanitize-html for preview. Deployed on Vercel.

## Setup

```bash
nvm use            # node 24 (see .nvmrc; >=20.19 required)
npm install        # also runs `prisma generate`
cp .env.example .env   # set DATABASE_URL (Neon pooled string + &pgbouncer=true)
npx prisma migrate dev # creates tables (use `npm run db:migrate` in prod)
npm run db:seed        # imports fixtures/*.xlsx so the app opens populated
npm run dev
```

## Scripts

- `npm run check` — parse the committed fixture, assert every comment body survived verbatim, section order preserved, and that bad input produces clear errors. Pass a filename to check another export: `npm run check -- other.xlsx`.
- `npm run db:seed [file]` — import a fixture into the DB.

## Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon, with `sslmode=require`). Only variable needed. |

## Input file

`fixtures/` holds the Spectora export used for development: InterNACHI Residential template, exported from a Spectora trial account via *Templates → Export to spreadsheet → Export HTML Text*. No customer data.

## Layout

```
prisma/schema.prisma   data model
prisma/seed.ts         import fixture
src/lib/parse.ts       xlsx → tree + import report (pure, no DB)
src/lib/import.ts      tree → DB
src/app/actions.ts     server actions: import, rename, saveComment, copy, delete
src/app/page.tsx       template list + upload
src/app/t/[id]/page.tsx editor + import report
scripts/check.ts       preservation check
```

## Ids

Primary keys are UUIDv7 strings, generated app-side by Prisma (`@default(uuid(7))`) and stored as `text`.

- **Why not auto-increment integers:** ids exist before the insert, so a whole template with nested sections → items → comments goes in as one `create`; URLs are not enumerable.
- **Why v7 rather than v4 or cuid:** v7 starts with a millisecond timestamp, so rows sort by creation time and new keys append to the end of the index instead of landing on random pages.
- **Why `text` and not native `uuid`:** tried `@db.Uuid` first (both `uuid(7)` and Postgres 18's `uuidv7()` default). Prisma 6.19 sends nested-create parameters as `text`, so any insert deeper than one level fails with `column "id" is of type uuid but expression is of type text` / `operator does not exist: uuid = text`. Migration history shows the detour. Text column costs 36 bytes per key instead of 16; irrelevant at this size, and swappable once Prisma fixes the cast.

## Database connection

Neon's pooled endpoint is PgBouncer in transaction mode, so the connection string needs `&pgbouncer=true` (disables Prisma's prepared-statement cache; without it a schema change surfaces as `cached plan must not change result type`). `vercel.json` pins functions to `sin1`, next to the Neon region, because every page is one DB round trip and the editor is dominated by that latency.
