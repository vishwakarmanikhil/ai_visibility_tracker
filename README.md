# AI Visibility Tracker: Corvane Fleet

A local web app that reads weekly AI answers (ChatGPT, Perplexity, Google AI Overviews) and shows how AI treats Corvane Fleet and its competitors. It covers:

- a single visibility score per company, with an honest "real change vs noise" call
- what moved and who took the ground
- wrong facts the AI is spreading
- every underlying answer, with mentions highlighted

Everything runs locally with rules. There are no paid APIs and no AI model at runtime.

Stack: **Next.js 15 / React 19** for the UI, with **Node.js** server components and API routes for the backend, and TypeScript throughout. The analysis engine in `lib/` is plain TypeScript with no framework, so the CLI, the web app and the tests all use the same code.

## Run it

Requires Node 20+.

```bash
npm install
npm run app          # builds and serves on http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run export` | Writes the scoring export `output/mentions.csv` and `output/wrong_facts.csv` |
| `npm test` | Runs the detection, tone, fact-check and loader tests (Vitest) |
| `npm run accuracy-sample -- 15 2026` | Re-draws the random sample used for the accuracy check |

The same CSVs, plus a board report, can be downloaded in the app (header link and **How it works** page) or from `/api/export/mentions.csv`, `/api/export/wrong_facts.csv` and `/api/export/board_report.csv`.

### Adding a new week

Drop the new file (any name ending in `.jsonl`) into `corvane_data_pack/` and refresh the page. Every `.jsonl` file in the folder is loaded, and the app notices new or changed files without a restart. To point at another folder, use `DATA_DIR=/path/to/folder npm run export`, or change `dataDir` in `config/tracker.json`.

The loader accepts each field under several names (`response_text` / `answer` / `text`, `citations` / `sources` / `references`, `run` / `run_number`, and so on). It also accepts:

- any engine spelling ("ChatGPT", "AI Overview", "Perplexity AI")
- prompt IDs like `p1` or `P01`
- ISO or `DD/MM/YYYY` dates
- citations given as strings or `{url}` objects

Unreadable lines are counted and reported rather than crashing the app.

### Configuration instead of code

`config/tracker.json` holds:

- the client brand
- extra aliases (such as "Corvane")
- look-alikes to exclude ("Corvane" followed by "Logistics")
- the points per tone
- the list of known integration names

Companies come from `brands.json` and facts from `facts.json`. Adding a competitor is a data change, and the export key is the first word of its name. The **View as** menu on the Monday view (or `?as=trakvia`) shows the whole briefing from a competitor's side.

## What's in the app

| Page | For | What it shows |
|---|---|---|
| **Monday view** (`/`) | Marcus | Headline sentence; score cards with week-on-week and two-week change, each marked *real* or *noise*; incomplete-week warning; what changed and why; who gained or lost ground; suggested actions; wrong-fact alerts with links to the answers; score by engine |
| **Answers** (`/explore`) | Priya | Filter by company, tone or status, week, engine, buying stage, question and free text. A per-question table shows where a company appears. Clicking an answer shows the full text with every mention highlighted, each company's position and tone with the sentence that decided it, wrong facts and citations |
| **Head-to-head** (`/head-to-head`) | Both | Winner of every question on every engine; which company appeared when another dropped out |
| **Wrong facts** (`/facts`) | Sales | Every incorrect claim about Corvane and the three tracked competitors |
| **Sources** (`/sources`) | Marketing | Cited websites and the companies named alongside them; "gap" sites that are cited next to competitors but never next to Corvane |
| **How it works** (`/method`) | Anyone | Plain-English method, data health table, downloads |

## How it works

**1. Load and clean** (`lib/load.ts`)

- Maps both export formats onto one record shape.
- Normalises engine names and prompt IDs, and decodes HTML entities such as `&amp;`.
- Removes duplicates: 8 exact copies in week 2.
- Marks failed answers: 3 timeouts with no text. These are kept in `mentions.csv` as "not mentioned", because the answer exists but says nothing, and are excluded from scores.

**2. Mentions and position** (`lib/mentions.ts`)

- Each brand's aliases (name, first word, website, domain root) become case-insensitive patterns that tolerate a space or hyphen inside the name ("Route Lyne", "CorvaneFleet").
- Close misspellings of capitalised words are caught by edit distance ("Corvain", "Trackvia").
- A match followed by "Logistics" is recorded as the look-alike and never counted.
- Only the answer text is searched; citations are ignored.
- Position is the order of first appearance.

**3. Tone** (`lib/tone.ts`)

- Each sentence (or table row) that names a company is classified by ordered phrase rules: advises against → *not_recommended*; criticism then a positive verdict ("even so… the one I'd pick") → *recommended*; criticism → *negative*; endorsement → *recommended*; otherwise *neutral*.
- A sentence with no name but with "it" or "the company" is read as being about the last company named in the same paragraph or bullet.
- The company's tone is its **last** non-neutral judgement, following the brief's "final verdict" rule.

