"use client";

export function DeleteButton({ name }: { name: string }) {
  return (
    <button onClick={(e) => { if (!confirm(`Delete "${name}"? This cannot be undone.`)) e.preventDefault(); }}>Delete</button>
  );
}
