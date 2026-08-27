# Veda AI — Agent & Project Guide

Hiring assignment clone: **AI Assessment Extraction & Answer Mapping**.
A teacher uploads a question paper + one handwritten answer sheet; the app extracts questions, maps answers, highlights regions on the sheet, and (optionally) grades with feedback.

Follow the Figma design closely. Evaluate accuracy of extraction, mapping, highlights, and edge-case handling.

---

## Product goal

A teacher should upload a question paper and answer sheet and quickly understand:

- Which question was answered
- Where the answer is on the sheet (exact highlighted region)
- Which questions were left unanswered
- (Bonus) marks, correct/partial/incorrect, AI feedback, summary

**Core flow:** Question Extraction → Answer Extraction → Answer Mapping → Grading/Feedback

---

## Non-goals (v1)

- Authentication / multi-tenant accounts
- Database persistence (in-memory sessions only)
- Batch grading of many students in one run (assignment: **one** answer sheet)
- Provider-agnostic AI adapter (Gemini only)
- HTML Canvas or PDF.js annotation engines for highlights

---

## Locked technical decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Framework | **Next.js** App Router (this repo) | Recommended by assignment; UI already started |
| Client data | **Axios** + **TanStack Query** (`lib/api/*`, `QueryProvider`) | Upload mutation + status/session polling; Gemini stays server-side |
| AI | **Google Gemini only** (`@google/genai`) | Native PDF + image input; structured JSON; free tier; trained `box_2d` |
| File host for model | **None required** | Inline base64 or Gemini Files API (Google temp ~48h). No S3/Cloudinary |
| Highlights | **CSS absolute % overlays** on rasterized page `<img>` | Matches existing `DocumentViewer`; easy click sync; no Canvas |
| Storage | **In-memory `Map`** | Assignment allows it; no DB |
| Auth | None | Assignment |

### Why Gemini (vs other providers)

- **PDF:** Gemini accepts `application/pdf` inline or via Files API. Other providers usually force PDF→images and often a **public URL**, which pushes you toward Cloudinary/S3.
- **Images:** Same path for scanned sheets / photo uploads.
- **Boxes:** Object detection returns `box_2d: [ymin, xmin, ymax, xmax]` normalized to **0–1000**. Convert to CSS percentages for overlays.
- **Caveat:** Spatial precision on *raw PDFs* is weaker (Google notes this). For **answer highlighting**, always run detection on **rasterized page images**, not on the PDF bytes alone.

### Hybrid ingest strategy

1. **Question paper** → send PDF/images to Gemini for ordered question list (native PDF OK; no QP highlights required).
2. **Answer sheet** → rasterize pages in our app → send page images to Gemini for transcription + `box_2d` + question mapping.
3. Multi-page answers → `regions: [{ page, box }, ...]`.

---

## Highlighting (no Canvas)

Existing UI already draws overlays from percentage boxes in `components/page/document-viewer.tsx`.

**Gemini → CSS:**

```
box_2d = [ymin, xmin, ymax, xmax]   // integers 0..1000
x      = xmin / 10                  // %
y      = ymin / 10
width  = (xmax - xmin) / 10
height = (ymax - ymin) / 10
```

Helpers live in `lib/geometry/box.ts`. Never hand-roll axis order in components.

**Interaction:**

- Click question card → select id, jump to first region’s page, emphasize box
- Click box → select that question
- Empty `regions` → unanswered
- Orphan sheet regions → `unmappedAnswers[]` with their own boxes

Do **not** introduce Canvas unless product later needs freehand segmentation masks.

---

## Data contracts

Canonical types: `lib/types/evaluation.ts` (UI may re-export from `mock-data` during migration).

```ts
type BoxPct = { x: number; y: number; width: number; height: number }; // 0–100

type AnswerRegion = {
  page: number; // 1-based
  box: BoxPct;
};

type QuestionStatus =
  | "correct"
  | "partial"
  | "incorrect"
  | "unanswered";

type MappedQuestion = {
  id: string;
  number: string; // preserve "11(a)", "3", etc.
  title?: string;
  questionText: string;
  maxMarks: number;
  marksObtained: number;
  status: QuestionStatus;
  studentAnswer: string;
  modelAnswer?: string;
  aiRemarks: string;
  confidence?: number;
  regions: AnswerRegion[]; // empty ⇒ unanswered
  // Compatibility with current UI: page + boundingBox derived from regions[0]
  page: number;
  boundingBox: BoxPct;
};

type UnmappedAnswer = {
  id: string;
  transcription: string;
  regions: AnswerRegion[];
};

type EvaluationSession = {
  id: string;
  title: string;
  subject?: string;
  grade?: string;
  studentName?: string;
  rollNumber?: string;
  date: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  totalPages: number;
  questions: MappedQuestion[];
  unmappedAnswers: UnmappedAnswer[];
  pageImagePaths?: string[]; // served via /api/sessions/:id/pages/:n
};
```

---

## Pipeline

```
POST /api/evaluate (multipart: questionPaper, answerSheet)
  → sessionId + in-memory buffers
  → stages (poll GET /api/sessions/:id/status):
       1. ingest_rasterize      — answer PDF/images → page PNGs
       2. validate_documents    — Gemini contextual check (wrong PDF / mismatch)
       3. extract_questions     — Gemini on QP (skipped if invalid)
       4. thinking_loop         — agent plan → Google Search grounding → synthesize grader brief
       5. map_answers           — Gemini on page images + question list + grounded notes
       6. grade_feedback        — scores / remarks
  → GET /api/sessions/:id
       { ok: true, evaluation }  |  { ok: false, failure }
  → GET /api/sessions/:id/pages/:page — page image bytes
```

