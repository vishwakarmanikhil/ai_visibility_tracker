const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code: string) => {
      const c = code.toLowerCase();
      if (ENTITIES[c] !== undefined) return ENTITIES[c];
      if (c.startsWith("#x")) return String.fromCodePoint(parseInt(c.slice(2), 16));
      if (c.startsWith("#")) return String.fromCodePoint(parseInt(c.slice(1), 10));
      return m;
    })
    .replace(/\r\n?/g, "\n");
}

export interface Segment {
  start: number;
  end: number;
  /** Index of the line/paragraph/bullet the sentence belongs to; context only carries within one block. */
  block: number;
  isTableRow: boolean;
}

/**
 * Split an answer into sentences while keeping character offsets, so mentions found in
 * the full text can be assigned to the sentence they sit in. Each line (bullet, table row,
 * paragraph) is its own block.
 */
export function segment(text: string): Segment[] {
  const out: Segment[] = [];
  let lineStart = 0;
  let block = 0;
  for (const line of text.split("\n")) {
    const lineEnd = lineStart + line.length;
    const trimmed = line.trim();
    if (trimmed) {
      if (trimmed.startsWith("|")) {
        if (!/^\|[\s|:-]+\|?$/.test(trimmed)) out.push({ start: lineStart, end: lineEnd, block, isTableRow: true });
      } else {
        // Sentence end: . ! ? followed by whitespace (so "corvanefleet.com" and "$29.99" stay intact).
        const re = /[.!?](?=\s+\S)/g;
        let s = lineStart;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line))) {
          const e = lineStart + m.index + 1;
          out.push({ start: s, end: e, block, isTableRow: false });
          s = e;
        }
        out.push({ start: s, end: lineEnd, block, isTableRow: false });
      }
      block++;
    }
    lineStart = lineEnd + 1;
  }
  return out.filter((seg) => text.slice(seg.start, seg.end).trim() !== "");
}

/** Clean a sentence for display / claim_text: drop citation markers and markdown emphasis. */
export function cleanSentence(s: string): string {
  return s
    .replace(/\[\d+\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function damerauLevenshtein(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
