import { unzipSync } from "fflate";
import tracker from "@/config/tracker.json";
import { analysisFromFiles, type Analysis, type DataFile } from "@/lib/dataset";

/**
 * Data pack loaded in the viewer's browser (used when the server has no data folder, e.g. the
 * public deployment). Files never leave the device: they are kept in this browser's
 * localStorage, or only in memory if storage is unavailable or full.
 */

const KEY = "ai-visibility-tracker:data-pack:v1";
let memory: DataFile[] | null = null;
let cached: { files: DataFile[]; analysis: Analysis } | null = null;

export function loadStoredFiles(): DataFile[] | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as DataFile[];
  } catch {
    /* storage blocked: fall through */
  }
  return memory;
}

/** Returns false when the files could only be kept in memory (lost on reload). */
export function storeFiles(files: DataFile[]): boolean {
  memory = files;
  cached = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(files));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredFiles() {
  memory = null;
  cached = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function browserAnalysis(files: DataFile[]): Analysis {
  if (cached && cached.files === files) return cached.analysis;
  const analysis = analysisFromFiles(files, tracker, "uploaded files");
  cached = { files, analysis };
  return analysis;
}

const WANTED = /\.(jsonl?|csv)$/i;
const decoder = new TextDecoder("utf-8");

/** Read what the user picked: a ZIP, loose files, or a folder. Keeps only .json/.jsonl/.csv files. */
export async function readPickedFiles(list: FileList | File[]): Promise<DataFile[]> {
  const out: DataFile[] = [];
  for (const file of Array.from(list)) {
    if (/\.zip$/i.test(file.name)) {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (f) => WANTED.test(f.name) && !f.name.startsWith("__MACOSX/") && !/(^|\/)\._/.test(f.name),
      });
      for (const [name, bytes] of Object.entries(entries)) out.push({ name, content: decoder.decode(bytes) });
    } else if (WANTED.test(file.name)) {
      out.push({ name: file.webkitRelativePath || file.name, content: await file.text() });
    }
  }
  return out;
}