**4. Wrong facts** (`lib/facts.ts`)

- Sentences attributed to one company are checked against `facts.json` for:
  - starting price (a single dollar figure, not a range)
  - HQ (city and state compared separately, so "Columbus, Georgia" is wrong)
  - founding year
  - each feature, for both "has" and "doesn't have" claims
  - named integrations
- Claims that `facts.json` doesn't cover (star ratings, 24/7 support) are not flagged.
- `fact_key` is the dotted path, e.g. `features.eld_compliance`.

**5. Score** (`lib/score.ts`)

- Each answer gives each company points: recommended 100, neutral 50, negative 25, not recommended or absent 0.
- These are averaged per question × engine (the two runs), then weighted by question priority (1–3).
- **Noise:** run 1 and run 2 of the same question are two draws of the same thing, so the average of (r1 − r2)² / 2 estimates the per-run variance for each brand. A comparison's standard error follows from how many runs back each question × engine. A change is **real** only if it is more than 2 standard errors (about 95%).
- **Incomplete weeks:** changes are always like-for-like, using only question × engine slots collected in both periods. The weekly score carries forward a missing engine's last values and flags the week. Week 5, which has no Perplexity, therefore shows neither a false drop nor a false rise.
- Because single weeks are noisy (two runs per slot), the app also compares **the last two weeks with the two before**, and does both comparisons **per engine**. That is where the real movement in this data shows up.

**6. Briefing** (`lib/insights.ts`)

- Turns the comparisons into sentences.
- Biggest single question moves are labelled as possibly noise.
- Shows which competitors rose where Corvane fell, and who appeared in slots Corvane lost.
- Suggested actions come from rules:
  - fix our wrong facts
  - investigate an engine where we really dropped, plus the sources it cites for competitors only
  - win back high-priority questions where we're weak and a competitor usually wins
  - use competitors' wrong facts as sales talking points

## Assumptions

- **Brand keys** are the first word of the brand name (`gridwell` for "Gridwell Systems"), matching the export spec.
- **"Corvane" on its own** means Corvane Fleet. Corvane Logistics is always named in full in this data.
- **Failed answers** (error or empty text) appear in `mentions.csv` with every company `false`. They are excluded from scores and accuracy samples.
- **Duplicates:** when a response ID repeats, the first copy is kept. When two different IDs fill the same week/engine/question/run slot, the first is kept.
- **Dates** with slashes are read day-first unless that's impossible. Dates are only shown, never used in calculations, so a wrong guess can't change a score.
- **Mixed answers:** "Has had complaints, but overall it's still one of the better choices" counts as *recommended* (final verdict). "Reliable choice if you need X" and "well worth shortlisting" also count as *recommended*. A table row's "Our take" column is treated as a judgement ("Top pick" → recommended, "Skip at your size" → not recommended).
- **Integrations in `facts.json` are a complete list**, so "Routelyne integrates with QuickBooks" would be flagged. An integration name the config doesn't know is ignored (unverified).
- **Not mentioned scores 0,** the same as "advised against". The score measures visibility, and a negative score for being trashed would be harder to explain. The tone split is shown alongside.
- **Question priority** (1–3) is used directly as the weight.

## What I prioritised, and why

