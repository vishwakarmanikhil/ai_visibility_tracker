"use client";

import { createContext, useContext } from "react";
import { mentionsCsv, wrongFactsCsv } from "@/lib/exports";
import { boardReportCsv } from "@/lib/report";
import { browserAnalysis, loadStoredFiles } from "./browserData";

/** True when the page is showing data loaded in the browser rather than the server's data folder. */
export const BrowserDataContext = createContext(false);

export type ExportName = "mentions.csv" | "wrong_facts.csv" | "board_report.csv";

/**
 * A CSV download. With server data it is a plain link to /api/export; with browser data the
 * CSV is built on the spot from the files loaded in this browser.
 */
export default function DownloadLink({ name, children, className, browser }: { name: ExportName; children: React.ReactNode; className?: string; browser?: boolean }) {
  const inBrowser = useContext(BrowserDataContext) || browser === true;
  if (!inBrowser)
    return (
      <a className={className} href={`/api/export/${name}`}>
        {children}
      </a>
    );
  const download = () => {
    const files = loadStoredFiles();
    if (!files) {
      window.location.href = "/";
      return;
    }
    const a = browserAnalysis(files);
    const csv = name === "mentions.csv" ? mentionsCsv(a.responses) : name === "wrong_facts.csv" ? wrongFactsCsv(a.responses, a.config) : boardReportCsv(a);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <a
      className={className}
      href={`#download-${name}`}
      onClick={(e) => {
        e.preventDefault();
        download();
      }}
    >
      {children}
    </a>
  );
}
