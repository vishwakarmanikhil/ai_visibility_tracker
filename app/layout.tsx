import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Visibility Tracker",
  description: "How AI assistants talk about Corvane Fleet and its competitors",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <span className="brandmark">AI Visibility Tracker</span>
          <nav>
            <Link href="/">Monday view</Link>
            <Link href="/explore">Answers</Link>
            <Link href="/head-to-head">Head-to-head</Link>
            <Link href="/facts">Wrong facts</Link>
            <Link href="/sources">Sources</Link>
            <Link href="/method">How it works</Link>
          </nav>
          <span className="spacer" />
          <a className="small" href="/api/export/board_report.csv">Board report (CSV)</a>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
