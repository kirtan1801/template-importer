import Link from "next/link";
import { notFound } from "next/navigation";
import sanitize from "sanitize-html";
import { db } from "@/lib/db";
import type { ImportReport } from "@/lib/parse";
import { rename, saveComment, copyTemplate } from "@/app/actions";
import { SubmitButton } from "@/app/submit-button";

export const dynamic = "force-dynamic";

const clean = (html: string) =>
  sanitize(html, { allowedTags: [...sanitize.defaults.allowedTags, "u", "img"], allowedAttributes: { a: ["href", "target"], img: ["src", "alt"] } });

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.template.findUnique({ where: { id }, select: { name: true } });
  return { title: t ? `${t.name} · Template Importer` : "Template not found" };
}

export default async function TemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ s?: string }> }) {
  const { id } = await params;
  const { s } = await searchParams;
  // One round trip: every section's name/count, but items+comments only for the selected section.
  // DB is remote, so sequential queries dominate page time.
  const sectionFilter = s ? { id: s } : { position: 0 };
  const t = await db.template.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          _count: { select: { items: true } },
          items: { where: { section: sectionFilter }, orderBy: { position: "asc" }, include: { comments: { orderBy: { position: "asc" } } } },
        },
      },
    },
  });
  if (!t) notFound();
  const section = t.sections.find((x) => (s ? x.id === s : x.position === 0)) ?? t.sections[0] ?? null;
  const sectionId = section?.id;
  const report = t.report as ImportReport | null;
  const original = t.copiedFromId ? await db.template.findUnique({ where: { id: t.copiedFromId }, select: { name: true } }) : null;

  return (
    <>
      <p className="crumb"><Link href="/">← All templates</Link></p>
      <form action={rename} className="inline">
        <input type="hidden" name="kind" value="template" />
        <input type="hidden" name="id" value={t.id} />
        <input type="text" name="name" defaultValue={t.name} style={{ fontSize: "1.3rem", fontWeight: 600 }} />
        <SubmitButton>Save name</SubmitButton>
      </form>
      <form action={copyTemplate} className="inline"><input type="hidden" name="id" value={t.id} /><SubmitButton pendingLabel="Copying…" doneLabel={null}>Copy template</SubmitButton></form>
      <p className="muted">
        {t.copiedFromId ? <>Copy of <a href={`/t/${t.copiedFromId}`}>{original?.name ?? "(deleted)"}</a>. Edits here do not touch the original.</> : <>Imported from <code>{t.sourceFile}</code></>}
      </p>

      {report && (
        <details className={`panel ${report.skipped.length || report.unmappedColumns.length ? "warn" : ""}`}>
          <summary>
            Import report: {report.sections} sections, {report.items} items, {report.comments} comments from {report.rows} rows
            {report.skipped.length > 0 && <> · <strong>{report.skipped.length} rows skipped</strong></>}
            {report.unmappedColumns.length > 0 && <> · {report.unmappedColumns.length} columns kept as extra fields</>}
          </summary>
          <p className="muted">Column mapping: {Object.entries(report.mappedColumns).map(([k, v]) => `${k} ← "${v}"`).join(", ")}</p>
          {report.unmappedColumns.length > 0 && (
            <p className="muted">Not modelled, stored verbatim on each comment as read-only extra fields: {report.unmappedColumns.map((c) => <code key={c}>{c}</code>)}</p>
          )}
          {report.emptyColumns?.length > 0 && (
            <p className="muted">Columns present in the export but empty in every row (nothing to import): {report.emptyColumns.map((c) => <code key={c}>{c}</code>)}</p>
          )}
          {report.skipped.length > 0 && (
            <table>
              <thead><tr><th>Row</th><th>Reason</th><th>Raw content</th></tr></thead>
              <tbody>{report.skipped.map((sk) => <tr key={sk.row}><td>{sk.row}</td><td>{sk.reason}</td><td><code>{sk.raw.filter(Boolean).join(" | ")}</code></td></tr>)}</tbody>
            </table>
          )}
        </details>
      )}

      <div className="editor">
        <nav className="sections">
          <h4>Sections</h4>
          {t.sections.map((x) => (
            <Link key={x.id} href={`/t/${t.id}?s=${x.id}`} className={x.id === sectionId ? "current" : ""}>
              {x.name} <span className="muted">{x._count.items}</span>
            </Link>
          ))}
        </nav>

        {section && (
          <section>
            <h2>
              <form action={rename} className="inline">
                <input type="hidden" name="kind" value="section" />
                <input type="hidden" name="id" value={section.id} />
                <input type="text" name="name" defaultValue={section.name} />
                <SubmitButton>Save</SubmitButton>
              </form>
            </h2>
            {section.items.map((it) => (
              <div key={it.id}>
                <h3>
                  <form action={rename} className="inline">
                    <input type="hidden" name="kind" value="item" />
                    <input type="hidden" name="id" value={it.id} />
                    <input type="text" name="name" defaultValue={it.name} />
                    <SubmitButton>Save</SubmitButton>
                  </form>
                </h3>
                {it.comments.map((c) => (
                  <form key={c.id} action={saveComment} className="comment">
                    <input type="hidden" name="id" value={c.id} />
                    <div className="inline">{c.kind && <code>{c.kind}</code>}<input type="text" name="name" defaultValue={c.name} /><SubmitButton>Save comment</SubmitButton></div>
                    <div className="grid">
                      <textarea name="bodyHtml" defaultValue={c.bodyHtml} />
                      <div className="preview" dangerouslySetInnerHTML={{ __html: clean(c.bodyHtml) }} />
                    </div>
                    {c.extra && (
                      <p className="muted">Extra fields from export: {Object.entries(c.extra as Record<string, string>).map(([k, v]) => <span key={k}><code>{k}</code>: {v} </span>)}</p>
                    )}
                  </form>
                ))}
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
