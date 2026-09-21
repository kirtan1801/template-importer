import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Template Importer", description: "Import Spectora templates, edit and copy them." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/">Template Importer</Link>
          <span className="muted">Spectora → your templates</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
