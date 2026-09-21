"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingLabel = "Saving…", doneLabel = "Saved ✓", className }: { children: React.ReactNode; pendingLabel?: string; doneLabel?: string | null; className?: string }) {
  const { pending } = useFormStatus();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (pending) { setDone(false); return; }
    if (done) { const t = setTimeout(() => setDone(false), 1500); return () => clearTimeout(t); }
  }, [pending, done]);
  return (
    <button className={className} disabled={pending} onClick={() => setDone(true)}>
      {pending ? pendingLabel : done && doneLabel ? doneLabel : children}
    </button>
  );
}
