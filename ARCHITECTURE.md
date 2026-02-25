# AI Ebook Generator — Architecture & Technical Reference

> Production-grade system for generating ~250-page structured technical ebooks via OpenAI LLM, with a two-phase workflow (Markdown → user approval → PDF/DOCX), Google Drive upload, and bulk CLI generation.

---

## Table of Contents

- [1. System Overview](#1-system-overview)
- [2. Monorepo Structure](#2-monorepo-structure)
- [3. High-Level Architecture](#3-high-level-architecture)
- [4. Generation Flow (End-to-End)](#4-generation-flow-end-to-end)
- [5. Orchestration Pipeline](#5-orchestration-pipeline)
- [6. Academic Ebook Structure](#6-academic-ebook-structure)
- [7. LLM Call Inventory — Production Mode](#7-llm-call-inventory--production-mode)
- [8. Token Budget — Per Call Breakdown](#8-token-budget--per-call-breakdown)
- [9. Prompt Architecture](#9-prompt-architecture)
- [10. Session Lifecycle & State Machine](#10-session-lifecycle--state-machine)
- [11. PDF Generation Pipeline](#11-pdf-generation-pipeline)
- [12. DOCX Generation](#12-docx-generation)
- [13. Google Drive Integration](#13-google-drive-integration)
- [14. Bulk Generation (CLI)](#14-bulk-generation-cli)
- [15. Frontend Architecture](#15-frontend-architecture)
- [16. API Routes](#16-api-routes)
- [17. Safety & Resilience](#17-safety--resilience)
- [18. Debug Mode](#18-debug-mode)
- [19. Environment Variables](#19-environment-variables)
- [20. Docker & AWS Deployment](#20-docker--aws-deployment)

---

## 1. System Overview

| Property               | Value                                                    |
|------------------------|----------------------------------------------------------|
| **Backend**            | Express.js (Node.js) — standalone process on port 4000   |
| **Frontend**           | Next.js 14 App Router — port 3000, proxies `/api/*`      |
| **LLM Provider**       | OpenAI (SDK `^4.77`)                                     |
| **Primary Model**      | `gpt-4o-mini` (debug), `gpt-4o` recommended (production) |
| **Light Model**        | `gpt-4o-mini` — used for micro-summaries, unit summaries, edits, glossary, exercises |
| **PDF Engine**         | Puppeteer (headless Chrome) + pdf-lib (merge & page nums) |
| **DOCX Engine**        | html-to-docx                                             |
| **Markdown Renderer**  | Marked v17 + Highlight.js v11                            |
| **Session Storage**    | In-memory `Map<sessionId, SessionState>` + disk persistence (`.sessions/`) |
| **Concurrency**        | Max 3 concurrent sessions (configurable)                 |
| **Session TTL**        | 30 minutes (configurable via `SESSION_TTL_MS`)           |
| **Target Output**      | ~250 pages, ~75,000 words                                |
| **Drive Upload**       | Google Drive API v3 (OAuth 2.0 offline refresh token)    |
| **Bulk Generation**    | CLI script — reads CSV/XLSX, generates all, uploads to Drive |

---

## 2. Monorepo Structure

```
ebook-generator/
├── package.json                    # npm workspaces root
├── Dockerfile                      # Multi-stage production build
├── docker-compose.yml              # Single-command deployment
├── docker-entrypoint.sh            # Entrypoint: web | batch mode
├── ARCHITECTURE.md                 # This file
├── apps/
│   ├── api/                        # Express backend
│   │   ├── src/
│   │   │   ├── index.ts            # Express server entrypoint
│   │   │   ├── cli/
│   │   │   │   └── batch.ts        # Bulk generation CLI script
│   │   │   ├── lib/
│   │   │   │   ├── config.ts       # DEBUG_MODE, UNIT_COUNT, etc.
│   │   │   │   ├── counters.ts     # Call & token limit enforcement
│   │   │   │   ├── openai-client.ts# OpenAI SDK wrapper + callLLM()
│   │   │   │   ├── session-store.ts# In-memory session Map + disk persistence + TTL sweeper
│   │   │   │   └── types.ts        # All TypeScript interfaces
│   │   │   ├── orchestrator/
│   │   │   │   ├── index.ts        # Main orchestration pipeline
│   │   │   │   ├── generate-structure.ts
│   │   │   │   ├── generate-preface.ts
│   │   │   │   ├── generate-subtopic.ts
│   │   │   │   ├── generate-micro-summary.ts
│   │   │   │   ├── combine-unit-summary.ts
│   │   │   │   ├── generate-unit-intro.ts
│   │   │   │   ├── generate-unit-end-summary.ts
│   │   │   │   ├── generate-unit-exercises.ts
│   │   │   │   ├── generate-capstone.ts
│   │   │   │   ├── generate-case-study.ts
│   │   │   │   ├── generate-glossary.ts
│   │   │   │   ├── generate-bibliography.ts
│   │   │   │   ├── build-markdown.ts
│   │   │   │   ├── visual-validator.ts
│   │   │   │   ├── retry.ts
│   │   │   │   └── debug.ts
│   │   │   ├── prompts/
│   │   │   │   ├── system.ts
│   │   │   │   ├── structure.ts
│   │   │   │   ├── subtopic.ts
│   │   │   │   ├── subtopic-visual-retry.ts
│   │   │   │   ├── micro-summary.ts
│   │   │   │   ├── unit-summary-combine.ts
│   │   │   │   ├── preface.ts
│   │   │   │   ├── unit-intro.ts
│   │   │   │   ├── unit-end-summary.ts
│   │   │   │   ├── unit-exercises.ts
│   │   │   │   ├── glossary.ts
│   │   │   │   ├── bibliography.ts
│   │   │   │   ├── capstone.ts
│   │   │   │   └── case-study.ts
│   │   │   ├── pdf/
│   │   │   │   ├── generate-pdf.ts      # Chunked rendering + merge
│   │   │   │   ├── markdown-to-html.ts  # Marked + Highlight.js
│   │   │   │   ├── html-template.ts     # Full HTML wrapper + print CSS
│   │   │   │   └── browser-pool.ts      # Puppeteer lifecycle (singleton with mutex)
│   │   │   ├── docx/
│   │   │   │   └── generate-docx.ts     # HTML-to-DOCX conversion
│   │   │   ├── drive/
│   │   │   │   ├── auth.ts              # Google OAuth2 client + token exchange
│   │   │   │   └── upload.ts            # Upload PDF/DOCX buffers to Drive folders
│   │   │   └── routes/
│   │   │       ├── generate.ts
│   │   │       ├── progress.ts
│   │   │       ├── content.ts
│   │   │       ├── regenerate.ts
│   │   │       ├── edit-section.ts
│   │   │       ├── undo.ts
│   │   │       ├── approve.ts
│   │   │       ├── download.ts
│   │   │       └── auth.ts             # One-time OAuth flow for Drive setup
│   │   ├── .env
│   │   └── .env.example
│   └── frontend/                   # Next.js 14
│       ├── next.config.mjs         # Rewrites /api/* → API_URL (configurable)
│       └── src/
│           ├── app/                # App Router pages
│           ├── hooks/
│           │   ├── useProgressStream.ts
│           │   └── useSubtopicContent.ts
│           └── components/
│               ├── GeneratorForm.tsx
│               ├── SyllabusPhase.tsx
│               ├── WorkspaceLayout.tsx
│               ├── Navigator.tsx
│               ├── ContentViewer.tsx
│               ├── MetadataPanel.tsx
│               ├── BookPreview.tsx
│               ├── ExportPreviewModal.tsx
│               ├── DownloadButton.tsx
│               └── ProgressDisplay.tsx
```

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            BROWSER (User)                               │
│                                                                         │
│   GeneratorForm → SyllabusPhase → WorkspaceLayout                       │
│       │                               ┌──────┬──────────┬─────────┐    │
│       │                               │ Nav  │ Content  │Metadata │    │
│       │                               │ Tree │ Viewer   │ Panel   │    │
│       │                               └──────┴──────────┴─────────┘    │
│       │  POST /api/generate                                             │
│       │  GET  /api/progress/poll (every 1–10s)                          │
│       │  GET  /api/content?sid=...&unit=...&subtopic=...                │
│       │  POST /api/regenerate                                           │
│       │  POST /api/edit-section                                         │
│       │  POST /api/undo                                                 │
│       │  POST /api/approve                                              │
│       │  GET  /api/download?sid=...                                     │
└───────┼─────────────────────────────────────────────────────────────────┘
        │  Next.js rewrites /api/* → NEXT_PUBLIC_API_URL/api/*
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXPRESS API (Port 4000)                          │
│                                                                         │
│   Routes → Session Store (Map + disk) → Orchestrator → OpenAI API      │
│                                              │                          │
│                                              ├── Structure Gen (JSON)   │
│                                              ├── Preface Gen  (Markdown)│
│                                              ├── Unit Intro Gen         │
│                                              ├── Subtopic Gen (Markdown)│
│                                              ├── Micro-Summary (Text)   │
│                                              ├── Unit Summary  (Text)   │
│                                              ├── Unit End Summary       │
│                                              ├── Unit Exercises (MCQs)  │
│                                              ├── Capstone Gen (Markdown)│
│                                              ├── Case Study Gen         │
│                                              ├── Glossary Gen           │
│                                              ├── Bibliography Gen       │
│                                              └── Build Final Markdown   │
│                                                                         │
│   On /api/approve:                                                      │
│   Final Markdown → Marked/Highlight.js → HTML → Puppeteer → PDF        │
│   PDF chunks → pdf-lib merge → page numbers → session.pdfBuffer         │
│                                                                         │
│   Bulk CLI (batch.ts):                                                  │
│   CSV/XLSX → for each title → orchestrate → PDF + DOCX → Google Drive  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Generation Flow (End-to-End)

```
User enters topic + selects model
        │
        ▼
POST /api/generate → createSession() → orchestrate() runs async
        │                                     │
        │ returns { sessionId }               │
        ▼                                     ▼
Frontend polls GET /api/progress/poll    ┌────────────────────────┐
  every 1s (active) / 10s (terminal)     │ PHASE 1: Structure     │
        │                                │ (1 LLM call → JSON)    │
        │                                └───────┬────────────────┘
        │                                        ▼
        │                                ┌────────────────────────┐
        │                                │ PHASE 1b: Preface      │
        │                                │ (1 LLM call)           │
        │                                └───────┬────────────────┘
        │                                        ▼
        │                                ┌────────────────────────┐
        │  ◄── structure populated ──── │ PHASE 2: Units          │
        │       in poll response         │ Per unit:               │
        │                                │  - Unit Intro (1 call)  │
        │                                │  - Subtopics (5 calls)  │
        │                                │  - Micro-summaries (5)  │
        │                                │  - Unit Summary (1)     │
        │                                │  - End Summary (1)      │
        │                                │  - Exercises (1)        │
        │                                │ x 12 units              │
        │                                └───────┬────────────────┘
        │                                        ▼
        │                                ┌────────────────────────┐
        │                                │ PHASE 3: Capstones     │
        │                                │ (1 batched call)       │
        │                                └───────┬────────────────┘
        │                                        ▼
        │                                ┌────────────────────────┐
        │                                │ PHASE 4: Case Studies  │
        │                                │ (1 batched call)       │
        │                                └───────┬────────────────┘
        │                                        ▼
        │                                ┌────────────────────────┐
        │                                │ PHASE 5: Glossary      │
        │                                │ (1 call)               │
        │                                └───────┬────────────────┘
        │                                        ▼
        │                                ┌────────────────────────┐
        │                                │ PHASE 6: Bibliography  │
        │                                │ (1 call)               │
        │                                └───────┬────────────────┘
        │                                        ▼
        │                                ┌────────────────────────┐
        │  ◄── status: markdown_ready ──│ PHASE 7: Assembly       │
        │                                │ (stitch all markdown)   │
        │                                └────────────────────────┘
        ▼
User reviews content in workspace
  (can regenerate / edit / undo any subtopic)
        │
        ▼
POST /api/approve → rebuildFinalMarkdown → exportPDF() async
        │
        ▼
GET /api/download → returns PDF binary
```

---

## 5. Orchestration Pipeline

The orchestrator (`apps/api/src/orchestrator/index.ts`) runs as a single async function per session. Each step is sequential to maintain context coherence.

### Phase 1 — Structure Generation

1. Call LLM with `SYSTEM_PROMPT_STRUCTURE` + `buildStructurePrompt(topic)`
2. Parse JSON response → validate against schema (exact counts)
3. On failure: retry with `STRUCTURE_RETRY_SUFFIX` appended
4. On second failure: `repairStructure()` fills placeholders to meet schema
5. Result: `BookStructure` with unit titles, subtopic titles, capstone titles, case study titles

### Phase 1b — Preface

1. Call LLM to generate a 300–400 word preface
2. Stored in `session.prefaceMarkdown`

### Phase 2 — Unit-by-Unit Content Generation

For each of the 12 units (sequential):

```
for unitIdx 0..11:
  prevUnitSummary = unitSummaries[unitIdx - 1] or null
  prevMicro = null  (subtopic-level chaining)

  generateUnitIntro()            → session.unitIntroductions[unitIdx]

  for subtopicIdx 0..4:
    ┌──────────────────────────────────────┐
    │ 1. generateSubtopic()                │
    │    → inject prevUnitSummary (unit)   │
    │    → inject prevMicro (subtopic)     │
    │    → callLLM (maxTokens: 1800)       │
    │    → visualValidator checks output   │
    │    → if no visual: retry with        │
    │      visual-retry prompt appended    │
    │    → store in session.subtopicMd Map │
    ├──────────────────────────────────────┤
    │ 2. generateMicroSummary()            │
    │    → truncate content to 250 tokens  │
    │    → callLLM (maxTokens: 100)        │
    │    → store micro-summary             │
    │    → prevMicro = this micro-summary  │
    └──────────────────────────────────────┘

  combineUnitSummary()
    → feed all 5 micro-summaries
    → callLLM (maxTokens: 150)
    → produce 80–100 word paragraph
    → store in session.unitSummaries[]

  generateUnitEndSummary()       → bullet-point takeaways
  generateUnitExercises()        → MCQs with answers

  Free micro-summaries (set to null) to save memory
```

**Subtopic-level summary chaining:** Each subtopic receives the micro-summary of the previous subtopic (50–80 words) as additional context. This improves within-unit cohesion without the cost of injecting full-text context.

**Model routing:** Micro-summaries, unit-summary combines, unit intros, end summaries, exercises, glossary, and bibliography use `LIGHT_MODEL` (default: `gpt-4o-mini`) regardless of the session's primary model.

### Phase 3 — Capstones (Batched)

Both capstones are generated in a single LLM call:
- Inject all 12 unit summaries as context
- Single call with `maxTokens: 5000`, temperature: 0.35
- Output split by `---` separator or `## Capstone Project` headings
- Fallback: if batched output can't be split, retries with per-item calls

### Phase 4 — Case Studies (Batched)

Same batching strategy as capstones with fallback to per-item calls.

### Phase 5 — Glossary

Single LLM call generating an alphabetical glossary of key terms from the book.

### Phase 6 — Bibliography

Single LLM call generating APA-formatted references.

### Phase 7 — Assembly

- `buildFinalMarkdown()` stitches: Cover → Copyright → Preface → TOC → Units (intro + subtopics + summary + exercises) → Capstones → Case Studies → Glossary → Bibliography
- Session status transitions to `markdown_ready`
- Intermediate markdown arrays freed from memory

---

## 6. Academic Ebook Structure

The generated ebook follows an academic textbook format:

```
Cover Page (SkillUniversity branding)
Copyright Page (legal disclaimers)
Preface (author's perspective, 300-400 words)
Table of Contents (auto-generated, linked anchors)

Unit 1: [Title]
  Unit Introduction (context-setting overview)
  1.1 [Subtopic] — 1100-1300 word technical content
  1.2 [Subtopic]
  ...
  1.5 [Subtopic]
  Unit Summary (bullet-point key takeaways)
  Review Exercises (MCQs with answers)

Unit 2: [Title]
  ...

... (12 units total)

Capstone Projects (2 comprehensive projects)
Case Studies (3 real-world scenarios)
Glossary (alphabetical key terms)
Bibliography (APA-formatted references)
```

### Hierarchical Numbering (RD Sharma Style)

- **Units**: Unit 1, Unit 2, Unit 3, ...
- **Subtopics**: 1.1, 1.2, ..., 2.1, 2.2, ...
- **Internal subsections**: 1.1.1, 1.1.2, ...
- Numbering resets per unit; no Roman numerals

### Per-Unit Sections

| Section | Generator | Model | Purpose |
|---------|-----------|-------|---------|
| Unit Introduction | `generate-unit-intro.ts` | LIGHT_MODEL | Sets context for the unit |
| Subtopics (5) | `generate-subtopic.ts` | Primary | Core technical content |
| Unit End Summary | `generate-unit-end-summary.ts` | LIGHT_MODEL | Bullet-point takeaways |
| Review Exercises | `generate-unit-exercises.ts` | LIGHT_MODEL | MCQs with answers |

---

## 7. LLM Call Inventory — Production Mode

| Call Type                  | Calls per Invocation | Total Calls | Model Used    | Notes                                     |
|----------------------------|---------------------|-------------|---------------|---------------------------------------------|
| **Structure generation**   | 1 (+ up to 2 retries)| 1–3        | Primary       | JSON output only                           |
| **Preface**                | 1                   | 1           | Primary       | 300–400 word intro                         |
| **Unit introductions**     | 1 per unit          | 12          | LIGHT_MODEL   | Context-setting overview                   |
| **Subtopic generation**    | 1 per subtopic      | 60          | Primary       | + up to 60 visual retries (worst case)     |
| **Visual retry**           | 0–1 per subtopic    | 0–60        | Primary       | Only triggers if visual validation fails   |
| **Micro-summary**          | 1 per subtopic      | 60          | LIGHT_MODEL   | Runs after each subtopic; feeds chaining   |
| **Unit summary combine**   | 1 per unit          | 12          | LIGHT_MODEL   | Combines 5 micro-summaries                 |
| **Unit end summary**       | 1 per unit          | 12          | LIGHT_MODEL   | Bullet-point takeaways                     |
| **Unit exercises**         | 1 per unit          | 12          | LIGHT_MODEL   | MCQs per unit                              |
| **Capstone generation**    | 1 (batched)         | 1           | Primary       | Both capstones in one call                 |
| **Case study generation**  | 1 (batched)         | 1           | Primary       | All case studies in one call               |
| **Glossary**               | 1                   | 1           | LIGHT_MODEL   | Alphabetical key terms                     |
| **Bibliography**           | 1                   | 1           | LIGHT_MODEL   | APA-formatted references                   |

### Total LLM Calls (Production)

| Scenario               | Call Count  |
|------------------------|-------------|
| **Best case** (no visual retries, batched) | **174 calls** |
| **Worst case** (all visual retries, batch fallback)| **238 calls** |
| **Typical** (~20% visual retry rate, batched) | **~186 calls** |

Hard limit: **200 calls** per session (circuit breaker). May need to increase for worst-case visual retry scenarios.

---

## 8. Token Budget — Per Call Breakdown

### Per-Call Token Estimates

| Call Type              | System Prompt | User Prompt  | Max Output  | Temperature | Model       | Est. Total Tokens |
|------------------------|--------------|-------------|-------------|-------------|-------------|-------------------|
| **Structure**          | ~15 tokens   | ~150 tokens | 2,000       | 0.20        | Primary     | ~1,200–1,600      |
| **Preface**            | ~100 tokens  | ~150 tokens | 600         | 0.40        | Primary     | ~500–800          |
| **Unit intro**         | ~100 tokens  | ~200 tokens | 400         | 0.30        | LIGHT_MODEL | ~400–600          |
| **Subtopic**           | ~100 tokens  | ~120–350 tokens* | 1,800  | 0.40        | Primary     | ~1,500–2,100      |
| **Visual retry**       | ~100 tokens  | ~250–500 tokens  | 1,800  | 0.40        | Primary     | ~1,500–2,100      |
| **Micro-summary**      | ~100 tokens  | ~300–350 tokens  | 100    | 0.10        | LIGHT_MODEL | ~400–500          |
| **Unit summary combine**| ~100 tokens | ~150–300 tokens  | 150    | 0.15        | LIGHT_MODEL | ~350–500          |
| **Unit end summary**   | ~100 tokens  | ~200 tokens | 400         | 0.20        | LIGHT_MODEL | ~400–600          |
| **Unit exercises**     | ~100 tokens  | ~200 tokens | 800         | 0.25        | LIGHT_MODEL | ~600–900          |
| **Capstones (batched)**| ~100 tokens  | ~1,500–1,800 tokens | 5,000 | 0.35     | Primary     | ~5,500–7,000      |
| **Case studies (batched)**| ~100 tokens | ~1,500–1,800 tokens | 5,000 | 0.35   | Primary     | ~5,500–7,000      |
| **Glossary**           | ~100 tokens  | ~300 tokens | 1,500       | 0.20        | LIGHT_MODEL | ~1,000–1,500      |
| **Bibliography**       | ~100 tokens  | ~300 tokens | 1,500       | 0.20        | LIGHT_MODEL | ~1,000–1,500      |

### Aggregate Token Budget (Production — ~174 calls, no retries, batched)

| Phase                          | Calls | Est. Tokens per Call | Phase Total     |
|--------------------------------|-------|---------------------|-----------------|
| Structure                      | 1     | ~1,400              | **~1,400**      |
| Preface                        | 1     | ~650                | **~650**        |
| Unit intros (12)               | 12    | ~500                | **~6,000**      |
| Subtopics (60)                 | 60    | ~1,800              | **~108,000**    |
| Micro-summaries (60)           | 60    | ~450                | **~27,000**     |
| Unit summary combines (12)     | 12    | ~425                | **~5,100**      |
| Unit end summaries (12)        | 12    | ~500                | **~6,000**      |
| Unit exercises (12)            | 12    | ~750                | **~9,000**      |
| Capstones (1 batched call)     | 1     | ~6,250              | **~6,250**      |
| Case studies (1 batched call)  | 1     | ~6,250              | **~6,250**      |
| Glossary                       | 1     | ~1,250              | **~1,250**      |
| Bibliography                   | 1     | ~1,250              | **~1,250**      |
| **TOTAL**                      | **174** |                   | **~178,150**    |

### Hard Limits

| Limit                      | Value     |
|----------------------------|-----------|
| Max LLM calls per session  | 200       |
| Max tokens per session     | 300,000   |
| Abort trigger              | Either limit exceeded → session fails |

### Token Optimization Strategies Employed

1. **Rolling context** — Only the *previous unit's* summary (~80–100 words) is injected per subtopic, not the full book context. Context injection is O(1).
2. **Subtopic-level summary chaining** — The micro-summary of the previous subtopic (50–80 words) is injected into the next subtopic's prompt, improving within-unit cohesion at minimal token cost.
3. **Micro-summary pipeline** — Each subtopic is compressed to 50–80 words immediately after generation. Only these summaries survive to the next phase.
4. **Memory freeing** — Micro-summaries are set to `null` after each unit's combine step. Intermediate markdown arrays are freed after assembly.
5. **Input truncation** — Micro-summary input is truncated to ~250 tokens (1,000 chars) to avoid bloating the context window.
6. **Compressed system prompt** — The system prompt is ~100 tokens, containing only essential rules.
7. **Model routing** — Lightweight tasks use `LIGHT_MODEL` (`gpt-4o-mini`) regardless of the session's primary model, reducing cost by ~30% when the primary model is `gpt-4o`.
8. **Batched capstones/case studies** — Both capstones in a single call, all case studies in a single call, saving API round-trips.
9. **`maxTokens` caps** — Hard API-level caps prevent runaway generation even if the model ignores word-count instructions.

---

## 9. Prompt Architecture

### System Prompts

| Prompt                     | Used By               | Purpose                                            | Approx Tokens |
|----------------------------|-----------------------|-----------------------------------------------------|---------------|
| `SYSTEM_PROMPT`            | Subtopics, micro-summaries, unit summaries, capstones, case studies, etc. | Compressed author persona: structure rules, visual enforcement, length discipline | ~100 |
| `SYSTEM_PROMPT_STRUCTURE`  | Structure generation only | "Output valid JSON only" — minimal, deterministic | ~15 |

### User Prompt Templates

| Template                        | File                           | Inputs                                                  | Output Target         |
|---------------------------------|--------------------------------|---------------------------------------------------------|-----------------------|
| `buildStructurePrompt()`        | `prompts/structure.ts`         | Topic, UNIT_COUNT, SUBTOPICS_PER_UNIT, etc.             | JSON book structure   |
| `buildPrefacePrompt()`          | `prompts/preface.ts`           | Topic, structure                                         | 300–400 word Markdown |
| `buildUnitIntroPrompt()`        | `prompts/unit-intro.ts`        | Topic, unit title, subtopic titles                       | Unit introduction     |
| `buildSubtopicPrompt()`         | `prompts/subtopic.ts`          | Topic, unit title, subtopic title, prev summaries        | 1100–1300 word Markdown |
| `buildVisualRetryPrompt()`      | `prompts/subtopic-visual-retry.ts` | Subtopic title                                      | Markdown with enforced visual |
| `buildMicroSummaryPrompt()`     | `prompts/micro-summary.ts`     | Subtopic title, content excerpt                          | 50–80 word summary    |
| `buildUnitSummaryCombinePrompt()` | `prompts/unit-summary-combine.ts` | Unit title, micro-summaries                         | 80–100 word paragraph |
| `buildUnitEndSummaryPrompt()`   | `prompts/unit-end-summary.ts`  | Topic, unit title, subtopics                             | Bullet-point summary  |
| `buildUnitExercisesPrompt()`    | `prompts/unit-exercises.ts`    | Topic, unit title, subtopics                             | MCQs with answers     |
| `buildBatchedCapstonePrompt()`  | `prompts/capstone.ts`          | Topic, capstone titles, all unit summaries               | Batched Markdown      |
| `buildBatchedCaseStudyPrompt()` | `prompts/case-study.ts`        | Topic, case study titles, all unit summaries             | Batched Markdown      |
| `buildGlossaryPrompt()`        | `prompts/glossary.ts`          | Topic, structure                                         | Alphabetical glossary |
| `buildBibliographyPrompt()`    | `prompts/bibliography.ts`      | Topic, structure                                         | APA references        |

---

## 10. Session Lifecycle & State Machine

```
                    POST /api/generate
                          │
                          ▼
                     ┌─────────┐
                     │ queued  │
                     └────┬────┘
                          │ orchestrate() starts
                          ▼
                   ┌──────────────┐
            ┌──────│ generating   │──────────────────┐
            │      └──────┬───────┘                   │
            │             │ all phases complete        │ error
            │             ▼                            ▼
            │      ┌────────────────┐          ┌──────────┐
            │      │ markdown_ready │          │ failed   │
            │      └───────┬────────┘          └──────────┘
            │              │ POST /api/approve
            │              ▼
            │      ┌────────────────┐
            │      │ exporting_pdf  │──────────┐
            │      └───────┬────────┘          │ error
            │              │ PDF done          ▼
            │              ▼              ┌──────────┐
            │      ┌──────────────┐       │ failed   │
            │      │ completed    │       └──────────┘
            │      └───────┬──────┘
            │              │ GET /api/download
            │              ▼
            │      ┌──────────────┐
            │      │ downloaded   │ → scheduleCleanup(5 min)
            │      └──────────────┘
            │
            └─── TTL sweeper (every 60s) → deleteSession() after 30 min
```

### Session Persistence

Sessions are persisted to disk (`.sessions/*.json`) on every state change. On server restart:
- All sessions are rehydrated from disk
- Any session in `generating` or `queued` status is marked as `failed` with error "Server restarted during generation"
- Session TTL timer resumes

---

## 11. PDF Generation Pipeline

```
finalMarkdown
      │
      ▼
markdownToHtml()          ← Marked v17 (GFM) + Highlight.js v11
      │                       Custom renderer: code blocks, headings, tables
      ▼
splitHtmlByH1()           ← Split by <h1> tags into chunks
      │
      ▼
flattenChunks()           ← Further split any chunk > 350KB by <h2>
      │
      ▼
For each chunk:
  wrapInHtmlTemplate()    ← Full HTML document with CSS + highlight CSS
  Puppeteer page.setContent() + page.pdf()
  3 retry attempts with browser re-launch on failure
  600ms pause between chunks
      │
      ▼
pdf-lib merge             ← Combine all chunk PDFs into one document
      │
      ▼
Page numbering            ← Centered footer, Helvetica 9pt, gray
      │
      ▼
session.pdfBuffer = merged PDF
```

### Browser Pool

- Singleton Puppeteer browser with launch mutex to prevent race conditions
- Browser is reused across PDF exports for the server's lifetime
- Automatic re-launch on disconnect or crash
- Clean shutdown on SIGTERM/SIGINT
- Docker mode: uses system Chromium (`PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`)

### Error Recovery

- **Retriable errors**: `Target closed`, `Protocol error`, `Connection closed`, `Navigation timeout`, `Session closed`
- On retriable error: close browser, sleep 1.5s, launch fresh browser, retry (up to 3 attempts per chunk)
- On browser launch failure: sleep 2s, retry
- On `newPage()` failure: close browser, relaunch, retry

---

## 12. DOCX Generation

```
finalMarkdown → markdownToHtml() → HTML string
      │
      ▼
html-to-docx library
  - Font: Georgia, 11pt
  - Page numbers in footer
  - Table rows can't split across pages
  - Book title in document metadata
      │
      ▼
Buffer returned (used by CLI batch for Drive upload)
```

DOCX export is used by the batch CLI. The frontend workflow only produces PDF via the approve → download flow.

---

## 13. Google Drive Integration

### One-Time OAuth Setup

1. Create a GCP project with Google Drive API enabled
2. Create OAuth 2.0 credentials (Web application type)
3. Add `http://localhost:4000/auth/callback` as an authorized redirect URI
4. Set `GDRIVE_CLIENT_ID` and `GDRIVE_CLIENT_SECRET` in `.env`
5. Visit `http://localhost:4000/auth/google` in a browser
6. Grant Drive access → Google redirects to `/auth/callback`
7. Copy the displayed refresh token into `GDRIVE_REFRESH_TOKEN` in `.env`

### Upload Flow

```
uploadPdfToDrive(buffer, filename)
  → getDriveClient() → OAuth2 with refresh token
  → drive.files.create({ parents: [GDRIVE_PDF_FOLDER_ID], media: Readable.from(buffer) })
  → returns file ID

uploadDocxToDrive(buffer, filename)
  → same flow with GDRIVE_DOC_FOLDER_ID
```

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `GDRIVE_CLIENT_ID` | OAuth client ID from GCP Console |
| `GDRIVE_CLIENT_SECRET` | OAuth client secret |
| `GDRIVE_REFRESH_TOKEN` | Offline refresh token (obtained via one-time flow) |
| `GDRIVE_PDF_FOLDER_ID` | Target Google Drive folder ID for PDFs |
| `GDRIVE_DOC_FOLDER_ID` | Target Google Drive folder ID for DOCXs |

---

## 14. Bulk Generation (CLI)

The batch CLI (`apps/api/src/cli/batch.ts`) generates multiple ebooks from a CSV or XLSX file and uploads them to Google Drive.

### Usage

```bash
cd apps/api
npm run batch -- path/to/books.csv
```

Or via Docker:

```bash
docker compose run --rm app batch /data/books.csv
```

### CSV Format

```csv
title
Advanced Python Programming
Machine Learning Fundamentals
Cloud Architecture Patterns
```

Column A must contain the book title. Headers are optional (auto-detected).

### Processing Flow

```
Read CSV/XLSX → extract titles from column A
      │
      ▼
For each title (sequential):
  1. Create batch session (in-memory, no persistence)
  2. orchestrate(session) — full pipeline
  3. exportPDF(session) → PDF buffer
  4. exportDOCX(session) → DOCX buffer
  5. uploadPdfToDrive(pdfBuffer, "Title.pdf")
  6. uploadDocxToDrive(docxBuffer, "Title.docx")
  7. freeSession(session) — always runs (try/finally)
  8. Log progress
      │
      ▼
Print summary: N succeeded, M failed
Close browser
Exit with code 0 (all OK) or 1 (any failures)
```

### Error Handling

- Each book is processed in a try/catch — one failure doesn't stop the batch
- Session memory is always freed via `finally` block
- Browser is cleaned up on exit
- Failed books are listed in the summary with error messages

---

## 15. Frontend Architecture

### Component Hierarchy

```
App (page.tsx)
├── GeneratorForm          # Topic input + model selector
│     ↓ on submit
├── SyllabusPhase          # "Architecting Syllabus..." modal
│     ↓ when structure received
└── WorkspaceLayout        # Three-pane workspace
     ├── Navigator          # Left: unit/subtopic tree with status icons
     ├── ContentViewer      # Center: subtopic Markdown rendered as HTML
     │   └── StickyToolbar  # Bottom: Regenerate, Expand, Shorten, etc.
     │   └── FloatingToolbar# On text selection: context-sensitive edit actions
     ├── BookPreview        # Center (alt): full book infinite scroll
     ├── MetadataPanel      # Right: word count, page estimate, export
     └── ExportPreviewModal # Modal: TOC preview + Download PDF button
```

### State Management

- **Polling**: `useProgressStream` hook polls `GET /api/progress/poll` every 2s during active generation, every 10s once terminal state is reached. Uses `hasStateChanged` guard to prevent unnecessary re-renders.
- **Content loading**: `useSubtopicContent` hook fetches content on subtopic click with module-level cache.
- **Session URL**: Session ID is synced to the URL (`?sid=...`) so the page survives browser refresh and is shareable.
- **Per-subtopic granularity**: Each subtopic is an independent state object. Regeneration, editing, and undo operate on individual subtopics without affecting others.

### Edit Actions (Review Mode)

| Action | Description |
|--------|-------------|
| **Regenerate** | Re-generates the entire subtopic from scratch |
| **Expand** | Adds more detail to selected text |
| **Shorten** | Condenses selected text |
| **Rewrite** | Rewrites selected text with different phrasing |
| **Add Example** | Inserts a code example after selected text |
| **Add Table** | Inserts a comparison/reference table after selected text |
| **Undo** | Restores previous version (up to 5 versions per subtopic) |

---

## 16. API Routes

| Method | Endpoint               | Purpose                                    | Request Body                        | Response                  |
|--------|------------------------|--------------------------------------------|-------------------------------------|---------------------------|
| POST   | `/api/generate`        | Start new book generation                  | `{ topic, model? }`                | `{ sessionId }` (202)    |
| GET    | `/api/progress/poll`   | Poll generation progress                   | `?sid=...`                          | `ProgressEvent` JSON      |
| GET    | `/api/content`         | Fetch a specific subtopic's Markdown       | `?sid=...&unit=...&subtopic=...`    | `{ markdown }` |
| POST   | `/api/regenerate`      | Regenerate a specific subtopic             | `{ sessionId, unitIdx, subtopicIdx }` | `{ markdown }` (202)  |
| POST   | `/api/edit-section`    | Surgical edit (expand, shorten, rewrite)   | `{ sessionId, unitIdx, subtopicIdx, selectedText, action }` | `{ markdown }` |
| POST   | `/api/undo`            | Restore previous version of a subtopic     | `{ sessionId, unitIdx, subtopicIdx }` | `{ markdown, versionsRemaining }` |
| POST   | `/api/approve`         | Approve Markdown → trigger PDF generation  | `{ sessionId }`                     | `{ status: "exporting_pdf" }` (202) |
| GET    | `/api/download`        | Download generated PDF                     | `?sid=...`                          | PDF binary (200)          |
| GET    | `/auth/google`         | Start OAuth flow for Google Drive          | —                                   | Redirect to Google        |
| GET    | `/auth/callback`       | OAuth callback with refresh token          | `?code=...`                         | HTML with token           |

---

## 17. Safety & Resilience

### Circuit Breaker

| Limit                    | Threshold | Action on Breach                          |
|--------------------------|-----------|-------------------------------------------|
| Max LLM calls per session| 200       | Throws `ABORT` error → session fails      |
| Max tokens per session   | 300,000   | Throws `ABORT` error → session fails      |

The `ABORT` keyword in the error message bypasses the retry mechanism to prevent compounding failed calls.

### Retry Logic

| Scope            | Max Retries | Backoff Strategy                     |
|------------------|-------------|--------------------------------------|
| Structure gen    | 3           | Exponential (2s base)                |
| Subtopic gen     | 3           | Exponential (2s base)                |
| Micro-summary    | 2           | Exponential (2s base)                |
| Unit summary     | 2           | Exponential (2s base)                |
| All other gens   | 2           | Exponential (2s base)                |
| Rate limit (429) | Same as above | `Retry-After` header (default 60s) |
| Server error (5xx)| Same as above | Exponential backoff              |

### Concurrency Control

- Max 3 concurrent generating sessions (configurable via `MAX_CONCURRENT_SESSIONS`)
- New requests return `503 Retry-After: 60` when at capacity
- Sessions auto-expire after `SESSION_TTL_MS` (default 30 min)
- Sweeper runs every 60s to clean stale sessions
- After PDF download, `scheduleCleanup()` deletes session after 5 min

### Server Hardening

- Global Express error handler catches unhandled route errors
- Request body size limited to 2MB
- Server timeout set to 10 minutes (for long PDF exports)
- PORT validation on startup
- Browser pool uses launch mutex to prevent race conditions
- Session state persisted to disk — survives server restarts

---

## 18. Debug Mode

Controlled by `DEBUG_MODE=true` in `.env`.

| Config                 | Production (`false`) | Debug (`true`) |
|------------------------|---------------------|----------------|
| `UNIT_COUNT`           | 12                  | 1              |
| `SUBTOPICS_PER_UNIT`   | 5                   | 1              |
| `TOTAL_SUBTOPICS`      | 60                  | 1              |
| `CAPSTONE_COUNT`       | 2                   | 1              |
| `CASE_STUDY_COUNT`     | 3                   | 1              |
| `MIN_CALL_INTERVAL_MS` | 0                   | 800            |

Debug mode throttles 800ms between LLM calls to avoid rate limits during testing. Generates a minimal ebook with 1 unit, 1 subtopic for rapid pipeline validation.

---

## 19. Environment Variables

| Variable                  | Required | Default          | Description                                 |
|---------------------------|----------|------------------|---------------------------------------------|
| `OPENAI_API_KEY`          | Yes      | —                | OpenAI API key                              |
| `OPENAI_MODEL`            | No       | `gpt-4o-mini`    | Default primary model for generation        |
| `LIGHT_MODEL`             | No       | `gpt-4o-mini`    | Model for summaries, exercises, glossary, etc. |
| `DEBUG_MODE`              | No       | `false`          | Enable reduced structure for testing        |
| `DEBUG_ORCHESTRATOR`      | No       | `0`              | Enable verbose orchestrator logging (`1`)   |
| `PORT`                    | No       | `4000`           | Express server port                         |
| `MAX_CONCURRENT_SESSIONS` | No       | `3`              | Max parallel generation sessions            |
| `SESSION_TTL_MS`          | No       | `1800000` (30m)  | Session time-to-live in milliseconds        |
| `PUPPETEER_EXECUTABLE_PATH`| No     | —                | Custom Chrome/Chromium binary path          |
| `PUPPETEER_DOCKER`        | No       | `false`          | Set to `true` in Docker for `--no-zygote`   |
| `NEXT_PUBLIC_API_URL`     | No       | `http://localhost:4000` | API URL for frontend proxy (production: set to EC2 IP) |
| `GDRIVE_CLIENT_ID`        | For batch | —               | Google OAuth client ID                      |
| `GDRIVE_CLIENT_SECRET`    | For batch | —               | Google OAuth client secret                  |
| `GDRIVE_REFRESH_TOKEN`    | For batch | —               | Google OAuth refresh token                  |
| `GDRIVE_PDF_FOLDER_ID`    | For batch | —               | Google Drive folder ID for PDFs             |
| `GDRIVE_DOC_FOLDER_ID`    | For batch | —               | Google Drive folder ID for DOCXs            |

### Recommended Models

| Use Case              | Primary Model  | LIGHT_MODEL    | Reason                                      |
|-----------------------|----------------|----------------|---------------------------------------------|
| Debug / testing       | `gpt-4o-mini`  | `gpt-4o-mini`  | Fast, cost-effective, sufficient for testing |
| Production books      | `gpt-4o`       | `gpt-4o-mini`  | Best quality for content; cheap model for summaries/edits |
| Budget production     | `gpt-4-turbo`  | `gpt-4o-mini`  | Good quality at lower cost than gpt-4o       |

---

## 20. Docker & AWS Deployment

### Docker Architecture

The project uses a multi-stage Dockerfile:

| Stage | Purpose | Output |
|-------|---------|--------|
| `deps` | Install all npm dependencies | `node_modules` |
| `build-api` | Compile TypeScript API to `dist/` | `apps/api/dist` |
| `build-frontend` | Build Next.js production bundle | `apps/frontend/.next` |
| `runner` | Production image with Chromium | Final image (~1.2GB) |

The entrypoint supports two modes:
- **`web`** (default): Starts both the API server (port 4000) and Next.js frontend (port 3000)
- **`batch`**: Runs the CLI batch generation script with arguments

### Quick Start (Docker)

```bash
# Build and start the web application
docker compose up -d

# Check logs
docker compose logs -f

# Run bulk generation
docker compose run --rm app batch /data/books.csv

# Stop
docker compose down
```

### AWS EC2 Deployment

**Recommended instance**: `t3.medium` or `t3.large` (2–4 vCPU, 4–8 GB RAM)

```bash
# 1. SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# 2. Install Docker
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# 3. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Clone and configure
git clone <your-repo-url> ebook-generator
cd ebook-generator
cp apps/api/.env.example apps/api/.env
nano apps/api/.env    # Fill in your keys

# 5. Update NEXT_PUBLIC_API_URL in docker-compose.yml
# Change to: http://your-ec2-ip:4000

# 6. Build and run
docker compose up -d --build

# 7. Verify
curl http://localhost:4000/api/progress/poll?sid=test
# Should return 404 (expected — no active session)
```

### Security Considerations

- The API has no authentication — restrict access via AWS Security Groups (only allow your IP on ports 3000/4000)
- For public access, add an ALB/Nginx reverse proxy with HTTPS
- Google Drive credentials are in `.env` — never commit this file
- The batch CLI is run via SSH only — no public endpoint for bulk generation

### Resource Requirements

| Component | RAM Usage | Notes |
|-----------|-----------|-------|
| Node.js API | ~200MB base | +200MB per active session |
| Chromium (Puppeteer) | ~300–500MB | Per PDF export |
| Next.js | ~150MB | Production mode |
| **Total (1 session)** | **~1GB** | |
| **Total (3 sessions)** | **~2GB** | Max concurrent |
| **Batch mode** | **~1.5GB** | Sequential processing |
