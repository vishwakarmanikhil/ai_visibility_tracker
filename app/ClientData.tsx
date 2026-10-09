"use client";

import { useEffect, useMemo, useState } from "react";
import { missingFiles, type DataFile } from "@/lib/dataset";
import { browserAnalysis, clearStoredFiles, loadStoredFiles, readPickedFiles, storeFiles } from "./browserData";
import { BrowserDataContext } from "./DownloadLink";
import MondayView from "./views/MondayView";
import ExploreView from "./views/ExploreView";
import FactsView from "./views/FactsView";
import HeadToHeadView from "./views/HeadToHeadView";
import MethodView from "./views/MethodView";
import SourcesView from "./views/SourcesView";

const VIEWS = {
  monday: MondayView,
  explore: ExploreView,
  facts: FactsView,
  "head-to-head": HeadToHeadView,
  method: MethodView,
  sources: SourcesView,
};

export type ViewName = keyof typeof VIEWS;

/**
 * Used when the server has no data folder (e.g. the public deployment): asks the viewer for the
 * data pack, analyses it in the browser with the same engine, and renders the same page.
 */
export default function ClientData({ view, sp }: { view: ViewName; sp: Record<string, string | undefined> }) {
  const [files, setFiles] = useState<DataFile[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [memoryOnly, setMemoryOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setFiles(loadStoredFiles()), []);

  const result = useMemo(() => {
    if (!files) return null;
    try {
      return { analysis: browserAnalysis(files), error: null };
    } catch (e) {
      return { analysis: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [files]);

  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    try {
      const picked = await readPickedFiles(list);
      const missing = missingFiles(picked);
      if (missing.length) {
        setError(`That doesn't look like the full data pack: missing ${missing.join(", ")}. Choose the data pack ZIP, or select all of its files together.`);
        return;
      }
      browserAnalysis(picked); // throws with a readable message if a file can't be parsed
      setMemoryOnly(!storeFiles(picked));
      setFiles(picked);
    } catch (e) {
      setError(`Couldn't read those files: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    clearStoredFiles();
    setFiles(null);
  };

  if (files === undefined) return <p className="muted">Loading…</p>;

  if (!files || !result?.analysis)
    return (
      <Upload
        onPick={pick}
        busy={busy}
        error={error ?? result?.error ?? null}
      />
    );

  const View = VIEWS[view];
  const answers = result.analysis.responses.length;
  return (
    <BrowserDataContext.Provider value={true}>
      <div className="notice small" style={{ display: "flex", flexWrap: "wrap", gap: ".5rem 1rem", alignItems: "center" }}>
        <span>
          Showing the data pack loaded in this browser ({answers} answers from {files.filter((f) => /\.jsonl?$/i.test(f.name) && !/brands|facts/i.test(f.name)).length} response file
          {files.length === 1 ? "" : "s"}). It stays on this device{memoryOnly ? " and will be forgotten when you reload" : ""}.
        </span>
        <label className="button" style={{ cursor: "pointer" }}>
          Replace data
          <input type="file" accept=".zip,.json,.jsonl,.csv" multiple hidden onChange={(e) => pick(e.target.files)} />
        </label>
        <button type="button" onClick={remove}>
          Remove data
        </button>
      </div>
      {error && <p className="notice">{error}</p>}
      <View analysis={result.analysis} sp={sp} />
    </BrowserDataContext.Provider>
  );
}

function Upload({ onPick, busy, error }: { onPick: (l: FileList | null) => void; busy: boolean; error: string | null }) {
  const [over, setOver] = useState(false);
  return (
    <section className="panel" style={{ maxWidth: 720, margin: "2rem auto" }}>
      <h1>Load the data pack</h1>
      <p>
        This copy of the tracker doesn&apos;t include any data. Choose the <strong>data pack ZIP</strong> (or its files: <code>brands.json</code>,{" "}
        <code>facts.json</code>, <code>prompts.csv</code> and the <code>.jsonl</code> response files) and every page will work.
      </p>
      <p className="muted small">
        The files are read and analysed entirely in your browser. Nothing is uploaded to a server. They are remembered on this device until you click
        &quot;Remove data&quot;. To add a new week, include its <code>.jsonl</code> file alongside the others.
      </p>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onPick(e.dataTransfer.files);
        }}
        style={{
          display: "block",
          border: `2px dashed ${over ? "var(--accent)" : "var(--line)"}`,
          borderRadius: "var(--radius)",
          padding: "2rem 1rem",
          textAlign: "center",
          cursor: "pointer",
          background: over ? "var(--chip)" : "transparent",
        }}
      >
        <strong>{busy ? "Reading files…" : "Drop the ZIP or files here, or click to choose"}</strong>
        <input type="file" accept=".zip,.json,.jsonl,.csv" multiple hidden disabled={busy} onChange={(e) => onPick(e.target.files)} />
      </label>
      {error && (
        <p className="notice" style={{ marginTop: "1rem" }}>
          {error}
        </p>
      )}
    </section>
  );
}
