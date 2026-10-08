import { describe, expect, it } from "vitest";
import { dedupe, normalizeDate, normalizeEngine, parseResponses } from "../lib/load";
import { normalizePromptId } from "../lib/config";

describe("loading messy exports", () => {
  it("maps both known file formats onto one shape", () => {
    const a = JSON.stringify({ response_id: "a", week: 1, engine: "chatgpt", prompt_id: "P01", run: 1, collected_at: "2026-08-17T12:24:00Z", response_text: "Hi", citations: null });
    const b = JSON.stringify({ response_id: "b", week: 4, engine: "AI Overview", prompt_id: "p01", run_number: 2, collected: "07/09/2026 21:26", answer: "Fish &amp; chips", sources: ["https://x.com"] });
    const { records, badLines } = parseResponses(`${a}\n\n${b}\nnot json`, "f.jsonl");
    expect(badLines).toBe(1);
    expect(records[0]).toMatchObject({ id: "a", engine: "chatgpt", promptId: "P01", run: 1, citations: [], text: "Hi" });
    expect(records[1]).toMatchObject({ id: "b", engine: "google_ai_overview", promptId: "P01", run: 2, text: "Fish & chips", citations: ["https://x.com"], collectedAt: "2026-09-07T21:26:00Z" });
  });

  it("normalises engine names, prompt ids and dates", () => {
    expect(["ChatGPT", "chat_gpt", "OpenAI GPT-4o"].map(normalizeEngine)).toEqual(["chatgpt", "chatgpt", "chatgpt"]);
    expect(["AI Overview", "google_ai_overview", "Google AI Overviews"].map(normalizeEngine)).toEqual(Array(3).fill("google_ai_overview"));
    expect(["p1", "P01", " p01 ", 7].map(normalizePromptId)).toEqual(["P01", "P01", "P01", "P07"]);
    expect(normalizeDate("12/25/2026 10:00")).toBe("2026-12-25T10:00:00Z");
    expect(normalizeDate(null)).toBeNull();
  });

  it("marks errored or empty answers as failed and removes duplicates", () => {
    const lines = [
      { response_id: "x", week: 2, engine: "chatgpt", prompt_id: "P03", run: 2, response_text: "A" },
      { response_id: "x", week: 2, engine: "chatgpt", prompt_id: "P03", run: 2, response_text: "A" },
      { response_id: "y", week: 2, engine: "chatgpt", prompt_id: "P03", run: 2, response_text: "A again" },
      { response_id: "z", week: 2, engine: "perplexity", prompt_id: "P03", run: 1, response_text: "", error: "timeout" },
    ].map((l) => JSON.stringify(l));
    const { records } = parseResponses(lines.join("\n"), "f.jsonl");
    const { responses, issues } = dedupe(records);
    expect(responses.map((r) => r.id)).toEqual(["x", "z"]);
    expect(responses[1].failed).toBe(true);
    expect(issues.map((i) => i.kind)).toEqual(["duplicate_rows", "duplicate_runs", "failed_answers"]);
  });
});
