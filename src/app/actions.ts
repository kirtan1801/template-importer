"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseSpectora } from "@/lib/parse";
import { saveParsed } from "@/lib/import";

export async function importTemplate(_: unknown, formData: FormData): Promise<{ error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  let id: string;
  try {
    const parsed = parseSpectora(Buffer.from(await file.arrayBuffer()), file.name);
    id = (await saveParsed(parsed, file.name)).id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  redirect(`/t/${id}`);
}

export async function rename(formData: FormData) {
  const kind = String(formData.get("kind"));
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  if (kind === "template") await db.template.update({ where: { id }, data: { name } });
  else if (kind === "section") await db.section.update({ where: { id }, data: { name } });
  else if (kind === "item") await db.item.update({ where: { id }, data: { name } });
  revalidatePath("/", "layout");
}

export async function saveComment(formData: FormData) {
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const bodyHtml = String(formData.get("bodyHtml") ?? "");
  await db.comment.update({ where: { id }, data: { name: name || "(untitled)", bodyHtml } });
  revalidatePath("/", "layout");
}

export async function copyTemplate(formData: FormData) {
  const id = String(formData.get("id"));
  const src = await db.template.findUniqueOrThrow({
    where: { id },
    include: { sections: { orderBy: { position: "asc" }, include: { items: { orderBy: { position: "asc" }, include: { comments: { orderBy: { position: "asc" } } } } } } },
  });
  // Nested create = brand-new rows at every level; nothing shares an id with the original.
  const copy = await db.template.create({
    data: {
      name: `${src.name} (copy)`,
      sourceFile: src.sourceFile,
      copiedFromId: src.id,
      report: src.report ?? undefined,
      sections: {
        create: src.sections.map((s) => ({
          name: s.name,
          position: s.position,
          items: {
            create: s.items.map((it) => ({
              name: it.name,
              position: it.position,
              comments: { create: it.comments.map((c) => ({ name: c.name, bodyHtml: c.bodyHtml, kind: c.kind, extra: c.extra ?? undefined, position: c.position })) },
            })),
          },
        })),
      },
    },
    select: { id: true },
  });
  revalidatePath("/");
  redirect(`/t/${copy.id}`);
}

export async function deleteTemplate(formData: FormData) {
  await db.template.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/");
  redirect("/");
}
