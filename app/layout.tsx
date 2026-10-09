import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import DownloadLink from "./DownloadLink";
import { serverHasData } from "@/lib";

export const metadata: Metadata = {
  title: "AI Visibility Tracker",
  description: "How AI assistants talk about Corvane Fleet and its competitors",
};

export const dynamic = "force-dynamic";

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
          <DownloadLink className="small" name="board_report.csv" browser={!serverHasData()}>
            Board report (CSV)
          </DownloadLink>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
