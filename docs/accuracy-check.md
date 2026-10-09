# Accuracy check

Two random samples of 15 answers were drawn with a fixed seed, so anyone can draw them again:

```
npm run accuracy-sample -- 15 2026     # sample A (the one reported in the README)
npm run accuracy-sample -- 15 99       # sample B (a second check)
```

Each answer was read in full and every company was labelled (mentioned or not, position, tone, wrong facts). The labels were then compared with the tool's output. Claude Code drafted the labels, and I reviewed every answer and agreed with all 15. The filled-in worksheet is [hand-check-worksheet.md](hand-check-worksheet.md); `npm run worksheet` regenerates a blank one. Failed or empty answers are excluded from the draw because there is nothing in them to check.

## Sample A (seed 2026)

| # | Answer | Companies named (tool) | Position | Tone | Wrong facts | Agree? |
|---|---|---|---|---|---|---|
| 1 | r_ba52c81cc994 | Corvane, Routelyne ("Route Lyne"), Gridwell | ✓ | neutral / neutral / negative ✓ | Routelyne ELD, Gridwell founded 2015 ✓ | ✓ |
| 2 | r_b596e3f92dda | Corvane, Novahaul, Gridwell, Trakvia (Corvane Logistics ignored) | ✓ | rec / rec\* / neutral / neutral | Corvane dashcams ✓ | ✓ |
| 3 | r_bb2a4233e084 | Corvane, Trakvia | ✓ | rec\* / neutral | none ✓ | ✓ |
| 4 | r_cc2a53de5c64 | Routelyne, Gridwell, Trakvia | ✓ | rec / not_rec / neutral | Routelyne ELD ✓ | ✓ |
| 5 | r_58e8d045434b | Corvane, Gridwell | ✓ | rec / rec | none ✓ | ✓ |
| 6 | r_f41feb411a33 | Novahaul | ✓ | rec | none ✓ | ✓ |
| 7 | r_e8b0a891b6b3 | Trakvia (as "trakvia.com") | ✓ | rec | none ✓ | ✓ |
| 8 | r_09fbf5d87ec2 | Gridwell, Routelyne, Trakvia | ✓ | not_rec / rec / neutral | none ✓ | ✓ |
| 9 | r_3efdb525038d | Novahaul, Trakvia | ✓ | neutral / neutral | none ✓ | ✓ |
| 10 | r_961cd5173760 | Trakvia | ✓ | rec | none ✓ | ✓ |
| 11 | r_808f0952e6b8 | Gridwell, Trakvia | ✓ | negative / neutral | none ✓ | ✓ |
| 12 | r_8f53698b2b6c | Gridwell, Trakvia | ✓ | neutral / neutral | none ($15–$60 range correctly ignored) ✓ | ✓ |
| 13 | r_6cce02122fc4 | Gridwell, Corvane | ✓ | neutral / negative | none ✓ | ✓ |
| 14 | r_f576f39bca91 | none | ✓ | n/a | none ✓ | ✓ |
| 15 | r_3a551965edff | Routelyne, Corvane | ✓ | rec / rec | none ✓ | ✓ |

\* Judgement call: "X has had a few billing complaints, but overall it's still one of the better choices" is labelled **recommended**, following the brief's rule that the final verdict wins.

**Result, sample A:** 90 of 90 company rows correct for mentioned/not mentioned (30 mentions, 60 non-mentions); 30 of 30 positions; 30 of 30 tones; 4 of 4 wrong facts found, 0 false alarms.

**Sample B (seed 99):** also 15 of 15 answers fully correct. It includes the misspelling "Corvain", "CORVANE Fleet", websites as names, and two "Some users find X expensive. Even so, … it's the one I'd pick" answers, which correctly come out as recommended.

## Whole-dataset checks (not hand-labelled, but broader)

- **Wrong facts:** every answer containing a known wrong claim was found with a plain text search, and the tool flagged all **95 of 95**, with no flags elsewhere. That search found a bug early on: the typo-matcher read "a fleet of 30" as "Fleetora", which hid three facts and created false mentions. Fuzzy matching now only applies to capitalised words.
- **Tone:** every distinct sentence pattern that decided a tone (about 150 patterns across all 510 answers) was listed and reviewed. That found two table phrases the rules missed ("Not for small fleets" and "Mixed reviews"), which are now fixed.

## Where it can go wrong

The sample scores are high because this data is built from a limited set of sentence patterns, and the rules were written after reading them. On unseen data, expect it to be less accurate. These are the known weak spots:

1. **New phrasing.** Tone is keyword rules. A judgement worded in a way no rule covers ("I'd lean towards X") falls back to *neutral*.
2. **Several companies in one sentence.** They all get that sentence's tone ("Pick Trakvia over Corvane" would mark both recommended). No such sentences exist in this data.
3. **"It" spanning paragraphs.** A sentence without a name is linked to the last company in the same line or paragraph only.
4. **Lower-case misspellings** ("trackvia") are not caught. Only capitalised near-misses are, to avoid false mentions.
5. **Facts** are only checked for price, HQ, founding year, the listed features and named integrations. Unusual wording ("costs north of forty dollars") will be missed.
6. **Judgement calls** that an answer key might label differently: "reliable choice if you need…" and "well worth shortlisting" → recommended; "has had complaints, but overall still one of the better choices" → recommended; "has a polished interface and decent reviews" → neutral.
