# PYQ Finder – CBSE Class 10 (Science, Maths) & Class 12 (Physics, Chemistry)

Static website. **No server, no internet, no API.** Double-click `index.html` and it works.

## Run
Open `index.html` in Chrome/Edge/Firefox. That's it. (Optional: `python -m http.server` in this folder.)

## Structure
```
index.html        page
css/style.css
js/search.js      ranking engine (the "AI": typo fix, synonym expansion, hint parsing, weighted scoring)
js/filters.js     year / type / nature / difficulty filtering
js/ui.js          rendering (cards, question view, answer check)
js/app.js         state + events
data/questions.json   SOURCE OF TRUTH – edit this
data/chapters.json    subject -> chapters
data/synonyms.json    concept -> related terms (query expansion)
data/data.js          GENERATED from the three JSON files (lets the site work from file://)
tools/build_data.py   validates + regenerates data.js
```

## Adding / editing questions
1. Edit `data/questions.json` (copy an existing entry; MCQ/Assertion-Reason/Case-part MCQs have `options` + `answer` index).
2. Run `python tools/build_data.py` – it checks required fields, duplicate ids, chapter names, answer indexes.
3. Refresh the page.

Good `topics` (concept phrases) and `keywords` are what make search feel smart: topics weigh 6, keywords 4, chapter 3, question text ~1.

## How search works (say this to the judges)
**Be precise:** this is an *AI-assisted* offline search, not a live AI. AI helped prepare the data (topic/keyword tags, the synonym map, transcription). In the browser there is no AI model, API or internet — just typo correction, synonym expansion, query parsing, filtering and weighted ranking. The page shows this live in the "Understanding your search" panel.

1. Lowercase + remove filler words ("questions on", "pyq", ...).
2. Detect hints: year, difficulty, marks, "numerical", "derive", "MCQ", "case study", subject → applied as filters (shown as removable chips; auto-relaxed if they would give 0 results).
3. Fix typos against the dataset vocabulary (corrections are shown in the panel) ("photoelectrc" → "photoelectric").
4. Expand with `synonyms.json` ("transformer" also looks for "step up", "turns ratio").
5. Score every question: exact chapter/topic phrase > topic > keyword > chapter > question text > solution text (whole-word matching; multi-word queries must match all words to rank high); show *why* it matched. Queries with only filters ("2026", "case study") list everything that passes the filters.
Deterministic, instant, explainable, works offline.

## Dataset status
This is a **selected / prototype collection**, not every CBSE PYQ.
 (Class 12: 93 questions; Class 10: see below)
Physics 48, Chemistry 45 · Years 2023 (32), 2024 (29), 2026 (32) · all from paper series 55/1/1 and 56/1/1 (Set 1, Delhi-region paper).

## Things to verify before the exhibition
- **Solutions are not from CBSE.** The uploaded zips contain only question papers, so all solutions were written by us. Have a teacher skim them, especially the 5-mark derivations and the A-R items. The footer says this on the page.
- **Questions were transcribed from text extraction + spot-checked visually.** Symbols were lost in extraction (exponents, π, μ…) so values were reconstructed; 5 numericals were checked against page images. Use the `source` line on each card (paper code + question number) to proof-read against the PDF.
- A few option lists were re-worded (e.g. chem-2023 cell notation, 2024 Arrhenius options, phy-2026-q06 option C) because extraction garbled them. Answers are unaffected.
- Questions that depend on a figure/graph/circuit were deliberately **left out** (no images in this MVP).
- The 2026 label comes from the PDF creation dates (Feb 2026); the papers themselves don't print a year. Confirm.
- Assertion–Reason option wording is standardised (Physics: 4th option = "A false, R false"; Chemistry: 4th = "A false, R true").
- `Chemistry-QP.rar` and the other paper series/sets (55/2…55/5, 56/2…56/5) and "for visually impaired" papers were not used yet; they are the easiest source of more questions.

## Adding a new paper (Class 10 / any class)
1. Write the questions as a JSON list in `data/batches/<name>.json` (same fields as questions.json; chapter names must match `chapters.json`).
2. Run `python tools/add_batch.py data/batches/<name>.json` - appends, skips duplicate ids, validates, rebuilds data.js.

## Class 10 status (Science + Maths Standard, Set 1 of each year)
| Year | Science | Maths Standard | Paper code |
|------|---------|----------------|-----------|
| 2024 | 37 | 37 | Science 31/31/1/1 · Maths 30/1/1 |
| 2025 | 32 | 36 | Science 31/1/1 · Maths 30/1/1 |
| 2026 | 37 | 37 | Science 31/1/1 · Maths 30/1/1 |

Batch files live in `data/batches/` (`*-2024-*`, `*-2025-*`, `*-2026-*`).

Skipped on purpose (need a figure/graph, or the paper's own options are ambiguous):
- 2024 Maths Q18 (graph of two lines) · 2024 Science Q14 (solenoid field pattern), Q25(B) circuit, Q31 (eye-defect diagram)
- 2026 Maths Q4 (graph of f(x)) · 2026 Science Q2 (reproduction diagram), Q6 (all three statements are true but options don't list all of them)
- 2025: see the earlier note (Maths Q10, Q26; several figure items)

Things to verify before the exhibition:
- 2024 and 2026 papers were scanned images, so questions were read by OCR and checked against page images. Use the `source` line (paper code + question number) to proof-read.
- 2024 Maths Q38: the paper prints AB = 7 m, BC = 15 m, so AC = √274 and x = (√274 − 8)/2 (not a neat number). The solution follows the paper as printed.
- 2024 Maths Q34(b): the figure shows PC and AR meeting at Q; this is stated in the question text.
- 2024 Science Q10 (answer: Axon) and 2026 Science Q23 (Calcium), Q32 (A true, R false) and 2026 Maths Q20 (option B) are the answers most worth a teacher's check.
- Where a question has an OR option whose part needs a figure (2024 Science Q25), only the text-answerable part is kept.
- The year label for 2026 comes from the PDF creation dates (Feb–Mar 2026); the papers don't print a year. Solutions are written by us, not CBSE.
