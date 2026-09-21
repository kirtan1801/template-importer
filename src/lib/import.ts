import { db } from "./db";
import type { Parsed } from "./parse";

export async function saveParsed(p: Parsed, sourceFile: string) {
  return db.template.create({
    data: {
      name: p.name,
      sourceFile,
      report: p.report,
      sections: {
        create: p.sections.map((s, si) => ({
          name: s.name,
          position: si,
          items: {
            create: s.items.map((it, ii) => ({
              name: it.name,
              position: ii,
              comments: {
                create: it.comments.map((c, ci) => ({
                  name: c.name,
                  bodyHtml: c.bodyHtml,
                  kind: c.kind,
                  extra: c.extra ?? undefined,
                  position: ci,
                })),
              },
            })),
          },
        })),
      },
    },
    select: { id: true },
  });
}
