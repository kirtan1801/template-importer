export default function Loading() {
  return (
    <>
      <p className="crumb muted">← All templates</p>
      <div className="skeleton" style={{ height: 36, width: "40%" }} />
      <div className="editor" style={{ marginTop: 24 }}>
        <nav className="sections">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 30 }} />)}
        </nav>
        <p className="muted">Loading section…</p>
      </div>
    </>
  );
}