**Wrong PDF / bad upload:** AI returns `SessionFailure` (per-file `issues` + `suggestions`). Client still opens `/analizer` in a **failed state** with contextual guidance and Re-upload CTA. Demo: `forceFail=1` with `demo=1`.

**Contextual rule:** For a real session id, analyzer must not silently fall back to `SAMPLE_EVALUATION`. Show loading until terminal, then AI evaluation or failure.

### Prompt rules (evaluation criteria)

- Extract **every** question in printed order
- Split labelled sub-parts: `11(a)` and `11(b)` are **two** entries
- Preserve original numbering strings
- Map by content + visible labels (`Ans 3`, `Q11(a)`), **not** sheet order alone
- Handle out-of-order answers
- Emit unanswered when no region matches
- Emit unmapped regions that match no question
- Allow answers spanning multiple pages (`regions.length > 1`)
- Low temperature + JSON schema / structured output

---

## UI map

| Route | Component | Role |
|-------|-----------|------|
| `/` | `components/page/upload-page.tsx` | Dual upload + real progress |
| `/analizer` | `components/page/analyzer-page.tsx` | Question list + document viewer + scores |

**Figma source:** [VedaAI Hiring Assignment](https://www.figma.com/design/GEjt1rt1s7AXvkcr4t8muE/VedaAI-Hiring-Assignment) (`GEjt1rt1s7AXvkcr4t8muE`)

Key frames to match:
- `1:8744` Upload empty · `1:8797` Upload filled · `1:9959` Loading · `1:8861` Q–A mapping

Chrome: cream canvas + soft grey blobs, white expanded sidebar (`VedaAI`, black **AI Teacher’s Toolkit**, **Exams** active with orange underline), top bar (search / Exams / ? / bell / theme / user), dark **Start Mapping**, analyzer split **Extracted Questions** | **Answer Sheet** with amber answer-region brackets.

Reference exports (gitignored): `.figma-ref/*.png`

After evaluate completes, navigate with `?session=<id>` (or sessionStorage) and fetch session payload. Keep mock `SAMPLE_EVALUATION` as **fallback** when `GEMINI_API_KEY` is missing or `?demo=1`.

---

## Folder layout

```
AGENTS.md
app/
  page.tsx                          # upload
  analizer/page.tsx                 # analyzer (typo kept for existing links)
  api/evaluate/route.ts
  api/sessions/[id]/route.ts
  api/sessions/[id]/status/route.ts
  api/sessions/[id]/pages/[page]/route.ts
components/page/                    # product UI
lib/
  ai/gemini.ts
  ai/prompts.ts
  ai/schemas.ts
  ai/pipeline.ts
  geometry/box.ts
  pdf/rasterize.ts
  session/store.ts
  types/evaluation.ts
```

---

## Env & deploy

```bash
GEMINI_API_KEY=...          # server only
# optional
GEMINI_MODEL=gemini-2.5-flash   # or current Flash/Pro with vision + structured output
```

- Never import the key into client components
- Deploy (Vercel or similar) with the env var set
- Document limits: serverless body size, cold starts, in-memory loss on restart
- Submission needs: live URL, GitHub repo, approach blurb, model used, assumptions

---

## Edge-case checklist

- [ ] Sub-parts as separate questions with original labels
- [ ] Answers written out of order still map correctly
- [ ] Unanswered questions show empty regions + clear status
- [ ] Orphan answers listed separately and highlightable
- [ ] Multi-page answer regions
- [ ] Image-only uploads (no PDF) for either side
- [ ] Progress UI reflects real stages (not only timeouts)
- [ ] Demo/mock path without API key

---

## Coding conventions for agents

1. **Reuse** existing shadcn + page components; do not rebuild the shell.
2. **Extend** evaluation types; avoid a second parallel model for the same concepts.
3. Highlights = **CSS % overlays** on page images only.
4. All Gemini calls = **Route Handlers / server modules** only.
5. Centralize `box_2d` conversion in `lib/geometry/box.ts`.
6. Comments: short, factual; no narration of obvious code.
7. Prefer Bun scripts already in `package.json`.
8. When changing UI, verify in the browser (upload → progress → analyzer click-highlight sync, desktop + mobile).

---

## Known limitations (be honest in submission)

- Bounding boxes on messy handwriting are approximate (IoU imperfect).
- Free-tier rate limits / latency on multi-page sheets.
- In-memory sessions vanish on server restart / new serverless instance.
- PDF spatial citations without rasterization are unreliable — we always rasterize answer pages for highlights.
- Grading quality depends on subject/domain and rubric richness in the question paper.

---

## Implementation phases

1. **Docs & types** — this file + `lib/types/evaluation.ts`
2. **Ingest & session** — store, rasterize, status/page APIs
3. **Gemini pipeline** — extract → map → grade
4. **UI wiring** — real progress + page images + multi-region overlays
5. **Polish & deploy** — errors, demo fallback, live URL

---

## Quick reference: current mock UI

- Upload simulates progress then `router.push("/analizer")`
- Analyzer reads `SAMPLE_EVALUATION` from `components/page/mock-data.ts`
- `DocumentViewer` overlays use `question.boundingBox` percentages on a **fake** notebook — replace with real page images when pipeline lands
