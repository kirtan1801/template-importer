"use client";

import { useActionState } from "react";
import { importTemplate } from "./actions";

export function ImportForm() {
  const [state, action, pending] = useActionState(importTemplate, {});
  return (
    <form action={action} className="row">
      <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
      <button className="primary" disabled={pending}>{pending ? "Importing…" : "Import"}</button>
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}
