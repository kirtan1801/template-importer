import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Template not found</h1>
      <p className="muted">It may have been deleted. <Link href="/">Back to all templates</Link>.</p>
    </>
  );
}