1. **Correct detection and the scoring export first.** Mentions, positions, tones and wrong facts are what everything else depends on, and they're checked against an answer key. I read the data's sentence patterns before writing rules, then checked every tone-deciding pattern and every wrong-fact sentence across the whole dataset, not just a sample.
2. **An honest score.** The brief's hardest requirement is separating real change from noise and not showing false drops. The noise model uses the two runs the data already provides, and every change is shown with its *real/noise* label. This changed the story: week-on-week, almost nothing is significant, but Corvane's fall on Google AI Overviews (and Routelyne's rise there) is. A naive dashboard would have shown either no story or a misleading one.
3. **Marcus's one screen.** It gives a plain-English headline, what changed, who moved, alerts and actions, with no chart literacy needed.
4. **Stretch items that reuse the same engine cheaply:**
   - Priya's detail view
   - head-to-head and "who took our place"
   - competitor fact-checking
   - sources and gaps
   - board report CSV
   - "view as competitor"
   - configuration instead of code
5. **Not done:** a deployed version (it runs locally with one command; Vercel would work as is), charts beyond sparklines, a database, and authentication. Lower value than accuracy, and easy to add.

## Accuracy

Full details are in [docs/accuracy-check.md](docs/accuracy-check.md).

**Sample A (15 random answers, seed 2026):**

| Measure | Result |
|---|---|
| Mentioned / not mentioned | 90 / 90 company rows correct (30 mentions, 60 non-mentions) |
| Positions | 30 / 30 |
| Tones | 30 / 30 |
| Wrong facts | 4 / 4 found, 0 false alarms |

**Sample B (seed 99):** also 15 of 15 answers fully correct.

**Whole dataset:** all 95 answers containing a known wrong claim were flagged, with no false flags.

**Treat these numbers as an upper bound.** The data is generated from a limited set of phrasings, and I wrote the rules after reading them. The main risks on new data are:

- new wording for a judgement, which falls back to *neutral*
- several companies in one sentence, which all share its tone
- unusual wording of a factual claim
- lower-case misspellings

[docs/accuracy-check.md](docs/accuracy-check.md) also lists the judgement calls an answer key might label differently.

## Tests

`npm test` runs 27 tests:

- name variants, websites, misspellings
- "a fleet of 30" not becoming Fleetora
- Corvane Logistics exclusion
- citations ignored, positions, failed answers
- each tone rule and the final-verdict rule
- each wrong-fact type, true claims not flagged, unverified claims not flagged, claims about Corvane Logistics not pinned on Corvane
- both file formats, engine, prompt and date normalisation, de-duplication

## How I used AI tools

I built this with **Claude Code**. It:

- profiled the data and found the format changes, duplicates, missing week-5 Perplexity, timeouts and name variants
- clustered answer sentences into templates so the rules were based on evidence
- wrote most of the code and tests
- ran consistency checks (every wrong-claim sentence vs the tool's output, every tone pattern reviewed)
- drafted the hand-check labels for the 15-answer accuracy sample, which I then reviewed against each answer ([worksheet](docs/hand-check-worksheet.md))

What it got wrong and had to be fixed:

- **The typo matcher was too eager.** "Corvain" needed edit-distance 2, which let "a fleet of 30" match *Fleetora*. That created false mentions and broke "it" attribution, hiding three wrong facts. It was caught by cross-checking all wrong-claim sentences (92 found vs 95 expected). Fuzzy matching is now limited to capitalised words, and there's a test for it.
- **Two table verdicts were missed** ("Not for small fleets", "Mixed reviews") and defaulted to neutral. Caught by listing every tone-deciding pattern.
- **The HQ check kept the full stop** ("Columbus, Georgia.") in alert text.
- **The first noise model only looked at single weeks overall,** where everything was "noise". Looking at the pivot by engine showed the real movement, which led to adding the two-week and per-engine comparisons.
- A stray shell command hung the session once and had to be killed.

## Running this every day for 20 clients

**Collection.** 20 clients × ~15 questions × 3 engines × 2 runs is about 1,800 answers a day. ChatGPT and Perplexity have APIs. Google AI Overviews needs a SERP provider. At typical API and SERP prices that is roughly $5–$25 a day in total (well under a dollar per client), dominated by AI Overviews. Running 2 samples daily instead of weekly gives far tighter noise bands for the same cost per week of insight. Weekly roll-ups stay the headline, so Marcus doesn't see daily wobble.

**Processing and storage.** The analysis is rules-based and processes all 510 answers in under 0.1 seconds on a laptop, so compute is negligible. I'd store raw answers unchanged as JSONL in object storage (S3 or similar), partitioned by client and date. That's about 1 KB per answer, so roughly 0.7 GB a year for all 20 clients, which costs pennies. Parsed results (mentions, facts, scores) would go in Postgres. Each client is just its own `tracker.json`, `brands.json`, `facts.json` and question list, since nothing is hard-coded. A nightly job would run collect → load → analyse → store, and the app would read from the database.

**When an engine changes its format.**

- The loader maps fields by alias and reports unreadable rows and data-health issues instead of failing.
- I'd add alerts on the health metrics: a spike in failed answers, zero answers for an engine, a new unknown field set, or a sudden collapse in the mention rate for every brand on one engine. A format change usually looks like that, not like a real market move.
- A new format becomes one more alias in `FIELD_ALIASES`, plus a test with a sample of the new format.
- Raw answers are kept, so every day since the change can be re-processed once it's fixed.
- New phrasings are the bigger risk for the rules. A weekly 15-answer hand check per engine, plus a "sentences that named a company but matched no tone rule" report, shows where the rules need extending. A small local model (such as Ollama) could later handle only those leftovers.

## Project layout

```
app/                  Next.js pages (Monday view, explore, head-to-head, facts, sources, method) + CSV API route
lib/                  Analysis engine (load, mentions, tone, facts, score, insights, sources, exports, report)
config/tracker.json   Client, aliases, look-alikes, tone points, known integrations
corvane_data_pack/    Input data; drop new weekly .jsonl files here
scripts/              CLI: export, accuracy sample
tests/                Vitest tests
docs/                 Accuracy check
NOTE_TO_MARCUS.md     Half-page note for the CEO
```
