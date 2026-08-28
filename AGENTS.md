# Veda AI: Project Guide

## Purpose

Veda AI is a Next.js hiring-assignment prototype for evaluating one student's handwritten exam submission against one question paper. A teacher uploads both documents, the server extracts questions and handwritten answers with Gemini, maps answers to questions, grades them, and shows the answer-sheet regions that support each result.

The essential user outcome is simple: for every printed question, show whether it was answered, the score and feedback, and the exact place on the scanned answer sheet where the answer was found.

This is an in-memory demo application. It has no authentication, database, multi-student batch workflow, or persistent file storage.

## Current State

The end-to-end upload, polling, session, Gemini, rasterization, and analyzer paths are present. The app works in two modes:

- **Gemini mode:** used when `GEMINI_API_KEY` is set and the upload is not forced into demo mode.
- **Demo mode:** used when no Gemini key is available, or when the request contains `demo=true`. It returns `SAMPLE_EVALUATION` after progressing through the same visible stages.

The guide intentionally describes what is in the repository now, rather than a proposed architecture. See [Known Gaps](#known-gaps-and-risks) before expanding the app.

## Tech Stack

| Area | Current implementation |
| --- | --- |
| App | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4 and local Bricolage Grotesque font |
| UI primitives | shadcn components plus custom page components |
| Client data | Axios and TanStack Query |
| AI | `@google/genai`; Gemini only, server-side |
| PDF/image ingest | `pdf-to-img`; answer PDFs are rasterized to PNG |
| Storage | process-local `Map` attached to `globalThis` |
| Runtime | Node.js route handlers; Bun is the configured package manager |

Do not expose Gemini keys to client components. Do not add a different model provider unless the task explicitly requires it.

## User Flow

1. `/` shows the two-file upload form. It accepts one question paper and one answer sheet (`.pdf`, `.png`, `.jpg`, `.jpeg`).
2. Clicking **Start Mapping** posts multipart form data to `POST /api/evaluate`.
3. The client polls `GET /api/sessions/:id/status` every 800 ms and renders stage-based progress.
4. When a session becomes terminal, the client stores its id in `sessionStorage` and navigates to `/analizer?session=:id`.
5. `/analizer` polls `GET /api/sessions/:id` until it receives either a completed evaluation or a contextual failure.
6. Selecting a question selects it in the list, changes to its first detected page, and emphasizes its region. Clicking an overlay selects the corresponding question.

Opening `/analizer` without a session id is an intentional browse-only sample-data view. A real session must never silently fall back to sample data.

## Routes and API Contract

| Route | Role |
| --- | --- |
| `/` | Upload page via `components/page/upload-page.tsx` |
| `/analizer` | Analysis UI via `components/page/analyzer-page.tsx` (spelling is intentionally retained) |
| `POST /api/evaluate` | Starts a session from `questionPaper` and `answerSheet` multipart files |
| `GET /api/sessions/:id/status` | Returns `SessionStatus` for upload progress polling |
| `GET /api/sessions/:id` | Returns pending (`202`), completed evaluation, or `SessionFailure` |
| `GET /api/sessions/:id/pages/:page` | Serves a stored rasterized answer page |

`POST /api/evaluate` also understands `demo=true` and `forceFail=true`. `forceFail` exists to demonstrate the document-validation failure state.

## Server Pipeline

`lib/ai/pipeline.ts` runs the live evaluation asynchronously after the POST route returns a session id:

1. **Ingest/rasterize:** `lib/pdf/rasterize.ts` turns an answer PDF into page PNGs, or retains a single image upload as page 1. The resulting buffers stay in the session store.
2. **Validate documents:** Gemini checks that the first file is an exam paper, the second is a handwritten answer sheet, and that they look compatible. Invalid documents become `SessionFailure` rather than an unhelpful generic error.
3. **Extract questions:** Gemini reads the question paper and returns an ordered list. Printed labels, including sub-parts such as `11(a)`, must remain separate entries and retain their original strings.
4. **Extract handwritten answers:** Gemini reads rasterized answer pages and returns transcription, visible answer label, page number, and normalized `box_2d` coordinates for each answer section.
5. **Optional grounding:** `lib/ai/thinking-loop.ts` derives grading guidance. It only uses Gemini's Google Search tool when `ENABLE_GOOGLE_SEARCH=true`; failures here do not stop grading. `SKIP_THINKING_LOOP=true` skips this stage.
6. **Map and grade:** Gemini matches extracted handwritten content to question labels and content, emits per-question regions and marks, and emits unmatched answer regions.
7. **Finalize:** the pipeline converts model output into `EvaluationSession`, calculates totals, and completes the session.

The public progress state exposes `ingest_rasterize`, `validate_documents`, `extract_questions`, `thinking_loop`, `map_answers`, and `grade_feedback`. Handwriting extraction currently occurs internally between question extraction and optional grounding; it has no separate public stage.

## Data Model and Geometry

Canonical shared types live in `lib/types/evaluation.ts`:

- `EvaluationSession` is the completed response model.
- `MappedQuestion` contains the original `number`, score, status, text, feedback, and `regions`.
- `AnswerRegion` has a 1-based `page` and a percentage box.
- `UnmappedAnswer` represents a detected answer region which did not map to a question.
- `SessionStatus` and `SessionFailure` model polling and contextual error states.

Gemini uses `box_2d = [ymin, xmin, ymax, xmax]`, normalized from 0 to 1000. Only `lib/geometry/box.ts` should convert it to CSS percentage geometry:

```text
x      = xmin / 10
y      = ymin / 10
width  = (xmax - xmin) / 10
height = (ymax - ymin) / 10
```

`page` and `boundingBox` on `MappedQuestion` are compatibility fields derived from the first region. New code should use `regions`, which supports multi-page answers. Do not hand-roll box axis order in a component.

## UI Structure

| Component | Responsibility |
| --- | --- |
| `components/page/upload-page.tsx` | File picking, starting evaluation, status polling, redirect to analyzer |
| `components/page/analyzer-page.tsx` | Session loading/failure handling, question selection, desktop/mobile split layout |
| `components/page/document-viewer.tsx` | Raster-page image, page controls, zoom, and CSS absolute overlays |
| `components/page/question-card.tsx` | Question score and expandable AI feedback |
| `components/page/mock-data.ts` | `SAMPLE_EVALUATION` and legacy UI interfaces for demo compatibility |
| `components/providers/query-provider.tsx` | Shared TanStack Query client |

Highlights must remain CSS absolute overlays over the rasterized `<img>`. Canvas and PDF annotation engines are not part of this version. Keep non-selected overlay fills subtle; selected and hovered regions may use stronger emphasis.

## Important Implementation Rules

1. Reuse the existing shell, shadcn primitives, and page-level components. Do not replace the design wholesale.
2. Keep Gemini calls in route handlers or server-only modules under `lib/ai`.
3. Send the question paper to Gemini as its native file; use rasterized images for answer-sheet spatial detection.
4. Preserve every printed question in order, including labeled sub-parts and visible mark allocations.
5. Map by visible labels and answer content, not sheet order alone. Answers may be written out of order or span pages.
6. An empty `regions` array means unanswered. Do not invent a highlight for a genuinely unanswered question.
7. Preserve unmatched answer detections as `unmappedAnswers`; do not discard them merely because no question matched.
8. Failure responses must be actionable, per-file where possible, and shown in `/analizer`.
9. Keep session id propagation through `?session=` and `sessionStorage` intact.
10. Existing worktrees may contain user changes. Preserve them; do not reset or overwrite unrelated edits.

## Configuration and Local Checks

```bash
GEMINI_API_KEY=...                # required for live AI mode
GEMINI_MODEL=...                  # optional preferred model
GEMINI_API_KEYS=key1,key2         # optional rotation pool
ENABLE_GOOGLE_SEARCH=true         # optional grounding search
SKIP_THINKING_LOOP=true           # optional speed/debug switch
```

`lib/ai/gemini.ts` retries quota/rate-limit failures and can rotate through `GEMINI_API_KEYS` and fallback models. Do not claim a specific Gemini model is guaranteed unless it is configured and available in the target project.

Useful local commands:

```bash
bun dev
bun run build
bun scripts/test-sample.ts
```

The sample pipeline script requires a valid Gemini key and reads `public/sample/question.pdf` and `public/sample/answer.pdf`. There is no dedicated automated test script in `package.json` yet.

## Known Gaps and Risks

- `components/page/question-card.tsx` and `components/page/document-viewer.tsx` still import their interfaces from `mock-data.ts` rather than the canonical `lib/types/evaluation.ts` model. Consolidate these before making broad contract changes.
- `unmappedAnswers` are persisted in the session response but are not yet surfaced as selectable analyzer UI items.
- `applyFallbackRegions` in `lib/ai/pipeline.ts` synthesizes page-1 regions for mapped answers that lack a model box. This keeps the demo usable but may misrepresent spatial evidence. Prefer a clear "location unavailable" state for production-quality highlighting.
- The `grade_feedback` stage currently mainly finalizes results after mapping/grading; grading itself happens in `mapAnswersAndGrade`.
- The UI accepts only one answer-sheet file, despite plural variable naming. Multiple image uploads are not implemented.
- Answer-image MIME handling supports more formats server-side than the upload picker exposes. Keep the client accept list and server capabilities aligned when extending formats.
- In-memory sessions and page buffers disappear after a process restart and are unsuitable for multi-instance/serverless persistence.
- Inline base64 model inputs and PDF rasterization are constrained by request size, memory, cold starts, and Gemini rate limits.
- Handwriting transcription and bounding boxes are approximate, especially for scribbles, diagrams, marginal notes, and dense multi-column pages.
- Assessment policies such as optional question choices, negative marking, total-paper marks, section rules, and partial-credit rubrics need explicit prompt/schema support before their scores should be treated as authoritative.

## Product Quality Checklist

- Extract all questions in printed order and preserve labels such as `11(a)`.
- Recognize displayed total marks, section instructions, compulsory questions, and optional-choice rules before grading.
- Handle negative marking and crossed-out/scribbled responses explicitly; never infer a penalty without an assessment rule.
- Match out-of-order answers by label and content.
- Show unanswered questions without regions.
- Support multi-page answer regions.
- Show and make orphan/unmapped regions selectable.
- Verify question-card to highlight synchronization and page jumps on desktop and mobile after UI changes.
- Test success, missing-key demo, and forced document-failure paths.

## Deployment Notes

Set `GEMINI_API_KEY` only in the server environment. A Vercel-style deployment also needs enough function duration and body-size allowance for multipart PDFs and rasterization. Document the in-memory-session limitation and the approximate nature of handwriting boxes in any submission or demo handoff.
