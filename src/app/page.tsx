import Link from "next/link";
import { db } from "@/lib/db";
import { copyTemplate, deleteTemplate } from "./actions";
import { ImportForm } from "./import-form";
import { SubmitButton } from "./submit-button";
import { DeleteButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const templates = await db.template.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sections: true } }, sections: { select: { _count: { select: { items: true } }, items: { select: { _count: { select: { comments: true } } } } } } },
  });
  const byId = new Map(templates.map((t) => [t.id, t.name]));

  return (
    <>
      <h1>Templates</h1>
      <div className="panel">
        <strong>Import a Spectora export</strong>
        <p className="muted">Spectora → Template → Export to spreadsheet → <em>Export HTML Text</em>. Upload the resulting .xlsx.</p>
        <ImportForm />
      </div>

      {templates.length === 0 ? (
        <p className="muted">No templates yet. Upload a Spectora export above to get started.</p>
      ) : (
      <table>
        <thead><tr><th>Name</th><th>Sections</th><th>Items</th><th>Comments</th><th>Source</th><th>Created</th><th></th></tr></thead>
        <tbody>
          {templates.map((t) => {
            const items = t.sections.reduce((n, s) => n + s._count.items, 0);
            const comments = t.sections.reduce((n, s) => n + s.items.reduce((m, i) => m + i._count.comments, 0), 0);
            return (
              <tr key={t.id}>
                <td><Link href={`/t/${t.id}`}>{t.name}</Link></td>
                <td>{t._count.sections}</td>
                <td>{items}</td>
                <td>{comments}</td>
                <td className="muted">{t.copiedFromId ? `copy of ${byId.get(t.copiedFromId) ?? "(deleted)"}` : t.sourceFile}</td>
                <td className="muted">{t.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td>
                  <div className="row">
                    <Link href={`/t/${t.id}`} className="btn primary">Open</Link>
                    <form action={copyTemplate}><input type="hidden" name="id" value={t.id} /><SubmitButton pendingLabel="Copying…" doneLabel={null}>Copy</SubmitButton></form>
                    <form action={deleteTemplate}><input type="hidden" name="id" value={t.id} /><DeleteButton name={t.name} /></form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      )}
    </>
  );
}
